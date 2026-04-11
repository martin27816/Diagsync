import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import type { AuditMeta } from "@/lib/audit-core";
import { notifyResultEdited, notifyTaskReviewOutcome } from "@/lib/notifications";
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
  canReject,
  canUseMdWorkflow,
  isTaskReviewable,
  requireRejectReason,
} from "./md-workflow-core";
import {
  canUseControlledEdit,
  nextVersionNumber,
  requireEditReason,
  shouldResetApproval,
} from "./edit-system-core";
import { pickActiveVersion } from "./edit-versioning-core";
import { ensureDraftReportForTask } from "./report-workflow";

export type MdActor = {
  id: string;
  role: string;
  organizationId: string;
  auditMeta?: AuditMeta;
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
      results: {
        include: {
          versions: {
            include: { editedBy: { select: { id: true, fullName: true } } },
            orderBy: { version: "desc" },
          },
        },
      },
      radiologyReport: {
        include: {
          versions: {
            include: { editedBy: { select: { id: true, fullName: true } } },
            orderBy: { version: "desc" },
          },
        },
      },
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
      radiologyReport: {
        include: {
          versions: {
            include: { editedBy: { select: { id: true, fullName: true } } },
            orderBy: { version: "desc" },
          },
        },
      },
      results: {
        include: {
          testOrder: { include: { test: true } },
          versions: {
            include: { editedBy: { select: { id: true, fullName: true } } },
            orderBy: { version: "desc" },
          },
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
  const items = filtered.map((task) => {
    const results = task.results.map((result) => {
      const activeVersion = pickActiveVersion(result.versions) ?? result.versions[0] ?? null;
      return {
        ...result,
        currentVersion: activeVersion?.version ?? 1,
        resultData: activeVersion?.resultData ?? result.resultData,
        notes: activeVersion?.notes ?? result.notes,
        versionHistory: result.versions.map((version) => ({
          id: version.id,
          version: version.version,
          isActive: version.isActive,
          parentId: version.parentId,
          resultData: version.resultData,
          notes: version.notes,
          editReason: version.editReason,
          editedBy: version.editedBy,
          createdAt: version.createdAt,
        })),
      };
    });

    const activeReportVersion = task.radiologyReport
      ? pickActiveVersion(task.radiologyReport.versions) ?? task.radiologyReport.versions[0] ?? null
      : null;
    const radiologyReport = task.radiologyReport
      ? {
          ...task.radiologyReport,
          currentVersion: activeReportVersion?.version ?? 1,
          findings: activeReportVersion?.findings ?? task.radiologyReport.findings,
          impression: activeReportVersion?.impression ?? task.radiologyReport.impression,
          notes: activeReportVersion?.notes ?? task.radiologyReport.notes,
          versionHistory: task.radiologyReport.versions.map((version) => ({
            id: version.id,
            version: version.version,
            isActive: version.isActive,
            parentId: version.parentId,
            findings: version.findings,
            impression: version.impression,
            notes: version.notes,
            editReason: version.editReason,
            editedBy: version.editedBy,
            createdAt: version.createdAt,
          })),
        }
      : null;

    return {
      ...task,
      results,
      radiologyReport,
    };
  });

  return { items, counts };
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
    ...actor.auditMeta,
  });

  await notifyTaskReviewOutcome({
    organizationId: actor.organizationId,
    taskId: task.id,
    performerId: task.staffId,
    patientName: task.visit.patient.fullName,
    approved: true,
  });

  await ensureDraftReportForTask(task.id, actor);
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
    ...actor.auditMeta,
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
    reason: string;
    comments?: string;
  }
) {
  if (!canUseControlledEdit(actor.role)) throw new Error("FORBIDDEN_ROLE");
  if (!requireEditReason(payload.reason)) throw new Error("REASON_REQUIRED");

  const task = await getTaskForReview(taskId, actor);
  const currentStatus = task.review?.status ?? null;
  const resetApproval = shouldResetApproval(currentStatus);
  const now = new Date();
  const versionTrace: string[] = [];

  await prisma.$transaction(async (tx) => {
    if (task.department === Department.LABORATORY) {
      const data = payload.editedData as any;
      const items = Array.isArray(data?.testResults) ? data.testResults : [];
      if (items.length === 0) throw new Error("INVALID_EDIT_DATA");

      for (const item of items) {
        if (!item?.testOrderId) continue;
        if (!task.testOrderIds.includes(item.testOrderId)) continue;

        const labResult = await tx.labResult.findUnique({
          where: {
            taskId_testOrderId: {
              taskId: task.id,
              testOrderId: item.testOrderId,
            },
          },
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
            },
          },
        });
        if (!labResult) throw new Error("RESULT_NOT_FOUND");

        if (labResult.versions.length === 0) {
          const baseline = await tx.labResultVersion.create({
            data: {
              labResultId: labResult.id,
              version: 1,
              resultData: (labResult.resultData ?? {}) as Prisma.InputJsonValue,
              notes: labResult.notes,
              isActive: true,
              parentId: null,
              editedById: labResult.staffId,
              editReason: "Initial submitted version",
            },
          });
          labResult.versions = [baseline];
        }

        const latestVersion = await tx.labResultVersion.findFirst({
          where: { labResultId: labResult.id },
          orderBy: { version: "desc" },
        });
        const activeVersion = await tx.labResultVersion.findFirst({
          where: { labResultId: labResult.id, isActive: true },
          orderBy: { version: "desc" },
        });
        if (!activeVersion) throw new Error("INVALID_VERSION_CHAIN");

        const nextVersion = nextVersionNumber(
          latestVersion ? [latestVersion.version] : [1]
        );

        await tx.labResultVersion.updateMany({
          where: { labResultId: labResult.id, isActive: true },
          data: { isActive: false },
        });

        await tx.labResultVersion.create({
          data: {
            labResultId: labResult.id,
            version: nextVersion,
            resultData: (
              item.resultData ?? activeVersion.resultData ?? latestVersion?.resultData ?? labResult.resultData ?? {}
            ) as Prisma.InputJsonValue,
            notes: item.notes ?? activeVersion.notes ?? latestVersion?.notes ?? labResult.notes,
            isActive: true,
            parentId: activeVersion.id,
            editedById: actor.id,
            editReason: payload.reason,
          },
        });
        versionTrace.push(`${labResult.id}:v${nextVersion}`);
      }
    }

    if (task.department === Department.RADIOLOGY) {
      const data = payload.editedData as any;
      if (data?.report) {
        const report = await tx.radiologyReport.findUnique({
          where: { taskId: task.id },
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
            },
          },
        });
        if (!report) throw new Error("RESULT_NOT_FOUND");

        if (report.versions.length === 0) {
          const baseline = await tx.radiologyReportVersion.create({
            data: {
              reportId: report.id,
              version: 1,
              findings: report.findings,
              impression: report.impression,
              notes: report.notes,
              isActive: true,
              parentId: null,
              editedById: report.staffId,
              editReason: "Initial submitted version",
            },
          });
          report.versions = [baseline];
        }

        const latestVersion = await tx.radiologyReportVersion.findFirst({
          where: { reportId: report.id },
          orderBy: { version: "desc" },
        });
        const activeVersion = await tx.radiologyReportVersion.findFirst({
          where: { reportId: report.id, isActive: true },
          orderBy: { version: "desc" },
        });
        if (!activeVersion) throw new Error("INVALID_VERSION_CHAIN");

        const nextVersion = nextVersionNumber(latestVersion ? [latestVersion.version] : [1]);

        await tx.radiologyReportVersion.updateMany({
          where: { reportId: report.id, isActive: true },
          data: { isActive: false },
        });

        await tx.radiologyReportVersion.create({
          data: {
            reportId: report.id,
            version: nextVersion,
            findings: data.report.findings ?? activeVersion.findings ?? latestVersion?.findings ?? report.findings,
            impression: data.report.impression ?? activeVersion.impression ?? latestVersion?.impression ?? report.impression,
            notes: data.report.notes ?? activeVersion.notes ?? latestVersion?.notes ?? report.notes,
            isActive: true,
            parentId: activeVersion.id,
            editedById: actor.id,
            editReason: payload.reason,
          },
        });
        versionTrace.push(`${report.id}:v${nextVersion}`);
      } else {
        throw new Error("INVALID_EDIT_DATA");
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
        rejectionReason: resetApproval ? "Approved result edited and reset for re-approval" : null,
      },
      update: {
        reviewedById: actor.id,
        status: ReviewStatus.PENDING,
        comments: payload.comments,
        editedData: payload.editedData,
        rejectionReason: resetApproval ? "Approved result edited and reset for re-approval" : null,
      },
    });

    await tx.testOrder.updateMany({
      where: { id: { in: task.testOrderIds }, organizationId: actor.organizationId },
      data: {
        status: OrderStatus.RESUBMITTED,
        submittedAt: now,
        reviewedAt: null,
        approvedAt: null,
      },
    });

    await tx.routingTask.update({
      where: { id: task.id },
      data: { status: RoutingTaskStatus.COMPLETED },
    });
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role as Role,
    action: AUDIT_ACTIONS.REVIEW_EDITED,
    entityType: "Review",
    entityId: task.id,
    changes: {
      reason: payload.reason,
      resetApproval,
      beforeStatus: currentStatus ?? "PENDING",
      afterStatus: "PENDING",
      editedData: payload.editedData,
      comments: payload.comments ?? null,
    },
    notes: payload.reason,
    ...actor.auditMeta,
  });

  const mdUsers = await prisma.staff.findMany({
    where: {
      organizationId: actor.organizationId,
      role: Role.MD,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const performerIds = new Set<string>();
  if (task.staffId) performerIds.add(task.staffId);
  for (const result of task.results) {
    if (result.staffId) performerIds.add(result.staffId);
  }

  await notifyResultEdited({
    organizationId: actor.organizationId,
    taskId: task.id,
    patientName: task.visit.patient.fullName,
    editorId: actor.id,
    mdIds: mdUsers.map((user) => user.id),
    performerIds: Array.from(performerIds),
    dedupeSeed: versionTrace.sort().join("|") || `${task.id}:edit`,
  });
}
