import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import type { AuditMeta } from "@/lib/audit-core";
import { notifyDepartmentStaffForTaskAssignment } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WORKLOAD_STATUSES,
  chooseLeastLoadedStaff,
  DEPARTMENT_ROLE_MAP,
  sortByPriorityHighToLow,
  WorkloadCandidate,
} from "@/lib/routing-core";
import {
  AvailabilityStatus,
  Department,
  OrderStatus,
  Priority,
  Role,
  RoutingTaskStatus,
  StaffStatus
} from "@prisma/client";

const ROUTABLE_DEPARTMENTS = new Set<Department>([
  Department.LABORATORY,
  Department.RADIOLOGY,
]);

type RoutingOptions = {
  organizationId: string;
  actorId?: string;
  actorRole?: Role;
  auditMeta?: AuditMeta;
};

export type RoutingAssignment = {
  department: Department;
  priority: Priority;
  staffId: string | null;
  staffName: string | null;
  testOrderIds: string[];
  testNames: string[];
};

export async function getDepartmentsForVisit(
  visitId: string,
  organizationId?: string
): Promise<Department[]> {
  const testOrders = await prisma.testOrder.findMany({
    where: {
      visitId,
      ...(organizationId ? { organizationId } : {}),
      status: OrderStatus.REGISTERED,
    },
    select: {
      test: { select: { department: true } },
    },
  });

  const unique = new Set<Department>();
  for (const order of testOrders) {
    unique.add(order.test.department);
  }
  return Array.from(unique);
}

export async function getAvailableStaff(
  departmentId: Department,
  organizationId: string
) {
  const targetRole = DEPARTMENT_ROLE_MAP[departmentId];
  if (!targetRole) return [];

  return prisma.staff.findMany({
    where: {
      organizationId,
      department: departmentId,
      role: targetRole,
      status: StaffStatus.ACTIVE,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
    },
    select: {
      id: true,
      fullName: true,
      department: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });
}

export async function getStaffWorkload(
  staffId: string,
  organizationId: string
): Promise<number> {
  return prisma.testOrder.count({
    where: {
      organizationId,
      assignedToId: staffId,
      status: { in: ACTIVE_WORKLOAD_STATUSES },
    },
  });
}

export async function assignTasksForVisit(
  visitId: string,
  options: RoutingOptions
): Promise<RoutingAssignment[]> {
  const visit = await prisma.visit.findFirst({
    where: {
      id: visitId,
      organizationId: options.organizationId,
    },
    include: {
      patient: { select: { fullName: true, patientId: true } },
      testOrders: {
        where: { status: OrderStatus.REGISTERED },
        include: { test: { select: { id: true, name: true, department: true } } },
      },
    },
  });

  if (!visit) {
    throw new Error("Visit not found");
  }

  if (visit.testOrders.length === 0) return [];

  const grouped = new Map<Department, Array<(typeof visit.testOrders)[number]>>();
  for (const order of visit.testOrders) {
    if (!ROUTABLE_DEPARTMENTS.has(order.test.department)) continue;
    const existing = grouped.get(order.test.department) ?? [];
    existing.push(order);
    grouped.set(order.test.department, existing);
  }

  const now = new Date();
  const assignments: RoutingAssignment[] = [];

  for (const [department, orders] of Array.from(grouped.entries())) {
    const staff = await getAvailableStaff(department, options.organizationId);
    const candidates: WorkloadCandidate[] = await Promise.all(
      staff.map(async (member) => ({
        id: member.id,
        fullName: member.fullName,
        workload: await getStaffWorkload(member.id, options.organizationId),
      }))
    );

    const selected = chooseLeastLoadedStaff(candidates);
    const testOrderIds = orders.map((order) => order.id);
    const testNames = orders.map((order) => order.test.name);

    const createdTask = await prisma.$transaction(async (tx) => {
      await tx.testOrder.updateMany({
        where: {
          id: { in: testOrderIds },
          organizationId: options.organizationId,
        },
        data: {
          status: OrderStatus.ASSIGNED,
          assignedAt: now,
          assignedToId: selected?.id ?? null,
        },
      });

      return tx.routingTask.create({
        data: {
          organizationId: options.organizationId,
          visitId: visit.id,
          department,
          staffId: selected?.id ?? null,
          priority: visit.priority,
          status: RoutingTaskStatus.PENDING,
          testOrderIds,
        },
      });
    });

    assignments.push({
      department,
      priority: visit.priority,
      staffId: selected?.id ?? null,
      staffName: selected?.fullName ?? null,
      testOrderIds,
      testNames,
    });

    const targetRole = DEPARTMENT_ROLE_MAP[department];
    if (targetRole) {
      await notifyDepartmentStaffForTaskAssignment({
        organizationId: options.organizationId,
        department,
        role: targetRole,
        taskId: createdTask.id,
        testNames,
        patientName: visit.patient.fullName,
        onlyAvailable: true,
      });
    }

    if (options.actorId && options.actorRole) {
      for (const order of orders) {
        await createAuditLog({
          actorId: options.actorId,
          actorRole: options.actorRole,
          action: AUDIT_ACTIONS.TEST_ASSIGNED,
          entityType: "TestOrder",
          entityId: order.id,
          newValue: {
            testName: order.test.name,
            patientName: visit.patient.fullName,
            patientId: visit.patient.patientId,
            assignedTo: selected?.fullName ?? "Unassigned (no available staff)",
            department,
            priority: visit.priority,
          },
          ...options.auditMeta,
        });
      }
    }
  }

  return sortByPriorityHighToLow(assignments);
}
