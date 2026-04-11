import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Role, Department } from "@prisma/client";

const registerSchema = z.object({
  // Organization details
  orgName: z.string().min(2, "Organization name is required"),
  orgEmail: z.string().email("Valid email required"),
  orgPhone: z.string().min(7, "Phone number required"),
  orgAddress: z.string().min(5, "Address required"),
  orgContactInfo: z.string().max(1000).optional().nullable(),
  orgLogo: z.string().url().optional().nullable(),
  orgLetterheadUrl: z.string().url().optional().nullable(),
  // Admin account details
  adminName: z.string().min(2, "Admin full name required"),
  adminEmail: z.string().email("Valid admin email required"),
  adminPhone: z.string().min(7, "Admin phone required"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if org email already registered
    const existingOrg = await prisma.organization.findUnique({
      where: { email: data.orgEmail },
    });
    if (existingOrg) {
      return NextResponse.json(
        { success: false, error: "An organization with this email already exists" },
        { status: 409 }
      );
    }

    // Check if admin email already taken
    const existingAdmin = await prisma.staff.findUnique({
      where: { email: data.adminEmail },
    });
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "This admin email is already in use" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.adminPassword, 12);

    // Create org and super admin in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.orgName,
          email: data.orgEmail,
          phone: data.orgPhone,
          address: data.orgAddress,
          contactInfo: data.orgContactInfo ?? null,
          logo: data.orgLogo ?? null,
          letterheadUrl: data.orgLetterheadUrl ?? null,
        },
      });

      const admin = await tx.staff.create({
        data: {
          organizationId: org.id,
          fullName: data.adminName,
          email: data.adminEmail,
          phone: data.adminPhone,
          passwordHash,
          role: Role.SUPER_ADMIN,
          department: Department.HR_OPERATIONS,
        },
      });

      return { org, admin };
    });

    // Audit log — super admin creates themselves during registration
    await createAuditLog({
      actorId: result.admin.id,
      actorRole: Role.SUPER_ADMIN,
      action: AUDIT_ACTIONS.ORG_CREATED,
      entityType: "Organization",
      entityId: result.org.id,
      newValue: {
        name: result.org.name,
        email: result.org.email,
        logo: result.org.logo,
        letterheadUrl: result.org.letterheadUrl,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Organization registered successfully",
        data: {
          organizationId: result.org.id,
          organizationName: result.org.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ORG_REGISTER]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
