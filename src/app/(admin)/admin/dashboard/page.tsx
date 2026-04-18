import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();
  const summary = analytics.summary;

  const cards = [
    { label: "Total Labs", value: summary.totalLabs, accent: "text-gray-900" },
    { label: "Active Labs", value: summary.activeLabs, accent: "text-emerald-600" },
    { label: "Suspended Labs", value: summary.suspendedLabs, accent: "text-red-500" },
    { label: "Total Users", value: summary.totalUsers, accent: "text-gray-900" },
    { label: "Total Patients", value: summary.totalPatients, accent: "text-gray-900" },
    { label: "Active Today", value: summary.activeToday, accent: "text-indigo-600" },
    { label: "Total Test Requests", value: summary.totalTestRequests, accent: "text-gray-900" },
    { label: "Labs This Month", value: summary.labsCreatedThisMonth, accent: "text-indigo-600" },
    { label: "Users Active This Week", value: summary.usersActiveThisWeek, accent: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold text-gray-900">Platform Dashboard</h1>
        <p className="text-xs text-gray-400 mt-0.5">Top-level metrics across all organizations.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Active labs table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Most Active Labs — This Week</p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">No lab activity found this week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Lab</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3 text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.activity.mostActiveLabs.map((lab) => (
                  <tr key={lab.organizationId ?? lab.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{lab.name}</td>
                    <td className="px-5 py-3 text-gray-400">{lab.email || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-indigo-600">{lab.activityCount}</td>
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