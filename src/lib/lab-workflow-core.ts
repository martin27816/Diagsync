import { Priority, RoutingTaskStatus, SampleStatus } from "@prisma/client";

const PRIORITY_RANK: Record<Priority, number> = {
  EMERGENCY: 3,
  URGENT: 2,
  ROUTINE: 1,
};

export function canModifyAssignedTask(params: {
  userRole: string;
  userId: string;
  assignedStaffId: string | null;
}) {
  if (params.userRole !== "LAB_SCIENTIST") return false;
  if (!params.assignedStaffId) return false;
  return params.userId === params.assignedStaffId;
}

export function canStartTask(status: RoutingTaskStatus) {
  return status === RoutingTaskStatus.PENDING || status === RoutingTaskStatus.IN_PROGRESS;
}

export function canSubmitTask(status: RoutingTaskStatus) {
  return status !== RoutingTaskStatus.COMPLETED && status !== RoutingTaskStatus.CANCELLED;
}

export function sampleStatusToOrderStage(status: SampleStatus) {
  switch (status) {
    case SampleStatus.COLLECTED:
      return "SAMPLE_COLLECTED";
    case SampleStatus.PROCESSING:
      return "IN_PROGRESS";
    case SampleStatus.DONE:
      return "RESULT_DRAFTED";
    default:
      return null;
  }
}

export function hasResultsForAllTests(taskTestOrderIds: string[], resultTestOrderIds: string[]) {
  const set = new Set(resultTestOrderIds);
  return taskTestOrderIds.every((id) => set.has(id));
}

export function sortByPriorityAndTime<T extends { priority: Priority; createdAt: Date }>(
  rows: T[],
  order: "asc" | "desc" = "desc"
) {
  return [...rows].sort((a, b) => {
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return order === "desc"
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : a.createdAt.getTime() - b.createdAt.getTime();
  });
}

