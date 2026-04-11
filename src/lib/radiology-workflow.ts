import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  Department,
  OrderStatus,
  Role,
  RoutingTaskStatus,
  type Prisma,
} from "@prisma/client";
import {
  canModifyRadiologyTask,
  canStartRadiologyTask,
  canSubmitRadiologyTask,
  hasRequiredReportFields,
  isValidImagingFile,
} from "./radiology-workflow-core";

export type RadiologyActor = {
  id: string;
  role: string;
  organizationId: string;
};

export type ImagingUploadInput = {
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSizeBytes: number;
  metadata?: Prisma.InputJsonValue;
};

function assertRadiographer(actor: RadiologyActor) {
  if (actor.role !== "RADIOGRAPHER") throw new Error("FORBIDDEN_ROLE");
}

async function assertOwnership(taskId: string, actor: RadiologyActor) {
  const task = await prisma.routingTask.findFirst({
    where: {
      id: taskId,
      organizationId: actor.organizationId,
      department: Department.RADIOLOGY,
    },
    include: {
      visit: { include: { patient: true } },
      radiologyReport: true,
      imagingFiles: true,
    },
  });

  if (!task) throw new Error("TASK_NOT_FOUND");
  if (
    !canModifyRadiologyTask({
      userRole: actor.role,
      userId: actor.id,
      assignedStaffId: task.staffId,
    })
  ) {
    throw new Error("FORBIDDEN_TASK");
  }
  return task;
}

export async function getRadiologyTasks(
  actor: RadiologyActor,
  opts?: { status?: RoutingTaskStatus | "ALL"; sort?: "newest" | "oldest" }
) {
  assertRadiographer(actor);
  return prisma.routingTask.findMany({
    where: {
      organizationId: actor.organizationId,
      department: Department.RADIOLOGY,
      staffId: actor.id,
      ...(opts?.status && opts.status !== "ALL" ? { status: opts.status } : {}),
    },
    include: {
      visit: {
        include: {
          patient: true,
        },
      },
      imagingFiles: true,
      radiologyReport: true,
    },
    orderBy: { createdAt: opts?.sort === "oldest" ? "asc" : "desc" },
  });
}

export async function startRadiologyTask(taskId: string, actor: RadiologyActor) {
  assertRadiographer(actor);
  const task = await assertOwnership(taskId, actor);
  if (!canStartRadiologyTask(task.status)) throw new Error("INVALID_TASK_STATE");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
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
          status:
            order.status === OrderStatus.ASSIGNED || order.status === OrderStatus.REGISTERED
              ? OrderStatus.IN_PROGRESS
              : order.status,
          openedAt: order.openedAt ?? now,
          startedAt: order.startedAt ?? now,
        },
      });
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.RADIOGRAPHER,
    action: AUDIT_ACTIONS.TEST_STARTED,
    entityType: "RoutingTask",
    entityId: task.id,
    notes: "Radiology task started",
  });
}

export async function addImagingFile(taskId: string, actor: RadiologyActor, input: ImagingUploadInput) {
  assertRadiographer(actor);
  const task = await assertOwnership(taskId, actor);

  if (!isValidImagingFile({ mimeType: input.fileType, sizeBytes: input.fileSizeBytes })) {
    throw new Error("INVALID_FILE");
  }

  const file = await prisma.imagingFile.create({
    data: {
      organizationId: actor.organizationId,
      taskId: task.id,
      uploadedById: actor.id,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      metadata: input.metadata,
    },
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.RADIOGRAPHER,
    action: AUDIT_ACTIONS.RESULT_DRAFTED,
    entityType: "ImagingFile",
    entityId: file.id,
    notes: `Imaging file uploaded: ${input.fileName}`,
  });

  return file;
}

export async function saveRadiologyReport(
  taskId: string,
  actor: RadiologyActor,
  input: { findings: string; impression: string; notes?: string }
) {
  assertRadiographer(actor);
  const task = await assertOwnership(taskId, actor);

  const report = await prisma.radiologyReport.upsert({
    where: { taskId: task.id },
    create: {
      organizationId: actor.organizationId,
      taskId: task.id,
      staffId: actor.id,
      findings: input.findings,
      impression: input.impression,
      notes: input.notes,
    },
    update: {
      findings: input.findings,
      impression: input.impression,
      notes: input.notes,
    },
  });

  await prisma.routingTask.update({
    where: { id: task.id },
    data: { status: RoutingTaskStatus.IN_PROGRESS },
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.RADIOGRAPHER,
    action: AUDIT_ACTIONS.RESULT_DRAFTED,
    entityType: "RadiologyReport",
    entityId: report.id,
    notes: "Radiology report draft saved",
  });

  return report;
}

export async function submitRadiologyTask(
  taskId: string,
  actor: RadiologyActor,
  options?: { requireImaging?: boolean }
) {
  assertRadiographer(actor);
  const task = await assertOwnership(taskId, actor);

  if (!canSubmitRadiologyTask(task.status)) throw new Error("TASK_ALREADY_COMPLETED");
  if (!task.radiologyReport) throw new Error("MISSING_REPORT");
  if (!hasRequiredReportFields(task.radiologyReport)) throw new Error("INCOMPLETE_REPORT");
  if (options?.requireImaging && task.imagingFiles.length === 0) throw new Error("MISSING_IMAGING");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.radiologyReport.update({
      where: { taskId: task.id },
      data: { isSubmitted: true, submittedAt: now },
    });

    await tx.routingTask.update({
      where: { id: task.id },
      data: { status: RoutingTaskStatus.COMPLETED },
    });

    const orders = await tx.testOrder.findMany({
      where: { id: { in: task.testOrderIds }, organizationId: actor.organizationId },
    });
    for (const order of orders) {
      await tx.testOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SUBMITTED_FOR_REVIEW,
          completedAt: order.completedAt ?? now,
          submittedAt: now,
        },
      });
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.RADIOGRAPHER,
    action: AUDIT_ACTIONS.RESULT_SUBMITTED,
    entityType: "RoutingTask",
    entityId: task.id,
    notes: "Radiology report submitted for MD review",
  });
}

