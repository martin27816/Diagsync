import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import type { AuditMeta } from "@/lib/audit-core";
import { notifyMdResultSubmitted } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  Department,
  OrderStatus,
  Prisma,
  Role,
  RoutingTaskStatus,
  SampleStatus,
} from "@prisma/client";
import {
  canModifyAssignedTask,
  canStartTask,
  canSubmitTask,
  hasResultsForAllTests,
  sampleStatusToOrderStage,
  sortByPriorityAndTime,
} from "./lab-workflow-core";

export type LabActor = {
  id: string;
  role: string;
  organizationId: string;
  auditMeta?: AuditMeta;
};

export type SaveResultInput = {
  testOrderId: string;
  resultData: Prisma.InputJsonValue;
  notes?: string;
};

function assertLabScientist(actor: LabActor) {
  if (actor.role !== "LAB_SCIENTIST") {
    throw new Error("FORBIDDEN_ROLE");
  }
}

async function assertTaskOwnership(taskId: string, actor: LabActor) {
  const task = await prisma.routingTask.findFirst({
    where: {
      id: taskId,
      organizationId: actor.organizationId,
      department: Department.LABORATORY,
    },
    include: {
      visit: { include: { patient: true } },
    },
  });

  if (!task) throw new Error("TASK_NOT_FOUND");

  if (
    !canModifyAssignedTask({
      userRole: actor.role,
      userId: actor.id,
      assignedStaffId: task.staffId,
    })
  ) {
    throw new Error("FORBIDDEN_TASK");
  }

  return task;
}

