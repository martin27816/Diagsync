import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { redirect } from "next/navigation";
import { formatMinutes, ROLE_LABELS } from "@/lib/utils";

export default async function HrmAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["HRM", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  const overview = await getHrmOverview({
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Operations Analytics</h1>
        <p className="text-xs text-slate-400 mt-0.5">Throughput, delays, and workload across the lab.</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[
          { label: "Avg Completion Time", value: formatMinutes(overview.analytics.averageCompletionMinutes) },
          { label: "Delayed Tasks", value: overview.metrics.delayedTasks, alert: overview.metrics.delayedTasks > 0 },
          { label: "Highest Staff Load", value: overview.analytics.busiestStaff[0]?.active ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${(s as any).alert ? "text-red-600" : "text-slate-800"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tasks per department */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks Per Department</span>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {Object.entries(overview.analytics.tasksPerDepartment).map(([dept, count]) => (
            <span key={dept} className="rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {dept}: <strong>{count as number}</strong>
            </span>
          ))}
          {Object.keys(overview.analytics.tasksPerDepartment).length === 0 && (
            <p className="text-xs text-slate-400">No task data yet.</p>
          )}
        </div>
      </div>

      {/* Busiest staff */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busiest Staff</span>
        </div>
        {overview.analytics.busiestStaff.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400">No active workload yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Role</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Active Tasks</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Workload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.analytics.busiestStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{staff.fullName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{ROLE_LABELS[staff.role]}</td>
                  <td className="px-4 py-2.5 text-slate-700">{staff.active}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${staff.overloaded ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {staff.overloaded ? "Overloaded" : "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}