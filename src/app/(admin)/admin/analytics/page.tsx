import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminAnalyticsPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold text-gray-900">Platform Analytics</h1>
        <p className="text-xs text-gray-400 mt-0.5">Growth and activity across all labs.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Growth Data Points", value: analytics.growthSeries.length },
          { label: "Most Active Labs", value: analytics.activity.mostActiveLabs.length },
          { label: "Active Today", value: analytics.summary.activeToday },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Growth over time */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Growth Over Time</p>
        </div>
        {analytics.growthSeries.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">No growth data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Month</th>
                  <th className="px-5 py-3 text-right">Labs Created</th>
                  <th className="px-5 py-3 text-right">Users Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.growthSeries.map((row) => (
                  <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-700">{row.month}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.labs}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Most active labs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Most Active Labs</p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">No active labs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Lab</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3 text-right">Activity Count</th>
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