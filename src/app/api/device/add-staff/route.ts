import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { createDeviceToken } from "@/lib/device-tokens";
import { ensureDeviceInOrganization, requireSessionStaffContext, toSafeStaffSummary } from "@/lib/device-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceKey: z.string().min(10, "Invalid device key"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password is required"),
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
    const { deviceKey, email, password } = parsed.data;
    const existing = await ensureDeviceInOrganization(deviceKey, actor.organizationId!);
    if (existing === "OTHER_ORGANIZATION") {
      return NextResponse.json({ success: false, error: "This device belongs to another organization" }, { status: 409 });
    }

    const device =
      existing ??
      (await prisma.device.create({
        data: { deviceKey, organizationId: actor.organizationId! },
        select: { id: true, deviceKey: true, organizationId: true },
      }));

    const candidate = await prisma.staff.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        organizationId: true,
        status: true,
        passwordHash: true,
        pinHash: true,
      },
    });

    if (!candidate) {
      return NextResponse.json({ success: false, error: "Invalid staff email or password" }, { status: 401 });
    }
    if (candidate.organizationId !== actor.organizationId) {
      return NextResponse.json({ success: false, error: "Staff must belong to this organization" }, { status: 403 });
    }
    if (candidate.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "This staff account is inactive" }, { status: 403 });
    }

    const passwordOk = await bcrypt.compare(password, candidate.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ success: false, error: "Invalid staff email or password" }, { status: 401 });
    }

    const link = await prisma.deviceStaff.findUnique({
      where: {
        deviceId_staffId: {
          deviceId: device.id,
          staffId: candidate.id,
        },
      },
      select: { id: true },
    });
    if (link) {
      return NextResponse.json({ success: false, error: "Staff already exists on this device" }, { status: 409 });
    }

    await prisma.deviceStaff.create({
      data: {
        deviceId: device.id,
        staffId: candidate.id,
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "STAFF_ADDED_TO_DEVICE",
      entityType: "DeviceStaff",
      entityId: candidate.id,
      changes: {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        targetStaffId: candidate.id,
      },
      ...getAuditMetaFromRequest(req),
    });

    const pinSetupToken =
      !candidate.pinHash
        ? createDeviceToken(
            "pin_setup",
            {
              staffId: candidate.id,
              organizationId: actor.organizationId!,
              deviceKey: device.deviceKey,
            },
            10 * 60
          )
        : null;

    return NextResponse.json({
      success: true,
      data: {
        staff: toSafeStaffSummary(candidate),
        requiresPinSetup: !candidate.pinHash,
        pinSetupToken,
      },
      message: "Staff added to this device",
    });
  } catch (error) {
    console.error("[DEVICE_ADD_STAFF_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
