import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  AvailabilityStatus,
  Department,
  OrderStatus,
  Priority,
  Role,
  RoutingTaskStatus,
  StaffStatus,
} from "@prisma/client";
import {
  averageCompletionMinutes,
  canUseHrmDashboard,
  isOverloaded,
  isTaskDelayed,
  staffWorkload,
  tasksPerDepartment,
  type TaskForMetrics,
} from "./hrm-monitoring-core";
import type { Prisma } from "@prisma/client";

type HrmActor = {
  id: string;
  role: string;
  organizationId: string;
};

type TaskFilters = {
  department?: Department | "ALL";
  status?: RoutingTaskStatus | "ALL";
  priority?: Priority | "ALL";
};

function assertHrm(actor: HrmActor) {
  if (!canUseHrmDashboard(actor.role)) throw new Error("FORBIDDEN_ROLE");
}

async function fetchTaskRows(actor: HrmActor, filters?: TaskFilters) {
  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(filters?.department && filters.department !== "ALL" ? { department: filters.department } : {}),
      ...(filters?.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters?.priority && filters.priority !== "ALL" ? { priority: filters.priority } : {}),
    },
    include: {
      staff: { select: { id: true, fullName: true, role: true, status: true, availabilityStatus: true } },
      visit: { include: { patient: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  type TaskOrder = Prisma.TestOrderGetPayload<{ include: { test: true } }>;
  const orderIds = tasks.flatMap((t) => t.testOrderIds);
  const orders = orderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId: actor.organizationId, id: { in: orderIds } },
        include: { test: true },
      })
    : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const rows = tasks.map((task) => {
    const taskOrders = task.testOrderIds
      .map((id) => orderMap.get(id))
      .filter((order): order is TaskOrder => Boolean(order));
    const expectedMinutes = taskOrders.length
      ? Math.max(...taskOrders.map((o) => (o as TaskOrder).test.turnaroundMinutes))
      : 60;
    const latestCompletedAt = taskOrders
      .map((o) => (o as TaskOrder).completedAt as Date | null)
      .filter((completedAt): completedAt is Date => Boolean(completedAt))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;

    return {
      taskId: task.id,
      department: task.department,
      priority: task.priority,
      status: task.status,
      assignedStaff: task.staff,
      visit: task.visit,
      testNames: taskOrders.map((o) => o.test.name),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      expectedMinutes,
      delayed: isTaskDelayed(
        {
          id: task.id,
          status: task.status,
          priority: task.priority,
          department: task.department,
          createdAt: task.createdAt,
          completedAt: latestCompletedAt,
          expectedMinutes,
          staffId: task.staffId,
        },
        new Date()
      ),
    };
  });

  return rows;
}

export async function getHrmOverview(actor: HrmActor) {
  assertHrm(actor);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date();

  const [todayPatients, activeVisits, tasks, staffRows] = await Promise.all([
    prisma.patient.count({
      where: { organizationId: actor.organizationId, createdAt: { gte: todayStart } },
    }),
    prisma.visit.count({
      where: {
        organizationId: actor.organizationId,
        testOrders: {
          some: {
            status: {
              notIn: [OrderStatus.RELEASED, OrderStatus.CANCELLED],
            },
          },
        },
      },
    }),
    prisma.routingTask.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        status: true,
        priority: true,
        department: true,
        createdAt: true,
        staffId: true,
        testOrderIds: true,
      },
    }),
    prisma.staff.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, fullName: true, role: true, availabilityStatus: true, status: true },
    }),
  ]);

  const allOrderIds = tasks.flatMap((t) => t.testOrderIds);
  type TaskOrder = Prisma.TestOrderGetPayload<{ include: { test: true } }>;
  const orders = allOrderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId: actor.organizationId, id: { in: allOrderIds } },
        include: { test: true },
      })
    : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const metricTasks: TaskForMetrics[] = tasks.map((task) => {
    const taskOrders = task.testOrderIds
      .map((id) => orderMap.get(id))
      .filter((order): order is TaskOrder => Boolean(order));
    const expectedMinutes = taskOrders.length
      ? Math.max(...taskOrders.map((o) => o.test.turnaroundMinutes))
      : 60;
    const latestCompletedAt = taskOrders
      .map((o) => o.completedAt as Date | null)
      .filter((completedAt): completedAt is Date => Boolean(completedAt))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;
    return {
      id: task.id,
      status: task.status,
      priority: task.priority,
      department: task.department,
      createdAt: task.createdAt,
      completedAt: latestCompletedAt,
      expectedMinutes,
      staffId: task.staffId,
    };
  });

  const delayedTasks = metricTasks.filter((t) => isTaskDelayed(t, now)).length;
  const pendingTasks = metricTasks.filter((t) => t.status !== RoutingTaskStatus.COMPLETED && t.status !== RoutingTaskStatus.CANCELLED).length;
  const completedTasks = metricTasks.filter((t) => t.status === RoutingTaskStatus.COMPLETED).length;

  const avgCompletion = averageCompletionMinutes(metricTasks);
  const perDepartment = tasksPerDepartment(metricTasks);
  const workload = staffWorkload(metricTasks);

  const staffPerformance = staffRows.map((s) => {
    const wl = workload.get(s.id) ?? { assigned: 0, active: 0, completed: 0 };
    return {
      id: s.id,
      fullName: s.fullName,
      role: s.role,
      status: s.status,
      availabilityStatus: s.availabilityStatus,
      assigned: wl.assigned,
      active: wl.active,
      completed: wl.completed,
      overloaded: isOverloaded(wl.active),
    };
  });

  const busiestStaff = [...staffPerformance]
    .sort((a, b) => b.active - a.active)
    .slice(0, 3);

  return {
    metrics: {
      todayPatients,
      activeVisits,
      pendingTasks,
      completedTasks,
      delayedTasks,
    },
    analytics: {
      averageCompletionMinutes: avgCompletion,
      tasksPerDepartment: perDepartment,
      busiestStaff,
    },
    staffPerformance,
  };
}

