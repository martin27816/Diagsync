import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { ensureDeviceInOrganization, requireSessionStaffContext } from "@/lib/device-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceKey: z.string().min(10, "Invalid device key"),
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
    const device = await ensureDeviceInOrganization(parsed.data.deviceKey, actor.organizationId!);
    if (!device) {
      return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
    }
    if (device === "OTHER_ORGANIZATION") {
      return NextResponse.json({ success: false, error: "This device belongs to another organization" }, { status: 409 });
    }

    await prisma.deviceStaff.deleteMany({
      where: { deviceId: device.id },
    });

    await createAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "DEVICE_CLEARED",
      entityType: "Device",
      entityId: device.id,
      changes: {
        deviceId: device.id,
        deviceKey: device.deviceKey,
      },
      ...getAuditMetaFromRequest(req),
    });

    return NextResponse.json({ success: true, message: "Device cleared successfully" });
  } catch (error) {
    console.error("[DEVICE_CLEAR_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
