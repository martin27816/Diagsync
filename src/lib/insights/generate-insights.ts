import { prisma } from "@/lib/prisma";
import { NotificationType, Role } from "@prisma/client";
import { sendNotificationToRoles } from "@/lib/notifications";

type WeekdayName =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

const WEEKDAYS: WeekdayName[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function safePercentGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getDateRangeDurationMs(start: Date, end: Date) {
  return Math.max(1, end.getTime() - start.getTime());
}

function getPreviousRange(start: Date, end: Date) {
  const duration = getDateRangeDurationMs(start, end);
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}

function getBusiestAndQuietestDays(dates: Date[]) {
  const dayCounts = WEEKDAYS.map((day) => ({ day, count: 0 }));
  for (const dt of dates) {
    dayCounts[dt.getDay()].count += 1;
  }
  const busiest = dayCounts.reduce((a, b) => (b.count > a.count ? b : a), dayCounts[0]);
  const quietest = dayCounts.reduce((a, b) => (b.count < a.count ? b : a), dayCounts[0]);
  return { busiestDay: busiest.day, quietestDay: quietest.day };
}

function extractSuggestion(testName: string): string | null {
  const name = testName.toLowerCase();
  if (name.includes("malaria")) return "FBC";
  if (name === "fbs" || name.includes("fasting blood sugar")) return "Lipid Profile";
  return null;
}

export async function generateLabInsights(orgId: string, start: Date, end: Date) {
  const previousRange = getPreviousRange(start, end);
  const [revenueAgg, previousRevenueAgg, totalPatients, newPatients, topTestsAgg, periodOrders, periodVisits] =
    await Promise.all([
      prisma.visitPayment.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      prisma.visitPayment.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: previousRange.start, lt: previousRange.end },
        },
        _sum: { amount: true },
      }),
      prisma.visit.count({
        where: {
          organizationId: orgId,
          registeredAt: { gte: start, lt: end },
        },
      }),
      prisma.patient.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.testOrder.groupBy({
        by: ["testId"],
        where: {
          organizationId: orgId,
          registeredAt: { gte: start, lt: end },
        },
        _sum: { price: true },
        orderBy: { _sum: { price: "desc" } },
        take: 5,
      }),
      prisma.testOrder.findMany({
        where: {
          organizationId: orgId,
          registeredAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          visitId: true,
          startedAt: true,
          completedAt: true,
          assignedToId: true,
          test: {
            select: {
              id: true,
              name: true,
              turnaroundMinutes: true,
            },
          },
        },
      }),
      prisma.visit.findMany({
        where: {
          organizationId: orgId,
          registeredAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          registeredAt: true,
        },
      }),
    ]);

  const revenue = Number(revenueAgg._sum.amount ?? 0);
  const previousRevenue = Number(previousRevenueAgg._sum.amount ?? 0);
  const growth = safePercentGrowth(revenue, previousRevenue);

  const topTestIds = topTestsAgg.map((row) => row.testId);
  const tests = topTestIds.length
    ? await prisma.diagnosticTest.findMany({
        where: { id: { in: topTestIds } },
        select: { id: true, name: true },
      })
    : [];
  const testNameMap = new Map(tests.map((t) => [t.id, t.name]));
  const topTests = topTestsAgg.map((row) => ({
    testId: row.testId,
    testName: testNameMap.get(row.testId) ?? "Unknown Test",
    amount: Number(row._sum.price ?? 0),
  }));

  let delays = 0;
  const staffTotals = new Map<string, { completedTests: number; totalDelayMinutes: number }>();
  for (const order of periodOrders) {
    if (!order.startedAt || !order.completedAt) continue;
    const elapsedMinutes = Math.max(
      0,
      Math.floor((order.completedAt.getTime() - order.startedAt.getTime()) / 60000)
    );
    const delayMinutes = Math.max(0, elapsedMinutes - order.test.turnaroundMinutes);
    if (delayMinutes > 0) delays += 1;

    if (!order.assignedToId) continue;
    const existing = staffTotals.get(order.assignedToId) ?? {
      completedTests: 0,
      totalDelayMinutes: 0,
    };
    existing.completedTests += 1;
    existing.totalDelayMinutes += delayMinutes;
    staffTotals.set(order.assignedToId, existing);
  }

  const staffIds = Array.from(staffTotals.keys());
  const staffRows = staffIds.length
    ? await prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const staffNameMap = new Map(staffRows.map((s) => [s.id, s.fullName]));
  const staffPerformance = staffIds.map((staffId) => {
    const row = staffTotals.get(staffId)!;
    return {
      staffId,
      staffName: staffNameMap.get(staffId) ?? "Unknown Staff",
      completedTests: row.completedTests,
      averageDelayMinutes:
        row.completedTests > 0 ? Number((row.totalDelayMinutes / row.completedTests).toFixed(2)) : 0,
    };
  });

  const { busiestDay, quietestDay } = getBusiestAndQuietestDays(periodVisits.map((v) => v.registeredAt));

  const singleTestVisits = await prisma.testOrder.groupBy({
    by: ["visitId"],
    where: {
      organizationId: orgId,
      registeredAt: { gte: start, lt: end },
    },
    _count: { _all: true },
    having: {
      visitId: {
        _count: {
          equals: 1,
        },
      },
    },
  });
  const singleVisitIds = singleTestVisits.map((v) => v.visitId);
  const singleOrders = singleVisitIds.length
    ? await prisma.testOrder.findMany({
        where: {
          organizationId: orgId,
          visitId: { in: singleVisitIds },
        },
        select: {
          visitId: true,
          test: { select: { name: true } },
        },
      })
    : [];

  const missedOpportunities = singleOrders.reduce((acc, order) => {
    const suggestion = extractSuggestion(order.test.name);
    return suggestion ? acc + 1 : acc;
  }, 0);

  const data = {
    revenue,
    previousRevenue,
    growth,
    totalPatients,
    newPatients,
    topTests,
    delays,
    staffPerformance,
    busiestDay,
    quietestDay,
    missedOpportunities,
  };

  const diffDays = Math.ceil(getDateRangeDurationMs(start, end) / (24 * 60 * 60 * 1000));
  const reportType = diffDays <= 8 ? "WEEKLY" : "MONTHLY";

  const labInsightReport = (prisma as any).labInsightReport;
  const report = labInsightReport?.create
    ? await labInsightReport.create({
        data: {
          organizationId: orgId,
          periodStart: start,
          periodEnd: end,
          reportType,
          data,
        },
      })
    : null;

  await sendNotificationToRoles({
    organizationId: orgId,
    roles: [Role.SUPER_ADMIN],
    type: NotificationType.SYSTEM,
    title: "Lab Performance Report Ready",
    message: "Your Lab Performance Report is ready",
    entityId: report?.id,
    entityType: "LabInsightReport",
    dedupeKeyPrefix: report?.id ? `lab-insights:${report.id}` : undefined,
  });

  return data;
}
