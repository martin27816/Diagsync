import assert from "node:assert/strict";
import { RoutingTaskStatus } from "@prisma/client";
import {
  canModifyRadiologyTask,
  canStartRadiologyTask,
  canSubmitRadiologyTask,
  hasRequiredReportFields,
  isValidImagingFile,
  MAX_IMAGING_SIZE_BYTES,
} from "./radiology-workflow-core";

function testPermissions() {
  assert.equal(
    canModifyRadiologyTask({ userRole: "RADIOGRAPHER", userId: "u1", assignedStaffId: "u1" }),
    true
  );
  assert.equal(
    canModifyRadiologyTask({ userRole: "RADIOGRAPHER", userId: "u2", assignedStaffId: "u1" }),
    false
  );
  assert.equal(
    canModifyRadiologyTask({ userRole: "LAB_SCIENTIST", userId: "u1", assignedStaffId: "u1" }),
    false
  );
}

function testLifecycle() {
  assert.equal(canStartRadiologyTask(RoutingTaskStatus.PENDING), true);
  assert.equal(canStartRadiologyTask(RoutingTaskStatus.IN_PROGRESS), true);
  assert.equal(canStartRadiologyTask(RoutingTaskStatus.COMPLETED), false);

  assert.equal(canSubmitRadiologyTask(RoutingTaskStatus.PENDING), true);
  assert.equal(canSubmitRadiologyTask(RoutingTaskStatus.IN_PROGRESS), true);
  assert.equal(canSubmitRadiologyTask(RoutingTaskStatus.COMPLETED), false);
}

function testFileValidation() {
  assert.equal(
    isValidImagingFile({ mimeType: "image/jpeg", sizeBytes: 1024 }),
    true
  );
  assert.equal(
    isValidImagingFile({ mimeType: "text/plain", sizeBytes: 1024 }),
    false
  );
  assert.equal(
    isValidImagingFile({ mimeType: "image/png", sizeBytes: MAX_IMAGING_SIZE_BYTES + 1 }),
    false
  );
}

function testReportValidation() {
  assert.equal(
    hasRequiredReportFields({ findings: "Lungs clear", impression: "Normal chest" }),
    true
  );
  assert.equal(
    hasRequiredReportFields({ findings: "Lungs clear", impression: "" }),
    false
  );
}

function run() {
  testPermissions();
  testLifecycle();
  testFileValidation();
  testReportValidation();
  console.log("radiology-workflow-core tests passed");
}

run();

