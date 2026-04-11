import assert from "node:assert/strict";
import { Department, Priority, RoutingTaskStatus } from "@prisma/client";
import {
  averageCompletionMinutes,
  canUseHrmDashboard,
  isOverloaded,
  isTaskDelayed,
  staffWorkload,
  tasksPerDepartment,
} from "./hrm-monitoring-core";

function makeTask(
  overrides: Partial<{
    id: string;
    status: RoutingTaskStatus;
    priority: Priority;
    department: Department;
    createdAt: Date;
    completedAt: Date | null;
    expectedMinutes: number;
    staffId: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "t1",
    status: overrides.status ?? RoutingTaskStatus.PENDING,
    priority: overrides.priority ?? Priority.ROUTINE,
    department: overrides.department ?? Department.LABORATORY,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T10:00:00Z"),
    completedAt: overrides.completedAt,
    expectedMinutes: overrides.expectedMinutes ?? 60,
    staffId: overrides.staffId ?? null,
  };
}

function testPermissions() {
  assert.equal(canUseHrmDashboard("HRM"), true);
  assert.equal(canUseHrmDashboard("SUPER_ADMIN"), true);
  assert.equal(canUseHrmDashboard("LAB_SCIENTIST"), false);
}

function testDelayDetection() {
  const now = new Date("2026-01-01T12:30:00Z");

  const delayed = makeTask({
    status: RoutingTaskStatus.PENDING,
    expectedMinutes: 60,
    createdAt: new Date("2026-01-01T10:00:00Z"),
  });
  assert.equal(isTaskDelayed(delayed, now), true);

  const notDelayed = makeTask({
    status: RoutingTaskStatus.IN_PROGRESS,
    expectedMinutes: 180,
    createdAt: new Date("2026-01-01T11:30:00Z"),
  });
  assert.equal(isTaskDelayed(notDelayed, now), false);

  const completed = makeTask({ status: RoutingTaskStatus.COMPLETED, expectedMinutes: 10 });
  assert.equal(isTaskDelayed(completed, now), false);
}

function testAverageCompletion() {
  const tasks = [
    makeTask({
      id: "a",
      status: RoutingTaskStatus.COMPLETED,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      completedAt: new Date("2026-01-01T10:30:00Z"),
    }),
    makeTask({
      id: "b",
      status: RoutingTaskStatus.COMPLETED,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      completedAt: new Date("2026-01-01T11:00:00Z"),
    }),
  ];

  assert.equal(averageCompletionMinutes(tasks), 45);
  assert.equal(averageCompletionMinutes([makeTask({ status: RoutingTaskStatus.PENDING })]), 0);
}

function testTasksPerDepartment() {
  const counts = tasksPerDepartment([
    makeTask({ id: "1", department: Department.LABORATORY }),
    makeTask({ id: "2", department: Department.RADIOLOGY }),
    makeTask({ id: "3", department: Department.LABORATORY }),
  ]);

  assert.equal(counts.LABORATORY, 2);
  assert.equal(counts.RADIOLOGY, 1);
}

function testStaffWorkload() {
  const map = staffWorkload([
    makeTask({ id: "1", staffId: "s1", status: RoutingTaskStatus.PENDING }),
    makeTask({ id: "2", staffId: "s1", status: RoutingTaskStatus.IN_PROGRESS }),
    makeTask({ id: "3", staffId: "s1", status: RoutingTaskStatus.COMPLETED }),
    makeTask({ id: "4", staffId: "s2", status: RoutingTaskStatus.COMPLETED }),
  ]);

  assert.deepEqual(map.get("s1"), { assigned: 3, active: 2, completed: 1 });
  assert.deepEqual(map.get("s2"), { assigned: 1, active: 0, completed: 1 });
}

function testOverloaded() {
  assert.equal(isOverloaded(8), true);
  assert.equal(isOverloaded(7), false);
  assert.equal(isOverloaded(4, 4), true);
}

function run() {
  testPermissions();
  testDelayDetection();
  testAverageCompletion();
  testTasksPerDepartment();
  testStaffWorkload();
  testOverloaded();
  console.log("hrm-monitoring-core tests passed");
}

run();
