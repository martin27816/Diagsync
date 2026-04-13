import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { formatDateTime, formatMinutes, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/index";

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
    { label: "Total Staff", value: totalStaff },
    { label: "Available", value: activeStaff },
    { label: "Unavailable", value: unavailableStaff },
  ];

  return (
    <div className="relative space-y-5 overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute top-24 right-[-4rem] h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-indigo-100/30 blur-3xl" />
      {/* Page header */}
      <div className="relative z-10 flex items-center justify-between rounded-2xl border border-white/50 bg-white/55 px-4 py-3 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">Live workflow across your lab</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/hrm/consultation"
            className="inline-flex items-center gap-1.5 rounded border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors backdrop-blur"
          >
            Consultation Monitor
          </Link>
          {user.role === "SUPER_ADMIN" && (
            <Link
              href="/dashboard/hrm/settings"
              className="inline-flex items-center gap-1.5 rounded border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors backdrop-blur"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="relative z-10 grid grid-cols-4 gap-2 rounded-2xl border border-white/50 bg-white/45 p-2 shadow-[0_10px_36px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:grid-cols-8">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 backdrop-blur">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">{m.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${m.alert ? "text-red-600" : "text-slate-800"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Two column: analytics + activity */}
      <div className="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Analytics */}
        <div className="rounded-2xl border border-white/50 bg-white/60 overflow-hidden shadow-[0_10px_36px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/60 bg-white/35 px-4 py-2.5">
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
                    className="rounded border border-white/70 bg-white/70 px-2 py-0.5 text-xs text-slate-700 backdrop-blur"
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
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-white/50 bg-white/60 overflow-hidden shadow-[0_10px_36px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/60 bg-white/35 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Activity</span>
            <Link href="/dashboard/hrm/audit" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>

          {recentAuditLogs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">No activity logged yet.</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