export async function getHrmTaskMonitor(actor: HrmActor, filters?: TaskFilters) {
  assertHrm(actor);
  return fetchTaskRows(actor, filters);
}

export async function getHrmStaffPerformance(actor: HrmActor) {
  assertHrm(actor);
  const overview = await getHrmOverview(actor);
  return overview.staffPerformance;
}

export async function reassignTask(
  actor: HrmActor,
  input: {
    taskId: string;
    newStaffId: string;
    reason?: string;
  }
) {
  assertHrm(actor);

  const task = await prisma.routingTask.findFirst({
    where: { id: input.taskId, organizationId: actor.organizationId },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  const staff = await prisma.staff.findFirst({
    where: {
      id: input.newStaffId,
      organizationId: actor.organizationId,
      status: StaffStatus.ACTIVE,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
      department: task.department,
    },
  });
  if (!staff) throw new Error("INVALID_ASSIGNEE");

  const expectedRole =
    task.department === Department.LABORATORY
      ? Role.LAB_SCIENTIST
      : task.department === Department.RADIOLOGY
      ? Role.RADIOGRAPHER
      : null;
  if (expectedRole && staff.role !== expectedRole) throw new Error("INVALID_ASSIGNEE_ROLE");

  const oldStaffId = task.staffId;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.routingTask.update({
      where: { id: task.id },
      data: {
        staffId: staff.id,
        status: RoutingTaskStatus.PENDING,
      },
    });

    await tx.testOrder.updateMany({
      where: {
        organizationId: actor.organizationId,
        id: { in: task.testOrderIds },
      },
      data: {
        assignedToId: staff.id,
        status: OrderStatus.ASSIGNED,
        assignedAt: now,
      },
    });
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role as Role,
    action: AUDIT_ACTIONS.TEST_REASSIGNED,
    entityType: "RoutingTask",
    entityId: task.id,
    oldValue: { oldStaffId },
    newValue: { newStaffId: staff.id, reason: input.reason ?? null },
    notes: input.reason,
  });
}

export async function overrideTask(
  actor: HrmActor,
  input: {
    taskId: string;
    action: "RELEASE_TO_PENDING" | "FORCE_COMPLETE";
    reason?: string;
  }
) {
  assertHrm(actor);
  const task = await prisma.routingTask.findFirst({
    where: { id: input.taskId, organizationId: actor.organizationId },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  const now = new Date();
  if (input.action === "RELEASE_TO_PENDING") {
    await prisma.$transaction(async (tx) => {
      await tx.routingTask.update({
        where: { id: task.id },
        data: { status: RoutingTaskStatus.PENDING },
      });
      await tx.testOrder.updateMany({
        where: { organizationId: actor.organizationId, id: { in: task.testOrderIds } },
        data: { status: OrderStatus.ASSIGNED, assignedAt: now },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.routingTask.update({
        where: { id: task.id },
        data: { status: RoutingTaskStatus.COMPLETED },
      });
      await tx.testOrder.updateMany({
        where: { organizationId: actor.organizationId, id: { in: task.testOrderIds } },
        data: { status: OrderStatus.SUBMITTED_FOR_REVIEW, completedAt: now, submittedAt: now },
      });
    });
  }

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role as Role,
    action: AUDIT_ACTIONS.TASK_OVERRIDDEN,
    entityType: "RoutingTask",
    entityId: task.id,
    newValue: { overrideAction: input.action },
    notes: input.reason ?? `Override action: ${input.action}`,
  });
}
