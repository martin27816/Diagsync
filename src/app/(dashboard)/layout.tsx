import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Role } from "@prisma/client";
import { BillingOnboarding } from "@/components/billing/billing-onboarding";
import { getOrganizationAccess } from "@/lib/billing-access";
import { syncOrganizationBillingState } from "@/lib/billing-service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    include: {
      organization: true,
    },
  });

  if (!staff || staff.status !== "ACTIVE") {
    redirect("/login");
  }

  if (staff.role === "MEGA_ADMIN") {
    redirect("/admin/dashboard");
  }

  if (!staff.organizationId || !staff.organization) {
    redirect("/login");
  }

  const organization = await syncOrganizationBillingState(staff.organizationId);
  const access = getOrganizationAccess(organization);
  const canManageBilling = staff.role === "SUPER_ADMIN";

  const operationalRoles: Role[] = ["LAB_SCIENTIST", "RADIOGRAPHER", "MD", "RECEPTIONIST"];
  const showAvailability = operationalRoles.includes(staff.role);
  const paymentRequests = canManageBilling
    ? await prisma.subscriptionPaymentRequest.findMany({
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
      })
    : [];

  const trialBanner =
    access.status === "TRIAL_ACTIVE" && access.trialDaysLeft !== null
      ? {
          text: `Trial ends in ${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? "" : "s"}.`,
          warning: access.isTrialWarning,
        }
      : access.status === "ACTIVE" &&
        organization.plan !== "TRIAL" &&
        access.subscriptionDaysLeft !== null
      ? {
          text: `Subscription ends in ${access.subscriptionDaysLeft} day${
            access.subscriptionDaysLeft === 1 ? "" : "s"
          }.`,
          warning: access.subscriptionDaysLeft < 3,
        }
      : null;

  return (
    <DashboardShell
      user={{
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        organizationName: staff.organization?.name,
      }}
      staffId={staff.id}
      staffName={staff.fullName}
      role={staff.role}
      initialAvailability={staff.availabilityStatus === "AVAILABLE"}
      showAvailabilityToggle={showAvailability}
      trialBanner={trialBanner}
    >
      {access.billingLocked ? (
        canManageBilling ? (
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
              subscriptionDaysLeft: access.subscriptionDaysLeft,
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
        ) : (
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            Your free trial has ended. Choose a plan from the Super Admin to continue.
          </div>
        )
      ) : (
        children
      )}
    </DashboardShell>
  );
}
