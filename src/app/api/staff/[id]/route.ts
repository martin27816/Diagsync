import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Role, Department, Shift, StaffStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateStaffSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  role: z.nativeEnum(Role).optional(),
  department: z.nativeEnum(Department).optional(),
  gender: z.string().optional(),
  defaultShift: z.nativeEnum(Shift).optional(),
  status: z.nativeEnum(StaffStatus).optional(),
  password: z.string().min(8).optional(),
});

// GET /api/staff/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const staff = await prisma.staff.findUnique({
      where: { id: params.id, organizationId: user.organizationId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        status: true,
        availabilityStatus: true,
        defaultShift: true,
        gender: true,
        dateJoined: true,
        lastAvailableAt: true,
        lastUnavailableAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        availabilityLogs: {
          orderBy: { changedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!staff) {
      return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    console.error("[STAFF_GET_ID]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/staff/[id]
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

    // Staff can only update their own profile (limited fields), admins can update anyone
    if (!isAdminOrHRM && user.id !== params.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.password && !isAdminOrHRM) {
      return NextResponse.json(
        { success: false, error: "Only HR can change staff passwords" },
        { status: 403 }
      );
    }

    // Get old staff data for audit
    const oldStaff = await prisma.staff.findUnique({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!oldStaff) {
      return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
    }

    // Non-admins cannot change role, department, or status
    if (!isAdminOrHRM) {
      delete data.role;
      delete data.department;
      delete data.status;
    }

    const updateData: any = { ...data };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    const updated = await prisma.staff.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        status: true,
        defaultShift: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.STAFF_UPDATED,
      entityType: "Staff",
      entityId: params.id,
      oldValue: {
        fullName: oldStaff.fullName,
        role: oldStaff.role,
        status: oldStaff.status,
      },
      newValue: {
        fullName: updated.fullName,
        role: updated.role,
        status: updated.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[STAFF_PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/staff/[id] — soft delete by setting status to INACTIVE
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    if (!["SUPER_ADMIN", "HRM"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Only HR can delete/deactivate staff" }, { status: 403 });
    }

    if (user.id === params.id) {
      return NextResponse.json({ success: false, error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const staff = await prisma.staff.update({
      where: { id: params.id, organizationId: user.organizationId },
      data: { status: "INACTIVE" },
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.STAFF_DEACTIVATED,
      entityType: "Staff",
      entityId: params.id,
      notes: `Staff ${staff.fullName} deactivated`,
    });

    return NextResponse.json({
      success: true,
      message: "Staff member deactivated successfully",
    });
  } catch (error) {
    console.error("[STAFF_DELETE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
