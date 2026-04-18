import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type ListOrganizationsParams = {
  page: number;
  pageSize: number;
  search?: string;
  plan?: string;
  status?: string;
};

export async function listOrganizations(params: ListOrganizationsParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const search = params.search?.trim();

  const where: Prisma.OrganizationWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.plan ? { plan: params.plan as any } : {}),
    ...(params.status ? { status: params.status as any } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            staff: true,
            patients: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  const activityByOrg = new Map(
    (
      await prisma.staff.groupBy({
        by: ["organizationId"],
        where: {
          organizationId: { in: items.map((item) => item.id) },
          lastSeen: { not: null },
        },
        _max: { lastSeen: true },
      })
    )
      .filter((item) => item.organizationId)
      .map((item) => [item.organizationId as string, item._max.lastSeen])
  );

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      plan: item.plan,
      status: item.status,
      createdAt: item.createdAt,
      totalUsers: item._count.staff,
      totalPatients: item._count.patients,
      lastActivity: activityByOrg.get(item.id) ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getOrganizationDetail(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      status: true,
      phone: true,
      address: true,
      createdAt: true,
      _count: {
        select: {
          staff: true,
          patients: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const [users, totalTestRequests, lastActivityResult] = await Promise.all([
    prisma.staff.findMany({
      where: { organizationId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        lastSeen: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testOrder.count({ where: { organizationId } }),
    prisma.staff.aggregate({
      where: { organizationId, lastSeen: { not: null } },
      _max: { lastSeen: true },
    }),
  ]);

  return {
    organization,
    users,
    stats: {
      totalUsers: organization._count.staff,
      totalPatients: organization._count.patients,
      totalTestRequests,
      lastActivity: lastActivityResult._max.lastSeen ?? null,
    },
  };
}

type ListPlatformUsersParams = {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  organizationId?: string;
  status?: string;
};

export async function listPlatformUsers(params: ListPlatformUsersParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const search = params.search?.trim();

  const where: Prisma.StaffWhereInput = {
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.role ? { role: params.role as any } : {}),
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
    ...(params.status ? { status: params.status as any } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.staff.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.fullName,
      email: item.email,
      role: item.role,
      status: item.status,
      organization: item.organization
        ? { id: item.organization.id, name: item.organization.name }
        : null,
      lastSeen: item.lastSeen,
      createdAt: item.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function setOrganizationStatus(organizationId: string, status: "ACTIVE" | "SUSPENDED") {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });
}
