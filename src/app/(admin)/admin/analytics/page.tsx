import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminAnalyticsPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Platform Analytics</h1>
        <p className="text-xs text-slate-500">Growth and activity across all labs.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Labs Growth Rows</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{analytics.growthSeries.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Most Active Labs</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{analytics.activity.mostActiveLabs.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Activity Counts</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{analytics.summary.activeToday}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Growth Over Time</p>
        </div>
        {analytics.growthSeries.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">No growth data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Labs Created</th>
                  <th className="px-4 py-2 text-right">Users Created</th>
                </tr>
              </thead>
              <tbody>
                {analytics.growthSeries.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{row.month}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.labs}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Most Active Labs</p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">No active labs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
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