export async function getLabTasks(actor: LabActor, opts?: {
  status?: RoutingTaskStatus | "ALL";
  sort?: "newest" | "oldest";
}) {
  assertLabScientist(actor);

  const rows = await prisma.routingTask.findMany({
    where: {
      organizationId: actor.organizationId,
      department: Department.LABORATORY,
      staffId: actor.id,
      ...(opts?.status && opts.status !== "ALL" ? { status: opts.status } : {}),
    },
    include: {
      visit: {
        include: { patient: true },
      },
      sample: true,
      review: true,
      staff: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allOrderIds = Array.from(new Set(rows.flatMap((task) => task.testOrderIds)));
  const testOrders = allOrderIds.length
    ? await prisma.testOrder.findMany({
        where: { id: { in: allOrderIds }, organizationId: actor.organizationId },
        include: {
          test: {
            include: {
              resultFields: { orderBy: { sortOrder: "asc" } },
            },
          },
          labResults: {
            select: {
              id: true,
              resultData: true,
              notes: true,
              isSubmitted: true,
            },
          },
        },
      })
    : [];

  const orderMap = new Map(testOrders.map((o) => [o.id, o]));
  const merged = rows.map((task) => ({
    ...task,
    testOrders: task.testOrderIds.map((id) => orderMap.get(id)).filter(Boolean),
  }));

  return sortByPriorityAndTime(merged as any, opts?.sort === "oldest" ? "asc" : "desc");
}

export async function startLabTask(taskId: string, actor: LabActor) {
  assertLabScientist(actor);
  const task = await assertTaskOwnership(taskId, actor);

  if (!canStartTask(task.status)) throw new Error("INVALID_TASK_STATE");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.routingTask.update({
      where: { id: task.id },
      data: { status: RoutingTaskStatus.IN_PROGRESS },
    });

    const testOrders = await tx.testOrder.findMany({
      where: {
        id: { in: task.testOrderIds },
        organizationId: actor.organizationId,
      },
    });

    for (const order of testOrders) {
      await tx.testOrder.update({
        where: { id: order.id },
        data: {
          status:
            order.status === OrderStatus.ASSIGNED || order.status === OrderStatus.REGISTERED
              ? OrderStatus.OPENED
              : order.status,
          openedAt: order.openedAt ?? now,
        },
      });
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.LAB_SCIENTIST,
    action: AUDIT_ACTIONS.TEST_STARTED,
    entityType: "RoutingTask",
    entityId: task.id,
    notes: "Lab task started",
    ...actor.auditMeta,
  });
}

export async function updateSampleForLabTask(
  taskId: string,
  actor: LabActor,
  sampleStatus: SampleStatus,
  notes?: string
) {
  assertLabScientist(actor);
  const task = await assertTaskOwnership(taskId, actor);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.labSample.upsert({
      where: { taskId: task.id },
      create: {
        taskId: task.id,
        organizationId: actor.organizationId,
        visitId: task.visitId,
        staffId: actor.id,
        status: sampleStatus,
        notes,
        collectedAt: sampleStatus === SampleStatus.COLLECTED ? now : undefined,
        receivedAt: sampleStatus === SampleStatus.RECEIVED ? now : undefined,
        processingAt: sampleStatus === SampleStatus.PROCESSING ? now : undefined,
        completedAt: sampleStatus === SampleStatus.DONE ? now : undefined,
      },
      update: {
        status: sampleStatus,
        notes,
        collectedAt: sampleStatus === SampleStatus.COLLECTED ? now : undefined,
        receivedAt: sampleStatus === SampleStatus.RECEIVED ? now : undefined,
        processingAt: sampleStatus === SampleStatus.PROCESSING ? now : undefined,
        completedAt: sampleStatus === SampleStatus.DONE ? now : undefined,
      },
    });

    const orderStatus = sampleStatusToOrderStage(sampleStatus);
    if (orderStatus) {
      const orders = await tx.testOrder.findMany({
        where: {
          id: { in: task.testOrderIds },
          organizationId: actor.organizationId,
        },
      });

      for (const order of orders) {
        await tx.testOrder.update({
          where: { id: order.id },
          data: {
            status: orderStatus as OrderStatus,
            sampleCollectedAt:
              sampleStatus === SampleStatus.COLLECTED ? order.sampleCollectedAt ?? now : order.sampleCollectedAt,
            startedAt:
              sampleStatus === SampleStatus.PROCESSING ? order.startedAt ?? now : order.startedAt,
            completedAt:
              sampleStatus === SampleStatus.DONE ? order.completedAt ?? now : order.completedAt,
          },
        });
      }
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.LAB_SCIENTIST,
    action: AUDIT_ACTIONS.SAMPLE_COLLECTED,
    entityType: "LabSample",
    entityId: task.id,
    notes: `Sample status updated to ${sampleStatus}${notes ? `: ${notes}` : ""}`,
    ...actor.auditMeta,
  });
}

export async function saveLabResults(taskId: string, actor: LabActor, inputs: SaveResultInput[]) {
  assertLabScientist(actor);
  const task = await assertTaskOwnership(taskId, actor);

  const testOrderIds = new Set(task.testOrderIds);
  for (const input of inputs) {
    if (!testOrderIds.has(input.testOrderId)) {
      throw new Error("INVALID_TEST_ORDER");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      await tx.labResult.upsert({
        where: {
          taskId_testOrderId: {
            taskId: task.id,
            testOrderId: input.testOrderId,
          },
        },
        create: {
          organizationId: actor.organizationId,
          taskId: task.id,
          testOrderId: input.testOrderId,
          staffId: actor.id,
          resultData: input.resultData,
          notes: input.notes,
        },
        update: {
          resultData: input.resultData,
          notes: input.notes,
        },
      });

      await tx.testOrder.update({
        where: { id: input.testOrderId },
        data: { status: OrderStatus.RESULT_DRAFTED },
      });
    }

    await tx.routingTask.update({
      where: { id: task.id },
      data: { status: RoutingTaskStatus.IN_PROGRESS },
    });
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: Role.LAB_SCIENTIST,
    action: AUDIT_ACTIONS.RESULT_DRAFTED,
    entityType: "RoutingTask",
    entityId: task.id,
    notes: `Draft results saved for ${inputs.length} test(s)`,
    ...actor.auditMeta,
  });
}

export async function submitLabTask(taskId: string, actor: LabActor) {
  assertLabScientist(actor);
  const task = await assertTaskOwnership(taskId, actor);

  if (!canSubmitTask(task.status)) {
    throw new Error("TASK_ALREADY_COMPLETED");
  }

  const existingResults = await prisma.labResult.findMany({
    where: { taskId: task.id, organizationId: actor.organizationId },
    select: { testOrderId: true, isSubmitted: true },
  });

  if (existingResults.length > 0 && existingResults.every((r) => r.isSubmitted)) {
    throw new Error("TASK_ALREADY_COMPLETED");
  }

  if (!hasResultsForAllTests(task.testOrderIds, existingResults.map((r) => r.testOrderId))) {
    throw new Error("MISSING_RESULTS");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.labResult.updateMany({
      where: { taskId: task.id, organizationId: actor.organizationId },
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
    actorRole: Role.LAB_SCIENTIST,
    action: AUDIT_ACTIONS.RESULT_SUBMITTED,
    entityType: "RoutingTask",
    entityId: task.id,
    notes: "Task submitted for MD review",
    ...actor.auditMeta,
  });

  await notifyMdResultSubmitted({
    organizationId: actor.organizationId,
    taskId: task.id,
    patientName: task.visit.patient.fullName,
    department: task.department,
  });
}
