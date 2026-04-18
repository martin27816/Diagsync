import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();
  const summary = analytics.summary;

  const cards = [
    { label: "Total Labs", value: summary.totalLabs },
    { label: "Active Labs", value: summary.activeLabs },
    { label: "Suspended Labs", value: summary.suspendedLabs },
    { label: "Total Users", value: summary.totalUsers },
    { label: "Total Patients", value: summary.totalPatients },
    { label: "Active Today", value: summary.activeToday },
    { label: "Total Test Requests", value: summary.totalTestRequests },
    { label: "Labs This Month", value: summary.labsCreatedThisMonth },
    { label: "Users Active This Week", value: summary.usersActiveThisWeek },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Platform Dashboard</h1>
        <p className="text-xs text-slate-500">Top-level metrics across all organizations.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Most Active Labs (This Week)
          </p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No lab activity found this week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2 text-right">Activity Count</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activity.mostActiveLabs.map((lab) => (
                  <tr key={lab.organizationId ?? lab.name} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{lab.name}</td>
                    <td className="px-4 py-2 text-slate-500">{lab.email || "-"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-700">
                      {lab.activityCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
