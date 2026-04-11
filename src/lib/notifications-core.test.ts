import assert from "node:assert/strict";
import { NotificationType } from "@prisma/client";
import {
  buildNotificationDedupeKey,
  canAccessNotification,
  isPrivilegedOpsRole,
  mapTaskDepartmentToRole,
} from "./notifications-core";

function testAccessChecks() {
  assert.equal(canAccessNotification("u1", "u1"), true);
  assert.equal(canAccessNotification("u1", "u2"), false);
}

function testDedupeKey() {
  assert.equal(
    buildNotificationDedupeKey({
      userId: "u1",
      type: NotificationType.RESULT_APPROVED,
      entityId: "task1",
    }),
    "u1:RESULT_APPROVED:task1"
  );

  assert.equal(
    buildNotificationDedupeKey({
      userId: "u1",
      type: NotificationType.RESULT_APPROVED,
      entityId: "task1",
      key: "custom-key",
    }),
    "custom-key"
  );

  assert.equal(
    buildNotificationDedupeKey({
      userId: "u1",
      type: NotificationType.SYSTEM,
    }),
    null
  );
}

function testRoleHelpers() {
  assert.equal(isPrivilegedOpsRole("HRM"), true);
  assert.equal(isPrivilegedOpsRole("SUPER_ADMIN"), true);
  assert.equal(isPrivilegedOpsRole("MD"), false);
}

function testDepartmentRoleMap() {
  assert.equal(mapTaskDepartmentToRole("LABORATORY"), "LAB_SCIENTIST");
  assert.equal(mapTaskDepartmentToRole("RADIOLOGY"), "RADIOGRAPHER");
  assert.equal(mapTaskDepartmentToRole("MEDICAL_REVIEW"), null);
}

function run() {
  testAccessChecks();
  testDedupeKey();
  testRoleHelpers();
  testDepartmentRoleMap();
  console.log("notifications-core tests passed");
}

run();
