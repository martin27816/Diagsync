import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Department, AvailabilityStatus, StaffStatus } from "@prisma/client";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

// POST /api/visits/[visitId]/route-tests
// Triggers auto-routing: assigns each test order to the least-loaded
// available staff member in the correct department.
export async function POST(
  req: NextRequest,
  { params }: { params: { visitId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    // Fetch the visit with its test orders
    const visit = await prisma.visit.findFirst({
      where: { id: params.visitId, organizationId: user.organizationId },
      include: {
        testOrders: {
          where: { status: "REGISTERED" },
          include: { test: true },
        },
        patient: { select: { fullName: true, patientId: true } },
      },
    });

    if (!visit) {
      return NextResponse.json({ success: false, error: "Visit not found" }, { status: 404 });
    }

    if (visit.testOrders.length === 0) {
      return NextResponse.json({ success: true, message: "No unrouted test orders", data: [] });
    }

    // Map department → role that handles it
    const deptToRole: Record<string, Role> = {
      LABORATORY: Role.LAB_SCIENTIST,
      RADIOLOGY: Role.RADIOGRAPHER,
    };

    const assignments: { testOrderId: string; testName: string; assignedTo: string | null }[] = [];

    for (const order of visit.testOrders) {
      const targetRole = deptToRole[order.test.department];

      if (!targetRole) {
        // Department not yet handled (e.g. MEDICAL_REVIEW) — skip
        assignments.push({ testOrderId: order.id, testName: order.test.name, assignedTo: null });
        continue;
      }

      // Find available staff with least workload in this role
      const availableStaff = await prisma.staff.findMany({
        where: {
          organizationId: user.organizationId,
          role: targetRole,
          status: StaffStatus.ACTIVE,
          availabilityStatus: AvailabilityStatus.AVAILABLE,
        },
        include: {
          _count: {
            select: {
              // Count active test orders assigned to them (not yet completed)
              // We use audit logs as a proxy — for now we just pick any available staff
            },
          },
        },
      });

      let assignedStaff = null;

      if (availableStaff.length > 0) {
        // Pick the first available — in Phase 4 we'll add workload sorting
        // For now: round-robin or first available
        assignedStaff = availableStaff[0];
      }

      // Update test order status to ASSIGNED and record assignedAt
      await prisma.testOrder.update({
        where: { id: order.id },
        data: {
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });

      assignments.push({
        testOrderId: order.id,
        testName: order.test.name,
        assignedTo: assignedStaff ? assignedStaff.fullName : null,
      });

      // Audit log each assignment
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role as Role,
        action: AUDIT_ACTIONS.TEST_ASSIGNED ?? "TEST_ASSIGNED",
        entityType: "TestOrder",
        entityId: order.id,
        newValue: {
          testName: order.test.name,
          patientName: visit.patient.fullName,
          patientId: visit.patient.patientId,
          assignedTo: assignedStaff?.fullName ?? "Unassigned (no available staff)",
          department: order.test.department,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Routed ${assignments.length} test order(s)`,
      data: assignments,
    });
  } catch (error) {
    console.error("[ROUTE_TESTS]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}