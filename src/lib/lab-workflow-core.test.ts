import assert from "node:assert/strict";
import { RoutingTaskStatus } from "@prisma/client";
import {
  canModifyAssignedTask,
  canStartTask,
  canSubmitTask,
  hasResultsForAllTests,
  sortByPriorityAndTime,
  applySharedSensitivity,
} from "./lab-workflow-core";

function testPermissionEnforcement() {
  assert.equal(
    canModifyAssignedTask({ userRole: "LAB_SCIENTIST", userId: "u1", assignedStaffId: "u1" }),
    true
  );
  assert.equal(
    canModifyAssignedTask({ userRole: "LAB_SCIENTIST", userId: "u2", assignedStaffId: "u1" }),
    true
  );
  assert.equal(
    canModifyAssignedTask({ userRole: "LAB_SCIENTIST", userId: "u2", assignedStaffId: null }),
    true
  );
  assert.equal(
    canModifyAssignedTask({ userRole: "HRM", userId: "u1", assignedStaffId: "u1" }),
    false
  );
}

function testTaskLifecycleGuards() {
  assert.equal(canStartTask(RoutingTaskStatus.PENDING), true);
  assert.equal(canStartTask(RoutingTaskStatus.IN_PROGRESS), true);
  assert.equal(canStartTask(RoutingTaskStatus.COMPLETED), false);

  assert.equal(canSubmitTask(RoutingTaskStatus.PENDING), true);
  assert.equal(canSubmitTask(RoutingTaskStatus.IN_PROGRESS), true);
  assert.equal(canSubmitTask(RoutingTaskStatus.COMPLETED), false);
}

function testResultSubmissionValidation() {
  assert.equal(
    hasResultsForAllTests(["a", "b"], ["a", "b", "c"]),
    true
  );
  assert.equal(
    hasResultsForAllTests(["a", "b"], ["a"]),
    false
  );
}

function testPrioritySort() {
  const rows = sortByPriorityAndTime(
    [
      { id: "1", priority: "ROUTINE" as const, createdAt: new Date("2026-01-01T10:00:00Z") },
      { id: "2", priority: "EMERGENCY" as const, createdAt: new Date("2026-01-01T09:00:00Z") },
      { id: "3", priority: "URGENT" as const, createdAt: new Date("2026-01-01T11:00:00Z") },
    ],
    "desc"
  );

  assert.deepEqual(rows.map((r) => r.id), ["2", "3", "1"]);
}

function testSharedSensitivityMerge() {
  const merged = applySharedSensitivity(
    [
      { testOrderId: "o1", resultData: { microscopy: "Few", sensitivity: "Ciprofloxacin" } },
      { testOrderId: "o2", resultData: { microscopy: "Many" } },
      { testOrderId: "o3", resultData: { notes: "n/a" } },
    ],
    new Set(["o1", "o2"])
  );
  const order2 = merged.find((row) => row.testOrderId === "o2");
  assert.equal(order2?.resultData?.sensitivity, "Ciprofloxacin");
}

function run() {
  testPermissionEnforcement();
  testTaskLifecycleGuards();
  testResultSubmissionValidation();
  testPrioritySort();
  testSharedSensitivityMerge();
  console.log("lab-workflow-core tests passed");
}

run();
