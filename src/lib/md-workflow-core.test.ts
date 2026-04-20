import assert from "node:assert/strict";
import { ReviewStatus, RoutingTaskStatus } from "@prisma/client";
import {
  canApprove,
  canEdit,
  canReject,
  canUseMdWorkflow,
  isTaskReviewable,
  requireRejectReason,
} from "./md-workflow-core";

function testPermissions() {
  assert.equal(canUseMdWorkflow("MD"), true);
  assert.equal(canUseMdWorkflow("SUPER_ADMIN"), true);
  assert.equal(canUseMdWorkflow("HRM"), true);
}

function testApprovalGuards() {
  assert.equal(canApprove(null), true);
  assert.equal(canApprove(ReviewStatus.PENDING), true);
  assert.equal(canApprove(ReviewStatus.REJECTED), true);
  assert.equal(canApprove(ReviewStatus.APPROVED), false);
}

function testRejectAndEditGuards() {
  assert.equal(canReject(ReviewStatus.PENDING), true);
  assert.equal(canReject(ReviewStatus.APPROVED), false);

  assert.equal(canEdit(ReviewStatus.PENDING), true);
  assert.equal(canEdit(ReviewStatus.REJECTED), true);
  assert.equal(canEdit(ReviewStatus.APPROVED), false);
}

function testTaskReviewable() {
  assert.equal(isTaskReviewable(RoutingTaskStatus.COMPLETED), true);
  assert.equal(isTaskReviewable(RoutingTaskStatus.IN_PROGRESS), true);
  assert.equal(isTaskReviewable(RoutingTaskStatus.PENDING), false);
  assert.equal(isTaskReviewable(RoutingTaskStatus.CANCELLED), false);
}

function testRejectReasonValidation() {
  assert.equal(requireRejectReason("wrong values"), true);
  assert.equal(requireRejectReason(" "), false);
  assert.equal(requireRejectReason(undefined), false);
}

function run() {
  testPermissions();
  testApprovalGuards();
  testRejectAndEditGuards();
  testTaskReviewable();
  testRejectReasonValidation();
  console.log("md-workflow-core tests passed");
}

run();
