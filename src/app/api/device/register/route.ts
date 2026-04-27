import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { ensureDeviceInOrganization, requireSessionStaffContext, toSafeStaffSummary } from "@/lib/device-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceKey: z.string().min(10, "Invalid device key"),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actorContext = await requireSessionStaffContext();
    if ("error" in actorContext) {
      return NextResponse.json({ success: false, error: actorContext.error }, { status: actorContext.status });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    const { actor } = actorContext;
    const { deviceKey, name } = parsed.data;
    const existing = await ensureDeviceInOrganization(deviceKey, actor.organizationId!);
    if (existing === "OTHER_ORGANIZATION") {
      return NextResponse.json({ success: false, error: "This device belongs to another organization" }, { status: 409 });
    }

    const device =
      existing ??
      (await prisma.device.create({
        data: {
          deviceKey,
          organizationId: actor.organizationId!,
          name: name?.trim() || null,
        },
        select: { id: true, deviceKey: true, organizationId: true, name: true, createdAt: true },
      }));

    if (!existing) {
      await createAuditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: "DEVICE_REGISTERED",
        entityType: "Device",
        entityId: device.id,
        changes: {
          deviceKey: device.deviceKey,
          organizationId: device.organizationId,
          name: device.name,
        },
        ...getAuditMetaFromRequest(req),
      });
    }

    const links = await prisma.deviceStaff.findMany({
      where: {
        deviceId: device.id,
        staff: {
          organizationId: actor.organizationId!,
          status: "ACTIVE",
        },
      },
      select: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { addedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: device.id,
        deviceKey: device.deviceKey,
        organizationId: device.organizationId,
        name: device.name,
        staff: links.map((link) => toSafeStaffSummary(link.staff)),
      },
    });
  } catch (error) {
    console.error("[DEVICE_REGISTER_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
