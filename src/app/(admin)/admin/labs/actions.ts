"use server";

import { requireMegaAdmin } from "@/lib/admin-auth";
import { setOrganizationStatus } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";
import { syncFullTestCatalogToOrganization } from "@/lib/test-catalog";
import { revalidatePath } from "next/cache";
import { enrichOrganizationWithAi } from "@/lib/ai/lab-enrichment";
import { redirect } from "next/navigation";

export async function suspendLabAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  await setOrganizationStatus(id, "SUSPENDED");
  await prisma.organization.update({
    where: { id },
    data: {
      billingLockedAt: new Date(),
      billingLockReason: "Suspended by platform admin",
    },
  });
  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/analytics");
}

export async function activateLabAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  await setOrganizationStatus(id, "ACTIVE");
  await prisma.organization.update({
    where: { id },
    data: {
      billingLockedAt: null,
      billingLockReason: null,
    },
  });
  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/analytics");
}

export async function syncLabCatalogAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  await syncFullTestCatalogToOrganization(prisma, id);
  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${id}`);
}

export async function enrichLabProfileAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  const result = await enrichOrganizationWithAi(id);
  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${id}`);
  revalidatePath("/labs");

  const qs = new URLSearchParams();
  if (result.ok) {
    qs.set("ai", "success");
    qs.set("confidence", String(result.confidence));
  } else {
    qs.set("ai", result.reason);
    if ("aiReason" in result && typeof result.aiReason === "string") {
      qs.set("aiReason", result.aiReason);
    }
    if ("aiStatus" in result && typeof result.aiStatus === "number") {
      qs.set("aiStatus", String(result.aiStatus));
    }
    if ("confidence" in result && typeof result.confidence === "number") {
      qs.set("confidence", String(result.confidence));
    }
  }
  redirect(`/admin/labs/${id}?${qs.toString()}`);
}

export async function forceEnrichLabProfileAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  const result = await enrichOrganizationWithAi(id, { force: true });
  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${id}`);
  revalidatePath("/labs");

  const qs = new URLSearchParams();
  if (result.ok) {
    qs.set("ai", "force_success");
    qs.set("confidence", String(result.confidence));
  } else {
    qs.set("ai", `force_${result.reason}`);
    if ("aiReason" in result && typeof result.aiReason === "string") {
      qs.set("aiReason", result.aiReason);
    }
    if ("aiStatus" in result && typeof result.aiStatus === "number") {
      qs.set("aiStatus", String(result.aiStatus));
    }
    if ("confidence" in result && typeof result.confidence === "number") {
      qs.set("confidence", String(result.confidence));
    }
  }
  redirect(`/admin/labs/${id}?${qs.toString()}`);
}

export async function approvePaymentRequestAction(formData: FormData) {
  const admin = await requireMegaAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const paymentRequestId = String(formData.get("paymentRequestId") ?? "");
  if (!organizationId || !paymentRequestId) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const request = await tx.subscriptionPaymentRequest.findFirst({
      where: {
        id: paymentRequestId,
        organizationId,
      },
      select: {
        id: true,
        requestedPlan: true,
        status: true,
      },
    });

    if (!request || request.status !== "PENDING") {
      throw new Error("PAYMENT_REQUEST_NOT_PENDING");
    }

    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        subscriptionEndsAt: true,
      },
    });

    if (!organization) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const baseDate =
      organization.subscriptionEndsAt && organization.subscriptionEndsAt > now
        ? organization.subscriptionEndsAt
        : now;
    const subscriptionEndsAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await tx.subscriptionPaymentRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: now,
      },
    });

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        plan: request.requestedPlan,
        status: "ACTIVE",
        subscriptionStartedAt: organization.subscriptionEndsAt && organization.subscriptionEndsAt > now ? organization.subscriptionEndsAt : now,
        subscriptionEndsAt,
        lastPaymentAt: now,
        watermarkEnabled: request.requestedPlan === "STARTER",
        staffLimit: request.requestedPlan === "STARTER" ? 15 : null,
        billingLockedAt: null,
        billingLockReason: null,
      },
    });
  });

  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${organizationId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/analytics");
}

export async function rejectPaymentRequestAction(formData: FormData) {
  const admin = await requireMegaAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const paymentRequestId = String(formData.get("paymentRequestId") ?? "");
  const rejectionNote = String(formData.get("rejectionNote") ?? "").trim();
  if (!organizationId || !paymentRequestId) return;

  await prisma.$transaction(async (tx) => {
    const request = await tx.subscriptionPaymentRequest.findFirst({
      where: {
        id: paymentRequestId,
        organizationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!request || request.status !== "PENDING") {
      throw new Error("PAYMENT_REQUEST_NOT_PENDING");
    }

    await tx.subscriptionPaymentRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        notes: rejectionNote || "Payment request rejected after review",
      },
    });
  });

  revalidatePath("/admin/labs");
  revalidatePath(`/admin/labs/${organizationId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/analytics");
}
