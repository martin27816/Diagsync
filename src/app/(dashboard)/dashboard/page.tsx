import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getRevenueStats } from "@/lib/analytics/revenue";
import { getLabStats } from "@/lib/analytics/lab-stats";
import { StatCard } from "@/components/insights/StatCard";
import { SectionCard } from "@/components/insights/SectionCard";
import { getDashboardPath } from "@/lib/utils";

export default async function InsightsDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM", "MD"].includes(user.role)) {
    redirect(getDashboardPath(user.role));
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [revenueStats, labStats, patientsToday, recentOrders] = await Promise.all([
    getRevenueStats(user.organizationId),
    getLabStats(user.organizationId),
    prisma.visit.count({
      where: { organizationId: user.organizationId, registeredAt: { gte: todayStart, lt: now } },
    }),
    prisma.testOrder.findMany({
      where: {
        organizationId: user.organizationId,
        startedAt: { not: null },
        completedAt: { not: null, gte: weekStart, lt: now },
      },
      select: {
        assignedToId: true,
        startedAt: true,
        completedAt: true,
        test: { select: { turnaroundMinutes: true } },
      },
    }),
  ]);

  let alerts = 0;
  const staffCountMap = new Map<string, number>();
  for (const order of recentOrders) {
    if (!order.startedAt || !order.completedAt) continue;
    const elapsedMinutes = Math.floor((order.completedAt.getTime() - order.startedAt.getTime()) / 60000);
    if (elapsedMinutes > order.test.turnaroundMinutes) alerts += 1;
    if (order.assignedToId) {
      staffCountMap.set(order.assignedToId, (staffCountMap.get(order.assignedToId) ?? 0) + 1);
    }
  }

  const staffIds = Array.from(staffCountMap.keys());
  const staffRows = staffIds.length
    ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } })
    : [];
  const staffNameMap = new Map(staffRows.map((s) => [s.id, s.fullName]));
  const staffPerformance = staffIds
    .map((id) => ({ id, name: staffNameMap.get(id) ?? "Unknown Staff", completedTests: staffCountMap.get(id) ?? 0 }))
    .sort((a, b) => b.completedTests - a.completedTests)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Insights Dashboard</h1>
        <p className="text-xs text-slate-500">Revenue, growth, activity and performance at a glance.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Revenue Today"
          value={formatCurrency(revenueStats.todayRevenue)}
          sub={`This Month: ${formatCurrency(revenueStats.monthRevenue)}`}
        />
        <StatCard
          title="Growth"
          value={`${revenueStats.growth >= 0 ? "+" : ""}${revenueStats.growth}%`}
          sub="vs last period"
          color={revenueStats.growth >= 0 ? "green" : "red"}
        />
        <StatCard
          title="Patients Today"
          value={`${patientsToday}`}
          sub={`This week: ${labStats.patientsThisWeek}`}
        />
        <StatCard
          title="Operational Alerts"
          value={`${alerts} Delays`}
          sub={alerts > 0 ? "Needs attention" : "No delay warnings"}
          color={alerts > 0 ? "red" : "green"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Top Tests">
          {revenueStats.topTests.length === 0 ? (
            <p className="text-xs text-slate-500">No data yet</p>
          ) : (
            <div className="space-y-2">
              {revenueStats.topTests.map((test) => (
                <div key={test.testId} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                  <span className="text-sm text-slate-700">{test.testName}</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(test.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Staff Performance">
          {staffPerformance.length === 0 ? (
            <p className="text-xs text-slate-500">No data yet</p>
          ) : (
            <div className="space-y-2">
              {staffPerformance.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                  <span className="text-sm text-slate-700">{staff.name}</span>
                  <span className="text-sm font-semibold text-slate-900">{staff.completedTests} tests</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <SectionCard title="Weekly Summary">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Patients This Week</p>
            <p className="text-lg font-semibold text-slate-900">{labStats.patientsThisWeek}</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Growth %</p>
            <p className={`text-lg font-semibold ${labStats.growthPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {labStats.growthPercent >= 0 ? "+" : ""}
              {labStats.growthPercent}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Busiest Day</p>
            <p className="text-lg font-semibold text-slate-900">{labStats.busiestDay}</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Quietest Day</p>
            <p className="text-lg font-semibold text-slate-900">{labStats.quietestDay}</p>
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Link href="/insights/reports" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          View Full Report →
        </Link>
      </div>
    </div>
  );
}
