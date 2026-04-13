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

function toCreateData(
  input: SendNotificationInput
): Prisma.NotificationCreateManyInput {
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
    userId: input.userId,
    organizationId: input.organizationId,
  };
}

// Single notification — kept for one-off sends
export async function sendNotification(input: SendNotificationInput) {
  try {
    const created = await prisma.notification.create({
      data: {
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
      },
    });
    return created;
  } catch (error: any) {
    if (error?.code === "P2002") return null;
    throw error;
  }
}

// OPTIMISED: replaces sequential for-loop with a single batch insert
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

  const data = users.map((user) =>
    toCreateData({
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
    })
  );

  const result = await prisma.notification.createMany({
    data,
    skipDuplicates: true, // handles dedupeKey unique constraint
  });

  return result.count;
}

// OPTIMISED: parallel queries instead of sequential
export async function listNotifications(
  actor: NotificationActor,
  opts?: { limit?: number; cursor?: string }
) {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const baseWhere = {
    organizationId: actor.organizationId,
    userId: actor.id,
  };

  // Run both queries in parallel instead of sequentially
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({
      where: { ...baseWhere, isRead: false },
    }),
  ]);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, unreadCount, nextCursor };
}

export async function markNotificationAsRead(
  actor: NotificationActor,
  notificationId: string
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, organizationId: actor.organizationId },
    select: { id: true, userId: true, isRead: true },
  });
  if (!notification) throw new Error("NOTIFICATION_NOT_FOUND");
  if (!canAccessNotification(notification.userId, actor.id))
    throw new Error("FORBIDDEN_NOTIFICATION");
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
  // OPTIMISED: fetch privileged staff and tasks in parallel
  const [privileged, tasks] = await Promise.all([
    prisma.staff.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        role: { in: ["HRM", "SUPER_ADMIN"] },
      },
      select: { id: true },
    }),
    prisma.routingTask.findMany({
      where: {
        organizationId,
        status: { in: [RoutingTaskStatus.PENDING, RoutingTaskStatus.IN_PROGRESS] },
      },
      include: {
        visit: { include: { patient: true } },
      },
    }),
  ]);

  if (privileged.length === 0 || tasks.length === 0) return 0;

  const orderIds = tasks.flatMap((task) => task.testOrderIds);
  const orders = orderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId, id: { in: orderIds } },
        include: { test: true },
      })
    : [];
  const orderMap = new Map(orders.map((order) => [order.id, order]));

  const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];

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
      const dedupeKey = `delayed:${task.id}:${user.id}`;
      notificationsToCreate.push({
        organizationId,
        userId: user.id,
        type: NotificationType.TASK_DELAYED,
        title: "Delayed task detected",
        message: `${task.department} task for ${task.visit.patient.fullName} exceeded target turnaround.`,
        entityId: task.id,
        entityType: "RoutingTask",
        dedupeKey,
      });
    }
  }

  if (notificationsToCreate.length === 0) return 0;

  // OPTIMISED: single batch insert instead of N×M sequential writes
  const result = await prisma.notification.createMany({
    data: notificationsToCreate,
    skipDuplicates: true,
  });
  return result.count;
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
  // OPTIMISED: fetch MD and HRM staff in parallel, then batch-insert
  const [mdUsers, hrmUsers] = await Promise.all([
    prisma.staff.findMany({
      where: { organizationId: input.organizationId, role: Role.MD, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.staff.findMany({
      where: {
        organizationId: input.organizationId,
        role: { in: [Role.HRM, Role.SUPER_ADMIN] },
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  ]);

  const mdMsg = `${input.patientName} (${input.department}) submitted${input.submittedByName ? ` by ${input.submittedByName}` : ""}.`;
  const hrmMsg = `${input.patientName} (${input.department}) has entered MD review queue.`;

  const data: Prisma.NotificationCreateManyInput[] = [
    ...mdUsers.map((u) => ({
      organizationId: input.organizationId,
      userId: u.id,
      type: NotificationType.RESULT_SUBMITTED,
      title: "Result ready for review",
      message: mdMsg,
      entityId: input.taskId,
      entityType: "RoutingTask",
      dedupeKey: `submitted:${input.taskId}:${u.id}`,
    })),
    ...hrmUsers.map((u) => ({
      organizationId: input.organizationId,
      userId: u.id,
      type: NotificationType.RESULT_SUBMITTED,
      title: "Result submitted to MD queue",
      message: hrmMsg,
      entityId: input.taskId,
      entityType: "RoutingTask",
      dedupeKey: `submitted-ops:${input.taskId}:${u.id}`,
    })),
  ];

  if (data.length === 0) return 0;
  const result = await prisma.notification.createMany({ data, skipDuplicates: true });
  return result.count;
}

export async function notifyTaskReviewOutcome(input: {
  organizationId: string;
  taskId: string;
  performerId?: string | null;
  patientName: string;
  approved: boolean;
  reason?: string;
}) {
  const type = input.approved
    ? NotificationType.RESULT_APPROVED
    : NotificationType.RESULT_REJECTED;
  const title = input.approved ? "Result approved" : "Edit requested by MD";
  const message = input.approved
    ? `${input.patientName} result approved by MD.`
    : `${input.patientName} result returned by MD${input.reason ? `: ${input.reason}` : "."}`;

  const hrmUsers = await prisma.staff.findMany({
    where: {
      organizationId: input.organizationId,
      role: { in: [Role.HRM, Role.SUPER_ADMIN] },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const data: Prisma.NotificationCreateManyInput[] = [
    ...(input.performerId
      ? [
          {
            organizationId: input.organizationId,
            userId: input.performerId,
            type,
            title,
            message,
            entityId: input.taskId,
            entityType: "RoutingTask",
            dedupeKey: `${type}:${input.taskId}:${input.performerId}`,
          },
        ]
      : []),
    ...hrmUsers.map((u) => ({
      organizationId: input.organizationId,
      userId: u.id,
      type,
      title,
      message,
      entityId: input.taskId,
      entityType: "RoutingTask",
      dedupeKey: `${type}:${input.taskId}:${u.id}`,
    })),
  ];

  if (data.length === 0) return 0;
  const result = await prisma.notification.createMany({ data, skipDuplicates: true });
  return result.count;
}

// OPTIMISED: batch insert instead of sequential loop
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

  if (targets.length === 0) return 0;

  const data: Prisma.NotificationCreateManyInput[] = targets.map((userId) => ({
    organizationId: input.organizationId,
    userId,
    type: NotificationType.RESULT_EDITED,
    title: "Result Updated",
    message: `${input.patientName} result was modified and requires review.`,
    entityId: input.taskId,
    entityType: "RoutingTask",
    dedupeKey: `edited:${input.taskId}:${input.dedupeSeed}:${userId}`,
  }));

  const result = await prisma.notification.createMany({ data, skipDuplicates: true });
  return result.count;
}