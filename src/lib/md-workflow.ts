import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { notifyTaskReviewOutcome } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  Department,
  OrderStatus,
  Prisma,
  ReviewStatus,
  Role,
  RoutingTaskStatus,
} from "@prisma/client";
import {
  canApprove,
  canEdit,
  canReject,
  canUseMdWorkflow,
  isTaskReviewable,
  requireRejectReason,
} from "./md-workflow-core";

export type MdActor = {
  id: string;
  role: string;
  organizationId: string;
};

type MdFilter = "all" | "pending" | "approved" | "rejected";

function assertMd(actor: MdActor) {
  if (!canUseMdWorkflow(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

async function getTaskForReview(taskId: string, actor: MdActor) {
  const task = await prisma.routingTask.findFirst({
    where: {
      id: taskId,
      organizationId: actor.organizationId,
      department: { in: [Department.LABORATORY, Department.RADIOLOGY] },
    },
    include: {
      visit: { include: { patient: true } },
      review: true,
      results: true,
      radiologyReport: true,
      imagingFiles: true,
      staff: { select: { id: true, fullName: true } },
    },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");
  if (!isTaskReviewable(task.status)) throw new Error("TASK_NOT_REVIEWABLE");
  return task;
}

export async function getMdReviewItems(actor: MdActor, filter: MdFilter = "pending") {
  assertMd(actor);

  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: actor.organizationId,
      department: { in: [Department.LABORATORY, Department.RADIOLOGY] },
      ...(filter === "pending"
        ? {
            testOrderIds: { isEmpty: false },
          }
        : {}),
    },
    include: {
      visit: { include: { patient: true } },
      review: true,
      staff: { select: { id: true, fullName: true } },
      imagingFiles: true,
      radiologyReport: true,
      results: {
        include: {
          testOrder: { include: { test: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = tasks.filter((task) => {
    const status = task.review?.status ?? ReviewStatus.PENDING;
    if (filter === "all") return true;
    if (filter === "pending") return status === ReviewStatus.PENDING;
    if (filter === "approved") return status === ReviewStatus.APPROVED;
    if (filter === "rejected") return status === ReviewStatus.REJECTED;
    return true;
  });

  const counts = {
    pending: tasks.filter((t) => (t.review?.status ?? ReviewStatus.PENDING) === ReviewStatus.PENDING).length,
    approved: tasks.filter((t) => t.review?.status === ReviewStatus.APPROVED).length,
    rejected: tasks.filter((t) => t.review?.status === ReviewStatus.REJECTED).length,
  };

  return { items: filtered, counts };
}

export async function approveMdReview(taskId: string, actor: MdActor, comments?: string) {
  assertMd(actor);
  const task = await getTaskForReview(taskId, actor);

  const currentStatus = task.review?.status ?? null;
  if (!canApprove(currentStatus)) throw new Error("ALREADY_APPROVED");

  if (task.department === Department.LABORATORY) {
    const hasAllSubmitted =
      task.results.length > 0 &&
      task.testOrderIds.every((id) =>
        task.results.some((r) => r.testOrderId === id && r.isSubmitted)
      );
    if (!hasAllSubmitted) throw new Error("NO_REVIEW_DATA");
  }

  if (task.department === Department.RADIOLOGY) {
    if (!task.radiologyReport || !task.radiologyReport.isSubmitted) {
      throw new Error("NO_REVIEW_DATA");
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { taskId: task.id },
      create: {
        organizationId: actor.organizationId,
        taskId: task.id,
        visitId: task.visitId,
        reviewedById: actor.id,
        status: ReviewStatus.APPROVED,
        comments,
      },
      update: {
        reviewedById: actor.id,
        status: ReviewStatus.APPROVED,
        comments,
        rejectionReason: null,
      },
    });

    const orders = await tx.testOrder.findMany({
      where: { id: { in: task.testOrderIds }, organizationId: actor.organizationId },
    });
    for (const order of orders) {
      await tx.testOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.APPROVED,
          reviewedAt: now,
          approvedAt: now,
        },
      });
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.MD,
    action: AUDIT_ACTIONS.RESULT_APPROVED,
    entityType: "Review",
    entityId: task.id,
    newValue: { status: "APPROVED", comments },
  });

  await notifyTaskReviewOutcome({
    organizationId: actor.organizationId,
    taskId: task.id,
    performerId: task.staffId,
    patientName: task.visit.patient.fullName,
    approved: true,
  });
}

export async function rejectMdReview(taskId: string, actor: MdActor, reason: string) {
  assertMd(actor);
  const task = await getTaskForReview(taskId, actor);

  const currentStatus = task.review?.status ?? null;
  if (!canReject(currentStatus)) throw new Error("ALREADY_APPROVED");
  if (!requireRejectReason(reason)) throw new Error("REASON_REQUIRED");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { taskId: task.id },
      create: {
        organizationId: actor.organizationId,
        taskId: task.id,
        visitId: task.visitId,
        reviewedById: actor.id,
        status: ReviewStatus.REJECTED,
        comments: reason,
        rejectionReason: reason,
      },
      update: {
        reviewedById: actor.id,
        status: ReviewStatus.REJECTED,
        comments: reason,
        rejectionReason: reason,
      },
    });

    await tx.routingTask.update({
      where: { id: task.id },
      data: { status: RoutingTaskStatus.IN_PROGRESS },
    });

    const orders = await tx.testOrder.findMany({
      where: { id: { in: task.testOrderIds }, organizationId: actor.organizationId },
    });
    for (const order of orders) {
      await tx.testOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.EDIT_REQUESTED,
          reviewedAt: now,
        },
      });
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.MD,
    action: AUDIT_ACTIONS.RESULT_REJECTED,
    entityType: "Review",
    entityId: task.id,
    newValue: { status: "REJECTED", reason },
  });

  await notifyTaskReviewOutcome({
    organizationId: actor.organizationId,
    taskId: task.id,
    performerId: task.staffId,
    patientName: task.visit.patient.fullName,
    approved: false,
    reason,
  });
}

