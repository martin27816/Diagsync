import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  Role,
  RoutingTaskStatus,
  type Prisma,
} from "@prisma/client";
import {
  buildNotificationDedupeKey,
  canAccessNotification,
  isPrivilegedOpsRole,
} from "./notifications-core";
import { isTaskDelayed, type TaskForMetrics } from "./hrm-monitoring-core";
import { resolveEditNotificationTargets } from "./edit-versioning-core";

export type NotificationActor = {
  id: string;
  role: string;
  organizationId: string;
};

type SendNotificationInput = {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  dedupeKey?: string;
};

function toCreateData(input: SendNotificationInput): Prisma.NotificationCreateInput {
  return {
    type: input.type,
    title: input.title,
    message: input.message,
    entityId: input.entityId,
    entityType: input.entityType,
    dedupeKey: buildNotificationDedupeKey({
      userId: input.userId,
      type: input.type,
      entityId: input.entityId,
      key: input.dedupeKey,
    }),
    user: { connect: { id: input.userId } },
    organizationId: input.organizationId,
  };
}

export async function sendNotification(input: SendNotificationInput) {
  try {
    const created = await prisma.notification.create({
      data: toCreateData(input),
    });
    return created;
  } catch (error: any) {
    if (error?.code === "P2002") return null;
    throw error;
  }
}

export async function sendNotificationToRoles(input: {
  organizationId: string;
  roles: Role[];
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  dedupeKeyPrefix?: string;
}) {
  const users = await prisma.staff.findMany({
    where: {
      organizationId: input.organizationId,
      role: { in: input.roles },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  let sent = 0;
  for (const user of users) {
    const created = await sendNotification({
      organizationId: input.organizationId,
      userId: user.id,
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
      entityType: input.entityType,
      dedupeKey: input.dedupeKeyPrefix
        ? `${input.dedupeKeyPrefix}:${user.id}`
        : undefined,
    });
    if (created) sent += 1;
  }
  return sent;
}

export async function listNotifications(actor: NotificationActor, opts?: { limit?: number; cursor?: string }) {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const rows = await prisma.notification.findMany({
    where: {
      organizationId: actor.organizationId,
      userId: actor.id,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const unreadCount = await prisma.notification.count({
    where: {
      organizationId: actor.organizationId,
      userId: actor.id,
      isRead: false,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, unreadCount, nextCursor };
}

export async function markNotificationAsRead(actor: NotificationActor, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, organizationId: actor.organizationId },
    select: { id: true, userId: true, isRead: true },
  });
  if (!notification) throw new Error("NOTIFICATION_NOT_FOUND");
  if (!canAccessNotification(notification.userId, actor.id)) throw new Error("FORBIDDEN_NOTIFICATION");
  if (notification.isRead) return null;

  return prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsAsRead(actor: NotificationActor) {
  const result = await prisma.notification.updateMany({
    where: {
      organizationId: actor.organizationId,
      userId: actor.id,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}

export async function emitDelayedTaskNotifications(organizationId: string) {
  const privileged = await prisma.staff.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { in: ["HRM", "SUPER_ADMIN"] },
    },
    select: { id: true },
  });
  if (privileged.length === 0) return 0;

  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId,
      status: { in: [RoutingTaskStatus.PENDING, RoutingTaskStatus.IN_PROGRESS] },
    },
    include: {
      visit: { include: { patient: true } },
    },
  });
  if (tasks.length === 0) return 0;

  const orderIds = tasks.flatMap((task) => task.testOrderIds);
  const orders = orderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId, id: { in: orderIds } },
        include: { test: true },
      })
    : [];
  const orderMap = new Map(orders.map((order) => [order.id, order]));

  let sent = 0;
  for (const task of tasks) {
    const taskOrders = task.testOrderIds
      .map((id) => orderMap.get(id))
      .filter((order): order is NonNullable<typeof order> => Boolean(order));
    const expectedMinutes =
      taskOrders.length > 0
        ? Math.max(...taskOrders.map((order) => order.test.turnaroundMinutes))
        : 60;

    const delayed = isTaskDelayed(
      {
        id: task.id,
        status: task.status,
        priority: task.priority,
        department: task.department,
        createdAt: task.createdAt,
        expectedMinutes,
      } as TaskForMetrics,
      new Date()
    );
    if (!delayed) continue;

    for (const user of privileged) {
      const created = await sendNotification({
        organizationId,
        userId: user.id,
        type: NotificationType.TASK_DELAYED,
        title: "Delayed task detected",
        message: `${task.department} task for ${task.visit.patient.fullName} exceeded target turnaround.`,
        entityId: task.id,
        entityType: "RoutingTask",
        dedupeKey: `delayed:${task.id}:${user.id}`,
      });
      if (created) sent += 1;
    }
  }
  return sent;
}

