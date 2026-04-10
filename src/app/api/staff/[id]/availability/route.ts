import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { AvailabilityStatus } from "@prisma/client";

// PATCH /api/staff/[id]/availability
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isAdminOrHRM = ["SUPER_ADMIN", "HRM"].includes(user.role);

    // Staff can only change their own availability, HRM/admin can change anyone's
    if (!isAdminOrHRM && user.id !== params.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, reason } = body as {
      status: AvailabilityStatus;
      reason?: string;
    };

    if (!["AVAILABLE", "UNAVAILABLE"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status must be AVAILABLE or UNAVAILABLE" },
        { status: 400 }
      );
    }

    const currentStaff = await prisma.staff.findUnique({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!currentStaff) {
      return NextResponse.json({ success: false, error: "Staff not found" }, { status: 404 });
    }

    const oldStatus = currentStaff.availabilityStatus;

    // Update availability and timestamp
    const updated = await prisma.staff.update({
      where: { id: params.id },
      data: {
        availabilityStatus: status,
        lastAvailableAt: status === "AVAILABLE" ? new Date() : currentStaff.lastAvailableAt,
        lastUnavailableAt: status === "UNAVAILABLE" ? new Date() : currentStaff.lastUnavailableAt,
      },
      select: {
        id: true,
        fullName: true,
        availabilityStatus: true,
        lastAvailableAt: true,
        lastUnavailableAt: true,
      },
    });

    // Log the change
    await prisma.availabilityLog.create({
      data: {
        staffId: params.id,
        oldStatus,
        newStatus: status,
        reason,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.AVAILABILITY_CHANGED,
      entityType: "Staff",
      entityId: params.id,
      oldValue: { availabilityStatus: oldStatus },
      newValue: { availabilityStatus: status },
      notes: reason,
    });

    return NextResponse.json({
      success: true,
      message: `Availability set to ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error("[STAFF_AVAILABILITY]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
