import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncOrganizationBillingState } from "@/lib/billing-service";
import { getOrganizationAccess } from "@/lib/billing-access";
import { BillingOnboarding } from "@/components/billing/billing-onboarding";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as any;
  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      status: true,
      organizationId: true,
    },
  });

  if (!staff || staff.status !== "ACTIVE") {
    redirect("/login");
  }

  if (!staff.organizationId) {
    redirect("/dashboard");
  }

  if (staff.role === "MEGA_ADMIN") {
    redirect("/admin/dashboard");
  }

  if (staff.role !== "SUPER_ADMIN") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-700">
        Billing management is available to your Super Admin only.
      </div>
    );
  }

  const [organization, paymentRequests] = await Promise.all([
    syncOrganizationBillingState(staff.organizationId),
    prisma.subscriptionPaymentRequest.findMany({
      where: { organizationId: staff.organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        requestedPlan: true,
        amount: true,
        status: true,
        transactionReference: true,
        createdAt: true,
      },
    }),
  ]);

  const access = getOrganizationAccess(organization);

  return (
    <BillingOnboarding
      organization={{
        plan: organization.plan,
        status: organization.status,
        trialStartedAt: organization.trialStartedAt?.toISOString() ?? null,
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        subscriptionEndsAt: organization.subscriptionEndsAt?.toISOString() ?? null,
      }}
      access={{
        trialDaysLeft: access.trialDaysLeft,
        isTrialWarning: access.isTrialWarning,
        billingLocked: access.billingLocked,
      }}
      paymentRequests={paymentRequests.map((item) => ({
        id: item.id,
        requestedPlan: item.requestedPlan,
        amount: Number(item.amount),
        status: item.status,
        transactionReference: item.transactionReference,
        createdAt: item.createdAt.toISOString(),
      }))}
    />
  );
}
