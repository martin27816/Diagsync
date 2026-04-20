import { ReviewStatus } from "@prisma/client";

export function canUseControlledEdit(role: string) {
  return role === "MD" || role === "HRM" || role === "SUPER_ADMIN";
}

export function requireEditReason(reason?: string) {
  return Boolean(reason?.trim());
}

export function nextVersionNumber(existingVersions: number[]) {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions) + 1;
}

export function shouldResetApproval(reviewStatus: ReviewStatus | null) {
  return reviewStatus === ReviewStatus.APPROVED;
}
