import { prisma } from "@/lib/prisma";
import { Department, OrderStatus, RoutingTaskStatus } from "@prisma/client";

const ORDER_FINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.SUBMITTED_FOR_REVIEW,
  OrderStatus.RESUBMITTED,
  OrderStatus.APPROVED,
  OrderStatus.RELEASED,
]);

const ORDER_ACTIVE_STATUSES = new Set<OrderStatus>([
  OrderStatus.OPENED,
  OrderStatus.SAMPLE_COLLECTED,
  OrderStatus.IN_PROGRESS,
  OrderStatus.RESULT_DRAFTED,
  OrderStatus.EDIT_REQUESTED,
]);

type ReconcileInput = {
  organizationId: string;
  dryRun?: boolean;
};

type ReconcileResult = {
  organizationId: string;
  scannedTasks: number;
  updatedTasks: number;
  updates: Array<{ taskId: string; from: RoutingTaskStatus; to: RoutingTaskStatus }>;
};

const lastReconcileAtByOrg = new Map<string, number>();
const inFlightReconcileByOrg = new Map<string, Promise<ReconcileResult>>();

function pickExpectedLabTaskStatus(input: {
  current: RoutingTaskStatus;
  taskOrderIds: string[];
  orderStatuses: OrderStatus[];
  resultOrderIds: string[];
  allResultsSubmitted: boolean;
  hasSampleProgress: boolean;
}) {
  if (input.current === RoutingTaskStatus.CANCELLED) return RoutingTaskStatus.CANCELLED;

  const hasOrders = input.taskOrderIds.length > 0;
  const hasAllOrderResults =
    hasOrders && input.taskOrderIds.every((id) => input.resultOrderIds.includes(id));
  const allOrdersFinal =
    hasOrders &&
    input.orderStatuses.length === input.taskOrderIds.length &&
    input.orderStatuses.every((status) => ORDER_FINAL_STATUSES.has(status));
  const hasOrderProgress = input.orderStatuses.some((status) => ORDER_ACTIVE_STATUSES.has(status));

  if (allOrdersFinal || (hasAllOrderResults && input.allResultsSubmitted)) {
    return RoutingTaskStatus.COMPLETED;
  }
  if (hasOrderProgress || input.resultOrderIds.length > 0 || input.hasSampleProgress) {
    return RoutingTaskStatus.IN_PROGRESS;
  }
  return RoutingTaskStatus.PENDING;
}

function pickExpectedRadiologyTaskStatus(input: {
  current: RoutingTaskStatus;
  taskOrderCount: number;
  orderStatuses: OrderStatus[];
  reportSubmitted: boolean;
}) {
  if (input.current === RoutingTaskStatus.CANCELLED) return RoutingTaskStatus.CANCELLED;

  const allOrdersFinal =
    input.taskOrderCount > 0 &&
    input.orderStatuses.length === input.taskOrderCount &&
    input.orderStatuses.every((status) => ORDER_FINAL_STATUSES.has(status));
  const hasOrderProgress = input.orderStatuses.some((status) => ORDER_ACTIVE_STATUSES.has(status));

  if (input.reportSubmitted || allOrdersFinal) return RoutingTaskStatus.COMPLETED;
  if (hasOrderProgress) return RoutingTaskStatus.IN_PROGRESS;
  return RoutingTaskStatus.PENDING;
}

export async function reconcileWorkflowStates(input: ReconcileInput): Promise<ReconcileResult> {
  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: input.organizationId,
      department: { in: [Department.LABORATORY, Department.RADIOLOGY] },
      status: { in: [RoutingTaskStatus.PENDING, RoutingTaskStatus.IN_PROGRESS, RoutingTaskStatus.COMPLETED] },
    },
    include: {
      sample: { select: { status: true } },
      results: { select: { testOrderId: true, isSubmitted: true } },
      radiologyReport: { select: { isSubmitted: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const allOrderIds = Array.from(new Set(tasks.flatMap((task) => task.testOrderIds)));
  const orders = allOrderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId: input.organizationId, id: { in: allOrderIds } },
        select: { id: true, status: true },
      })
    : [];
  const orderMap = new Map(orders.map((order) => [order.id, order.status]));

  const updates: Array<{ taskId: string; from: RoutingTaskStatus; to: RoutingTaskStatus }> = [];

  for (const task of tasks) {
    const orderStatuses = task.testOrderIds
      .map((id) => orderMap.get(id))
      .filter((status): status is OrderStatus => Boolean(status));

    const expected =
      task.department === Department.LABORATORY
        ? pickExpectedLabTaskStatus({
            current: task.status,
            taskOrderIds: task.testOrderIds,
            orderStatuses,
            resultOrderIds: task.results.map((result) => result.testOrderId),
            allResultsSubmitted: task.results.length > 0 && task.results.every((result) => result.isSubmitted),
            hasSampleProgress: Boolean(task.sample && task.sample.status !== "PENDING"),
          })
        : pickExpectedRadiologyTaskStatus({
            current: task.status,
            taskOrderCount: task.testOrderIds.length,
            orderStatuses,
            reportSubmitted: Boolean(task.radiologyReport?.isSubmitted),
          });

    if (expected === task.status) continue;
    updates.push({ taskId: task.id, from: task.status, to: expected });
  }

  if (!input.dryRun) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.routingTask.updateMany({
          where: {
            id: update.taskId,
            organizationId: input.organizationId,
            status: update.from,
          },
          data: {
            status: update.to,
          },
        })
      )
    );
  }

  return {
    organizationId: input.organizationId,
    scannedTasks: tasks.length,
    updatedTasks: updates.length,
    updates,
  };
}

export async function reconcileWorkflowStatesIfDue(input: {
  organizationId: string;
  minIntervalMs?: number;
}) {
  const minIntervalMs = Math.max(10_000, input.minIntervalMs ?? 60_000);
  const now = Date.now();
  const last = lastReconcileAtByOrg.get(input.organizationId) ?? 0;
  if (now - last < minIntervalMs) {
    return { ran: false as const, reason: "throttled" as const };
  }

  const inFlight = inFlightReconcileByOrg.get(input.organizationId);
  if (inFlight) {
    await inFlight;
    return { ran: false as const, reason: "in_flight" as const };
  }

  const run = reconcileWorkflowStates({ organizationId: input.organizationId });
  inFlightReconcileByOrg.set(input.organizationId, run);
  try {
    const result = await run;
    lastReconcileAtByOrg.set(input.organizationId, Date.now());
    return { ran: true as const, result };
  } finally {
    inFlightReconcileByOrg.delete(input.organizationId);
  }
}
