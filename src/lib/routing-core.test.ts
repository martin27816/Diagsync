import assert from "node:assert/strict";
import { Department, Priority, Role } from "@prisma/client";
import {
  chooseLeastLoadedStaff,
  DEPARTMENT_ROLE_MAP,
  getPriorityWeight,
  sortByPriorityHighToLow,
} from "./routing-core";

function testPriorityWeight() {
  assert.equal(getPriorityWeight("STAT"), 3);
  assert.equal(getPriorityWeight(Priority.EMERGENCY), 3);
  assert.equal(getPriorityWeight(Priority.URGENT), 2);
  assert.equal(getPriorityWeight("NORMAL"), 1);
  assert.equal(getPriorityWeight(Priority.ROUTINE), 1);
}

function testPrioritySort() {
  const items = [
    { id: "a", priority: Priority.ROUTINE },
    { id: "b", priority: Priority.URGENT },
    { id: "c", priority: Priority.EMERGENCY },
  ];

  const sorted = sortByPriorityHighToLow(items);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "b", "a"]
  );
}

function testLeastLoadedSelection() {
  const selected = chooseLeastLoadedStaff([
    { id: "1", fullName: "Zara", workload: 3 },
    { id: "2", fullName: "Ada", workload: 1 },
    { id: "3", fullName: "Bola", workload: 1 },
  ]);

  assert.ok(selected);
  assert.equal(selected?.id, "2");
}

function testDepartmentRoleMapping() {
  assert.equal(DEPARTMENT_ROLE_MAP[Department.LABORATORY], Role.LAB_SCIENTIST);
  assert.equal(DEPARTMENT_ROLE_MAP[Department.RADIOLOGY], Role.RADIOGRAPHER);
}

function run() {
  testPriorityWeight();
  testPrioritySort();
  testLeastLoadedSelection();
  testDepartmentRoleMapping();
  console.log("routing-core tests passed");
}

run();

