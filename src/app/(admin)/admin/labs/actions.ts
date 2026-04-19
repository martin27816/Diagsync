"use server";

import { requireMegaAdmin } from "@/lib/admin-auth";
import { setOrganizationStatus } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";
import { syncFullTestCatalogToOrganization } from "@/lib/test-catalog";
import { revalidatePath } from "next/cache";

export async function suspendLabAction(formData: FormData) {
  await requireMegaAdmin();
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  await setOrganizationStatus(id, "SUSPENDED");
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
