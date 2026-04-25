import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrganizationAccess, PLAN_MONTHLY_AMOUNT_NGN } from "@/lib/billing-access";
import { syncOrganizationBillingState } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.organizationId) {
    return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
  }

  try {
    const [organization, paymentRequests] = await Promise.all([
      syncOrganizationBillingState(user.organizationId),
      prisma.subscriptionPaymentRequest.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          requestedPlan: true,
          amount: true,
          status: true,
          transactionReference: true,
          proofUrl: true,
          notes: true,
          reviewedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        organization,
        access: getOrganizationAccess(organization),
        pricing: {
          STARTER: PLAN_MONTHLY_AMOUNT_NGN.STARTER,
          ADVANCED: PLAN_MONTHLY_AMOUNT_NGN.ADVANCED,
        },
        paymentRequests,
      },
    });
  } catch (error) {
    console.error("[BILLING_OVERVIEW_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