export async function notifyStaffForTaskAssignment(input: {
  organizationId: string;
  staffId: string;
  taskId: string;
  testNames: string[];
  department: string;
  patientName: string;
}) {
  return sendNotification({
    organizationId: input.organizationId,
    userId: input.staffId,
    type: NotificationType.TASK_ASSIGNED,
    title: "New task assigned",
    message: `${input.patientName}: ${input.testNames.join(", ")} (${input.department})`,
    entityId: input.taskId,
    entityType: "RoutingTask",
  });
}

export async function notifyMdResultSubmitted(input: {
  organizationId: string;
  taskId: string;
  patientName: string;
  department: string;
  submittedByName?: string | null;
}) {
  return sendNotificationToRoles({
    organizationId: input.organizationId,
    roles: [Role.MD],
    type: NotificationType.RESULT_SUBMITTED,
    title: "Result ready for review",
    message: `${input.patientName} (${input.department}) submitted${input.submittedByName ? ` by ${input.submittedByName}` : ""}.`,
    entityId: input.taskId,
    entityType: "RoutingTask",
    dedupeKeyPrefix: `submitted:${input.taskId}`,
  });
}

export async function notifyTaskReviewOutcome(input: {
  organizationId: string;
  taskId: string;
  performerId?: string | null;
  patientName: string;
  approved: boolean;
  reason?: string;
}) {
  const type = input.approved ? NotificationType.RESULT_APPROVED : NotificationType.RESULT_REJECTED;
  const title = input.approved ? "Result approved" : "Edit requested by MD";
  const message = input.approved
    ? `${input.patientName} result approved by MD.`
    : `${input.patientName} result returned by MD${input.reason ? `: ${input.reason}` : "."}`;

  let count = 0;
  if (input.performerId) {
    const created = await sendNotification({
      organizationId: input.organizationId,
      userId: input.performerId,
      type,
      title,
      message,
      entityId: input.taskId,
      entityType: "RoutingTask",
      dedupeKey: `${type}:${input.taskId}:${input.performerId}`,
    });
    if (created) count += 1;
  }

  count += await sendNotificationToRoles({
    organizationId: input.organizationId,
    roles: [Role.HRM, Role.SUPER_ADMIN],
    type,
    title,
    message,
    entityId: input.taskId,
    entityType: "RoutingTask",
    dedupeKeyPrefix: `${type}:${input.taskId}`,
  });

  return count;
}

export async function notifyResultEdited(input: {
  organizationId: string;
  taskId: string;
  patientName: string;
  editorId: string;
  mdIds: string[];
  performerIds: string[];
  dedupeSeed: string;
}) {
  const targets = resolveEditNotificationTargets({
    editorId: input.editorId,
    mdIds: input.mdIds,
    performerIds: input.performerIds,
  });
  let sent = 0;
  for (const userId of targets) {
    const created = await sendNotification({
      organizationId: input.organizationId,
      userId,
      type: NotificationType.RESULT_EDITED,
      title: "Result Updated",
      message: `${input.patientName} result was modified and requires review.`,
      entityId: input.taskId,
      entityType: "RoutingTask",
      dedupeKey: `edited:${input.taskId}:${input.dedupeSeed}:${userId}`,
    });
    if (created) sent += 1;
  }
  return sent;
}

export function canManageNotifications(role: string) {
  return Boolean(role);
}

export function canReceiveOperationsNotifications(role: string) {
  return isPrivilegedOpsRole(role);
}
