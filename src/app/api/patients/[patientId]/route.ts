import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    await requireOrganizationCoreAccess(user.organizationId);
    if (!["RECEPTIONIST", "SUPER_ADMIN", "HRM"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        patientId: true,
        fullName: true,
        visits: {
          select: {
            id: true,
            routingTasks: { select: { id: true } },
            testOrders: { select: { id: true } },
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    }

    const visitIds = patient.visits.map((visit) => visit.id);
    const taskIds = patient.visits.flatMap((visit) => visit.routingTasks.map((task) => task.id));
    const testOrderIds = patient.visits.flatMap((visit) => visit.testOrders.map((order) => order.id));

    await prisma.$transaction(async (tx) => {
      const notificationClauses: Array<Record<string, unknown>> = [
        { entityType: "Patient", entityId: patient.id },
      ];
      if (visitIds.length > 0) {
        notificationClauses.push({ entityType: "Visit", entityId: { in: visitIds } });
      }
      if (taskIds.length > 0) {
        notificationClauses.push({ entityType: "RoutingTask", entityId: { in: taskIds } });
      }
      if (testOrderIds.length > 0) {
        notificationClauses.push({ entityType: "TestOrder", entityId: { in: testOrderIds } });
      }

      await tx.notification.deleteMany({
        where: {
          organizationId: user.organizationId,
          OR: notificationClauses,
        },
      });

      const auditClauses: Array<Record<string, unknown>> = [
        { entityType: "Patient", entityId: patient.id },
      ];
      if (visitIds.length > 0) {
        auditClauses.push({ entityType: "Visit", entityId: { in: visitIds } });
      }
      if (taskIds.length > 0) {
        auditClauses.push({ entityType: "RoutingTask", entityId: { in: taskIds } });
      }
      if (testOrderIds.length > 0) {
        auditClauses.push({ entityType: "TestOrder", entityId: { in: testOrderIds } });
      }

      await tx.auditLog.deleteMany({
        where: {
          OR: auditClauses,
        },
      });

      await tx.patient.delete({
        where: { id: patient.id },
      });
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role as Role,
      action: "PATIENT_DELETED",
      entityType: "Patient",
      entityId: patient.id,
      oldValue: {
        patientId: patient.patientId,
        fullName: patient.fullName,
        visitCount: visitIds.length,
        taskCount: taskIds.length,
        testOrderCount: testOrderIds.length,
      },
      notes: "Patient and all linked workflow records deleted permanently",
    });

    return NextResponse.json({
      success: true,
      message: "Patient deleted permanently",
      data: {
        patientId: patient.id,
        visitCount: visitIds.length,
        taskCount: taskIds.length,
        testOrderCount: testOrderIds.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    console.error("[PATIENT_DELETE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
