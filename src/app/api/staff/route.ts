import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Role, Department, Shift } from "@prisma/client";
import { canAddStaff } from "@/lib/billing-access";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

const createStaffSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number required"),
  role: z.nativeEnum(Role),
  department: z.nativeEnum(Department),
  gender: z.string().optional(),
  defaultShift: z.nativeEnum(Shift).default(Shift.MORNING),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// GET /api/staff — list all staff in the organization
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    await requireOrganizationCoreAccess(user.organizationId);

    // Only SUPER_ADMIN and HRM can list all staff
    if (!["SUPER_ADMIN", "HRM"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const search = searchParams.get("search") ?? "";
    const role = searchParams.get("role") as Role | null;
    const department = searchParams.get("department") as Department | null;
    const status = searchParams.get("status");

    const where: any = {
      organizationId: user.organizationId,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role && { role }),
      ...(department && { department }),
      ...(status && { status }),
    };

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
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
          createdAt: true,
          organization: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.staff.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: staff,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    console.error("[STAFF_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/staff — create a new staff member
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { organization } = await requireOrganizationCoreAccess(user.organizationId);

    if (!["SUPER_ADMIN", "HRM"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.role === "MEGA_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }

    if (organization.plan === "STARTER" && data.role === "RADIOGRAPHER") {
      return NextResponse.json(
        { success: false, error: "Radiographer role is available on Advanced plan only." },
        { status: 403 }
      );
    }

    // Check email uniqueness
    const existing = await prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A staff member with this email already exists" },
        { status: 409 }
      );
    }

    const currentStaffCount = await prisma.staff.count({ where: { organizationId: user.organizationId } });
    if (!canAddStaff(organization, currentStaffCount)) {
      return NextResponse.json(
        { success: false, error: "Staff limit reached for your current plan. Upgrade to add more staff." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const staff = await prisma.staff.create({
      data: {
        organizationId: user.organizationId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        department: data.department,
        gender: data.gender,
        defaultShift: data.defaultShift,
        passwordHash,
        createdById: user.id,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        status: true,
        defaultShift: true,
        dateJoined: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.STAFF_CREATED,
      entityType: "Staff",
      entityId: staff.id,
      newValue: { fullName: staff.fullName, email: staff.email, role: staff.role },
    });

    return NextResponse.json(
      { success: true, message: "Staff member created successfully", data: staff },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    console.error("[STAFF_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
