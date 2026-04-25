import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.organizationId) {
    return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, trialStartedAt: true, status: true },
    });
    if (!organization) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }

    if (organization.trialStartedAt) {
      return NextResponse.json(
        { success: false, error: "Free trial has already been used for this organization." },
        { status: 409 }
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        plan: "TRIAL",
        status: "TRIAL_ACTIVE",
        trialStartedAt: now,
        trialEndsAt,
        watermarkEnabled: true,
        staffLimit: null,
        billingLockedAt: null,
        billingLockReason: null,
      },
      select: {
        id: true,
        plan: true,
        status: true,
        trialStartedAt: true,
        trialEndsAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Free trial started. You now have full access for 14 days.",
      data: updated,
    });
  } catch (error) {
    console.error("[BILLING_TRIAL_START_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
