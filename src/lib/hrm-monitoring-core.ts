import { Department, Priority, RoutingTaskStatus } from "@prisma/client";

export type TaskForMetrics = {
  id: string;
  status: RoutingTaskStatus;
  priority: Priority;
  department: Department;
  createdAt: Date;
  completedAt?: Date | null;
  expectedMinutes: number;
  staffId?: string | null;
};

export function canUseHrmDashboard(role: string) {
  return role === "HRM" || role === "SUPER_ADMIN";
}

export function isTaskDelayed(task: TaskForMetrics, now = new Date()) {
  if (task.status === RoutingTaskStatus.COMPLETED || task.status === RoutingTaskStatus.CANCELLED) {
    return false;
  }
  const expectedMs = Math.max(task.expectedMinutes, 1) * 60 * 1000;
  return now.getTime() - task.createdAt.getTime() > expectedMs;
}

export function averageCompletionMinutes(tasks: TaskForMetrics[]) {
  const completed = tasks.filter((t) => t.status === RoutingTaskStatus.COMPLETED && t.completedAt);
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, task) => {
    const ms = (task.completedAt as Date).getTime() - task.createdAt.getTime();
    return sum + Math.max(ms, 0);
  }, 0);
  return Math.round(total / completed.length / 60000);
}

export function tasksPerDepartment(tasks: TaskForMetrics[]) {
  return tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.department] = (acc[t.department] ?? 0) + 1;
    return acc;
  }, {});
}

export function staffWorkload(tasks: TaskForMetrics[]) {
  const map = new Map<string, { assigned: number; active: number; completed: number }>();
  for (const task of tasks) {
    if (!task.staffId) continue;
    const current = map.get(task.staffId) ?? { assigned: 0, active: 0, completed: 0 };
    current.assigned += 1;
    if (task.status === RoutingTaskStatus.COMPLETED) current.completed += 1;
    if (task.status === RoutingTaskStatus.PENDING || task.status === RoutingTaskStatus.IN_PROGRESS) {
      current.active += 1;
    }
    map.set(task.staffId, current);
  }
  return map;
}

export function isOverloaded(activeTaskCount: number, threshold = 8) {
  return activeTaskCount >= threshold;
}

