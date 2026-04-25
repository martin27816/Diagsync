import { OrganizationPlan, OrganizationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveOrganizationStatus, getOrganizationAccess } from "@/lib/billing-access";

export const organizationBillingSelect = {
  id: true,
  name: true,
  email: true,
  plan: true,
  status: true,
  trialStartedAt: true,
  trialEndsAt: true,
  subscriptionStartedAt: true,
  subscriptionEndsAt: true,
  lastPaymentAt: true,
  watermarkEnabled: true,
  staffLimit: true,
  billingLockedAt: true,
  billingLockReason: true,
  logo: true,
  letterheadUrl: true,
  address: true,
  phone: true,
  contactInfo: true,
} satisfies Prisma.OrganizationSelect;

export async function syncOrganizationBillingState(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: organizationBillingSelect,
  });

  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  const now = new Date();
  const nextStatus = getEffectiveOrganizationStatus(organization, now);
  const updates: Prisma.OrganizationUpdateInput = {};

  if (nextStatus !== organization.status) {
    updates.status = nextStatus;
  }

  if (nextStatus === "TRIAL_EXPIRED" && !organization.billingLockedAt) {
    updates.billingLockedAt = now;
    updates.billingLockReason = "Trial expired";
  }

  if (nextStatus === "EXPIRED" && !organization.billingLockedAt) {
    updates.billingLockedAt = now;
    updates.billingLockReason = "Subscription expired";
  }

  if ((nextStatus === "ACTIVE" || nextStatus === "TRIAL_ACTIVE") && organization.billingLockedAt) {
    updates.billingLockedAt = null;
    updates.billingLockReason = null;
  }

  if (Object.keys(updates).length === 0) {
    return organization;
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: updates,
    select: organizationBillingSelect,
  });
}

export async function requireOrganizationCoreAccess(organizationId: string) {
  const organization = await syncOrganizationBillingState(organizationId);
  const access = getOrganizationAccess(organization);
  if (access.billingLocked) {
    throw new Error("BILLING_LOCKED");
  }
  return { organization, access };
}

export async function requireOrganizationFeature(
  organizationId: string,
  feature: "radiology" | "cardiology" | "imaging" | "web_push" | "custom_letterhead"
) {
  const organization = await syncOrganizationBillingState(organizationId);
  const access = getOrganizationAccess(organization);

  if (access.billingLocked) {
    throw new Error("BILLING_LOCKED");
  }

  const allowed =
    feature === "radiology"
      ? access.canUseRadiology
      : feature === "cardiology"
      ? access.canUseCardiology
      : feature === "imaging"
      ? access.canUploadImaging
      : feature === "web_push"
      ? access.canUseWebPush
      : access.canUseCustomLetterhead;

  if (!allowed) {
    throw new Error("FEATURE_NOT_AVAILABLE");
  }

  return { organization, access };
}

export function getPlanDefaults(plan: OrganizationPlan) {
  if (plan === "STARTER") {
    return {
      watermarkEnabled: true,
      staffLimit: 15,
      status: "ACTIVE" as OrganizationStatus,
    };
  }

  return {
    watermarkEnabled: false,
    staffLimit: null,
    status: "ACTIVE" as OrganizationStatus,
  };
}

