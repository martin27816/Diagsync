import { Department, OrderStatus, Priority, Role } from "@prisma/client";

export const DEPARTMENT_ROLE_MAP: Partial<Record<Department, Role>> = {
  [Department.LABORATORY]: Role.LAB_SCIENTIST,
  [Department.RADIOLOGY]: Role.RADIOGRAPHER,
};

export const ACTIVE_WORKLOAD_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.OPENED,
  OrderStatus.SAMPLE_PENDING,
  OrderStatus.SAMPLE_COLLECTED,
  OrderStatus.IN_PROGRESS,
  OrderStatus.RESULT_DRAFTED,
  OrderStatus.EDIT_REQUESTED,
  OrderStatus.RESUBMITTED,
];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.ROUTINE]: 1,
  [Priority.URGENT]: 2,
  [Priority.EMERGENCY]: 3,
};

export type QueuePriority = Priority | "STAT" | "NORMAL";

export type WorkloadCandidate = {
  id: string;
  fullName: string;
  workload: number;
};

export function getPriorityWeight(priority: QueuePriority): number {
  if (priority === "STAT") return 3;
  if (priority === "NORMAL") return 1;
  return PRIORITY_WEIGHT[priority];
}

export function sortByPriorityHighToLow<T extends { priority: QueuePriority }>(items: T[]): T[] {
  return [...items].sort((a, b) => getPriorityWeight(b.priority) - getPriorityWeight(a.priority));
}

export function chooseLeastLoadedStaff(candidates: WorkloadCandidate[]): WorkloadCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (a.workload !== b.workload) return a.workload - b.workload;
    return a.fullName.localeCompare(b.fullName);
  })[0];
}

