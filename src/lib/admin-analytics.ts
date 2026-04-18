import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getAdminAnalytics() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const [
    totalLabs,
    activeLabs,
    suspendedLabs,
    totalUsers,
    totalPatients,
    activeToday,
    totalTestRequests,
    labsCreatedThisMonth,
    usersActiveThisWeek,
    labs,
    users,
    recentLabActivity,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "ACTIVE" } }),
    prisma.organization.count({ where: { status: "SUSPENDED" } }),
    prisma.staff.count({ where: { role: { not: "MEGA_ADMIN" } } }),
    prisma.patient.count(),
    prisma.staff.count({ where: { lastSeen: { gte: todayStart }, role: { not: "MEGA_ADMIN" } } }),
    prisma.testOrder.count(),
    prisma.organization.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.staff.count({ where: { lastSeen: { gte: weekStart }, role: { not: "MEGA_ADMIN" } } }),
    prisma.organization.findMany({
      where: { createdAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staff.findMany({
      where: {
        role: { not: "MEGA_ADMIN" },
        createdAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staff.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { not: null },
        lastSeen: { gte: weekStart },
        role: { not: "MEGA_ADMIN" },
      },
      _count: { _all: true },
      orderBy: { _count: { organizationId: "desc" } },
      take: 5,
    }),
  ]);

  const labsByMonth = new Map<string, number>();
  for (const lab of labs) {
    const key = toMonthKey(lab.createdAt);
    labsByMonth.set(key, (labsByMonth.get(key) ?? 0) + 1);
  }

  const usersByMonth = new Map<string, number>();
  for (const user of users) {
    const key = toMonthKey(user.createdAt);
    usersByMonth.set(key, (usersByMonth.get(key) ?? 0) + 1);
  }

  const allMonths = new Set<string>(
    Array.from(labsByMonth.keys()).concat(Array.from(usersByMonth.keys()))
  );
  const growthSeries = Array.from(allMonths)
    .sort()
    .map((month) => ({
      month,
      labs: labsByMonth.get(month) ?? 0,
      users: usersByMonth.get(month) ?? 0,
    }));

  const activeLabIds = recentLabActivity
    .map((item) => item.organizationId)
    .filter((id): id is string => Boolean(id));

  const activeLabMap = new Map(
    (
      await prisma.organization.findMany({
        where: { id: { in: activeLabIds } },
        select: { id: true, name: true, email: true },
      })
    ).map((org) => [org.id, org])
  );

  const mostActiveLabs = recentLabActivity.map((item) => {
    const org = item.organizationId ? activeLabMap.get(item.organizationId) : null;
    return {
      organizationId: item.organizationId,
      name: org?.name ?? "Unknown Lab",
      email: org?.email ?? "",
      activityCount: item._count._all,
    };
  });

  return {
    summary: {
      totalLabs,
      activeLabs,
      suspendedLabs,
      totalUsers,
      totalPatients,
      activeToday,
      totalTestRequests,
      labsCreatedThisMonth,
      usersActiveThisWeek,
    },
    growthSeries,
    activity: {
      mostActiveLabs,
    },
  };
}
