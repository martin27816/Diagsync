import { ReviewStatus, RoutingTaskStatus } from "@prisma/client";

export function canUseMdWorkflow(role: string) {
  return role === "MD" || role === "HRM" || role === "SUPER_ADMIN";
}

export function canApprove(reviewStatus: ReviewStatus | null) {
  return reviewStatus !== ReviewStatus.APPROVED;
}

export function canReject(reviewStatus: ReviewStatus | null) {
  return reviewStatus !== ReviewStatus.APPROVED;
}

export function canEdit(reviewStatus: ReviewStatus | null) {
  return reviewStatus !== ReviewStatus.APPROVED;
}

export function requireRejectReason(reason?: string) {
  return Boolean(reason?.trim());
}

export function isTaskReviewable(taskStatus: RoutingTaskStatus) {
  return taskStatus === RoutingTaskStatus.COMPLETED || taskStatus === RoutingTaskStatus.IN_PROGRESS;
}
