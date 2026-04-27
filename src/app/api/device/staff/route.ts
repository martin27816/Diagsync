import { NextRequest, NextResponse } from "next/server";
import { ensureDeviceInOrganization, requireSessionStaffContext, toSafeStaffSummary } from "@/lib/device-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actorContext = await requireSessionStaffContext();
    if ("error" in actorContext) {
      return NextResponse.json({ success: false, error: actorContext.error }, { status: actorContext.status });
    }

    const { searchParams } = new URL(req.url);
    const deviceKey = searchParams.get("deviceKey")?.trim();
    if (!deviceKey) {
      return NextResponse.json({ success: false, error: "deviceKey is required" }, { status: 400 });
    }

    const { actor } = actorContext;
    const device = await ensureDeviceInOrganization(deviceKey, actor.organizationId!);
    if (!device) {
      return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
    }
    if (device === "OTHER_ORGANIZATION") {
      return NextResponse.json({ success: false, error: "This device belongs to another organization" }, { status: 409 });
    }

    const rows = await prisma.deviceStaff.findMany({
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
        lastUsedAt: true,
        addedAt: true,
      },
      orderBy: [{ lastUsedAt: "desc" }, { addedAt: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        staff: rows.map((row) => toSafeStaffSummary(row.staff)),
      },
    });
  } catch (error) {
    console.error("[DEVICE_STAFF_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
