import { prisma } from "@/lib/prisma";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function safeGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export async function getLabStats(orgId: string) {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [patientsThisWeek, patientsLastWeek, visitsThisWeek] = await Promise.all([
    prisma.visit.count({
      where: {
        organizationId: orgId,
        registeredAt: { gte: thisWeekStart, lt: now },
      },
    }),
    prisma.visit.count({
      where: {
        organizationId: orgId,
        registeredAt: { gte: lastWeekStart, lt: thisWeekStart },
      },
    }),
    prisma.visit.findMany({
      where: {
        organizationId: orgId,
        registeredAt: { gte: thisWeekStart, lt: now },
      },
      select: { registeredAt: true },
    }),
  ]);

  const dayCounts = WEEKDAY.map((day) => ({ day, count: 0 }));
  for (const visit of visitsThisWeek) {
    dayCounts[visit.registeredAt.getDay()].count += 1;
  }
  const busiest = dayCounts.reduce((a, b) => (b.count > a.count ? b : a), dayCounts[0]);
  const quietest = dayCounts.reduce((a, b) => (b.count < a.count ? b : a), dayCounts[0]);

  return {
    patientsThisWeek,
    patientsLastWeek,
    growthPercent: safeGrowth(patientsThisWeek, patientsLastWeek),
    busiestDay: busiest.day,
    quietestDay: quietest.day,
  };
}
