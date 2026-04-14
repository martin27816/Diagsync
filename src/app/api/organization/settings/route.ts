import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  address: z.string().min(5).optional(),
  contactInfo: z.string().max(1000).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  letterheadUrl: z.string().url().optional().nullable(),
  consultationTimeoutMinutes: z.number().int().min(1).max(120).optional(),
});

function assertAdmin(role: string) {
  if (role !== "SUPER_ADMIN") throw new Error("FORBIDDEN_ROLE");
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    assertAdmin(user.role);

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    if (!organization) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: organization });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[ORG_SETTINGS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    assertAdmin(user.role);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const oldOrg = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    if (!oldOrg) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: parsed.data,
    });

    await createAuditLog({
      actorId: user.id,
      actorRole: Role.SUPER_ADMIN,
      action: "LAB_SETTINGS_UPDATED",
      entityType: "Organization",
      entityId: updated.id,
      oldValue: {
        name: oldOrg.name,
        phone: oldOrg.phone,
        address: oldOrg.address,
        logo: oldOrg.logo,
        letterheadUrl: oldOrg.letterheadUrl,
        consultationTimeoutMinutes: oldOrg.consultationTimeoutMinutes,
      },
      newValue: {
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
        logo: updated.logo,
        letterheadUrl: updated.letterheadUrl,
        consultationTimeoutMinutes: updated.consultationTimeoutMinutes,
      },
      changes: {
        before: oldOrg,
        after: updated,
      },
      ...getAuditMetaFromRequest(req),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[ORG_SETTINGS_PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
