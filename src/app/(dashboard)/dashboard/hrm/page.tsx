import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { formatDateTime, formatMinutes, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/index";
import { MdStaffCallPanel } from "@/components/md/md-staff-call-panel";

export default async function HRMDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard");

  const [totalStaff, activeStaff, unavailableStaff, recentAuditLogs, overview] =
    await Promise.all([
      prisma.staff.count({ where: { organizationId: user.organizationId } }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "AVAILABLE" },
      }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "UNAVAILABLE" },
      }),
      prisma.auditLog.findMany({
        where: { actor: { organizationId: user.organizationId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { fullName: true, role: true } } },
      }),
      getHrmOverview({
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
      }),
    ]);

  const metrics = [
    { label: "Patients Today", value: overview.metrics.todayPatients },
    { label: "Active Visits", value: overview.metrics.activeVisits },
    { label: "Pending Tasks", value: overview.metrics.pendingTasks },
    { label: "Completed", value: overview.metrics.completedTasks },
    { label: "Delayed", value: overview.metrics.delayedTasks, alert: overview.metrics.delayedTasks > 0 },
    { label: "Unacked Alerts", value: overview.metrics.unacknowledgedAlerts, alert: overview.metrics.unacknowledgedAlerts > 0 },
    { label: "Total Staff", value: totalStaff },
    { label: "Available", value: activeStaff },
    { label: "Unavailable", value: unavailableStaff },
  ];

  const focusItems = [
    overview.metrics.unacknowledgedAlerts > 0
      ? `Acknowledge ${overview.metrics.unacknowledgedAlerts} vital alert(s) to reduce reliability risk.`
      : "No unacknowledged vital alerts.",
    overview.metrics.delayedTasks > 0
      ? `Intervene in ${overview.metrics.delayedTasks} delayed task(s): reassign or override where needed.`
      : "No delayed tasks right now.",
    overview.dominance.simplicityScore < 80
      ? "Simplicity score is below target: reduce pending backlog and keep one clear next action per task."
      : "Simplicity score is on track.",
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">Live workflow across your lab</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/hrm/consultation"
            className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors sm:py-1.5"
          >
            Consultation Monitor
          </Link>
          {user.role === "SUPER_ADMIN" && (
            <Link
              href="/dashboard/hrm/settings"
              className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors sm:py-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </Link>
          )}
        </div>
      </div>
      <MdStaffCallPanel callerRole={user.role} />


      {/* Metrics strip — 3-col on mobile, 4-col on sm, 8-col on lg */}
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden sm:grid-cols-4 lg:grid-cols-9">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white px-3 py-3 sm:px-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">{m.label}</p>
            <p className={`text-lg font-bold mt-0.5 sm:text-xl ${m.alert ? "text-red-600" : "text-slate-800"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Score strip — 2-col on mobile, 5-col on lg */}
      <div className="grid grid-cols-2 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Overall", value: overview.dominance.overallScore },
          { label: "Speed", value: overview.dominance.speedScore },
          { label: "Simplicity", value: overview.dominance.simplicityScore },
          { label: "Reliability", value: overview.dominance.reliabilityScore },
          { label: "Automation", value: overview.dominance.automationScore },
        ].map((item) => (
          <div key={item.label} className="bg-white px-3 py-3 sm:px-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">{item.label} Score</p>
            <p
              className={`text-lg font-bold mt-0.5 sm:text-xl ${
                item.value >= 85 ? "text-green-700" : item.value >= 70 ? "text-amber-700" : "text-red-700"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Today's focus */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today's Focus</p>
        <div className="mt-2 space-y-1.5">
          {focusItems.map((item) => (
            <p key={item} className="text-xs text-slate-600">
              {item}
            </p>
          ))}
        </div>
      </div>

      {/* Two column: analytics + activity — stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Analytics */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analytics</span>
            <Link href="/dashboard/hrm/operations" className="text-xs text-blue-600 hover:underline">
              View operations →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-500">Avg. completion time</span>
              <span className="text-xs font-semibold text-slate-800">
                {formatMinutes(overview.analytics.averageCompletionMinutes)}
              </span>
            </div>

            {/* Tasks per dept */}
            <div className="px-4 py-2.5">
              <p className="text-xs text-slate-400 mb-2">Tasks per department</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(overview.analytics.tasksPerDepartment).map(([dept, count]) => (
                  <span
                    key={dept}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {dept}: <strong>{count as number}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Busiest staff */}
            <div className="px-4 py-2.5">
              <p className="text-xs text-slate-400 mb-2">Busiest staff</p>
              {overview.analytics.busiestStaff.length === 0 ? (
                <p className="text-xs text-slate-400">No active workload.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {overview.analytics.busiestStaff.map((s) => (
                        <tr key={s.id}>
                          <td className="py-1.5 font-medium text-slate-700">{s.fullName}</td>
                          <td className="py-1.5 text-slate-400">{ROLE_LABELS[s.role]}</td>
                          <td className="py-1.5 text-right">
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                s.overloaded
                                  ? "bg-red-50 text-red-600"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              {s.active} active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Activity</span>
            <Link href="/dashboard/hrm/audit" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>

          {recentAuditLogs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">No activity logged yet.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2 text-left font-medium text-slate-400">Staff</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-400">Action</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-400">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">{log.actor.fullName}</td>
                        <td className="px-4 py-2 text-slate-500 capitalize">
                          {log.action.replaceAll("_", " ").toLowerCase()}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-400 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-slate-100">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-4 py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{log.actor.fullName}</p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {log.action.replaceAll("_", " ").toLowerCase()}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
