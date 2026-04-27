import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { ensureDeviceInOrganization, requireSessionStaffContext } from "@/lib/device-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceKey: z.string().min(10, "Invalid device key"),
  staffId: z.string().min(1),
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
    const { deviceKey, staffId } = parsed.data;
    const device = await ensureDeviceInOrganization(deviceKey, actor.organizationId!);
    if (!device) {
      return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
    }
    if (device === "OTHER_ORGANIZATION") {
      return NextResponse.json({ success: false, error: "This device belongs to another organization" }, { status: 409 });
    }

    const link = await prisma.deviceStaff.findUnique({
      where: {
        deviceId_staffId: {
          deviceId: device.id,
          staffId,
        },
      },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ success: false, error: "Staff not linked to this device" }, { status: 404 });
    }

    await prisma.deviceStaff.delete({
      where: {
        deviceId_staffId: {
          deviceId: device.id,
          staffId,
        },
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "STAFF_REMOVED_FROM_DEVICE",
      entityType: "DeviceStaff",
      entityId: staffId,
      changes: {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        targetStaffId: staffId,
      },
      ...getAuditMetaFromRequest(req),
    });

    return NextResponse.json({ success: true, message: "Staff removed from device" });
  } catch (error) {
    console.error("[DEVICE_REMOVE_STAFF_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