export async function editMdReview(
  taskId: string,
  actor: MdActor,
  payload: {
    editedData: Prisma.InputJsonValue;
    comments?: string;
  }
) {
  assertMd(actor);
  const task = await getTaskForReview(taskId, actor);

  const currentStatus = task.review?.status ?? null;
  if (!canEdit(currentStatus)) throw new Error("EDIT_AFTER_APPROVAL");

  await prisma.$transaction(async (tx) => {
    if (task.department === Department.LABORATORY) {
      const data = payload.editedData as any;
      const items = Array.isArray(data?.testResults) ? data.testResults : [];
      for (const item of items) {
        if (!item?.testOrderId) continue;
        if (!task.testOrderIds.includes(item.testOrderId)) continue;
        await tx.labResult.upsert({
          where: {
            taskId_testOrderId: {
              taskId: task.id,
              testOrderId: item.testOrderId,
            },
          },
          create: {
            organizationId: actor.organizationId,
            taskId: task.id,
            testOrderId: item.testOrderId,
            staffId: task.staffId!,
            resultData: item.resultData ?? {},
            notes: item.notes ?? null,
            isSubmitted: true,
          },
          update: {
            resultData: item.resultData ?? {},
            notes: item.notes ?? null,
          },
        });
      }
    }

    if (task.department === Department.RADIOLOGY) {
      const data = payload.editedData as any;
      if (data?.report) {
        await tx.radiologyReport.update({
          where: { taskId: task.id },
          data: {
            findings: data.report.findings ?? task.radiologyReport?.findings ?? "",
            impression: data.report.impression ?? task.radiologyReport?.impression ?? "",
            notes: data.report.notes ?? task.radiologyReport?.notes ?? null,
          },
        });
      }
    }

    await tx.review.upsert({
      where: { taskId: task.id },
      create: {
        organizationId: actor.organizationId,
        taskId: task.id,
        visitId: task.visitId,
        reviewedById: actor.id,
        status: ReviewStatus.PENDING,
        comments: payload.comments,
        editedData: payload.editedData,
      },
      update: {
        reviewedById: actor.id,
        status: ReviewStatus.PENDING,
        comments: payload.comments,
        editedData: payload.editedData,
      },
    });
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.MD,
    action: AUDIT_ACTIONS.REVIEW_EDITED,
    entityType: "Review",
    entityId: task.id,
    newValue: { editedData: payload.editedData, comments: payload.comments },
  });
}
