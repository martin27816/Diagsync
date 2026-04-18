import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminAnalyticsPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.08em] text-cyan-100">Platform Analytics</h1>
        <p className="text-xs text-[#8ea6d8]">Growth and activity across all labs.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Labs Growth Rows</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{analytics.growthSeries.length}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Most Active Labs</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{analytics.activity.mostActiveLabs.length}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Activity Counts</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{analytics.summary.activeToday}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="border-b border-cyan-500/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Growth Over Time</p>
        </div>
        {analytics.growthSeries.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#8ea6d8]">No growth data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-cyan-500/15 bg-[#0d1626] text-left text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Labs Created</th>
                  <th className="px-4 py-2 text-right">Users Created</th>
                </tr>
              </thead>
              <tbody>
                {analytics.growthSeries.map((row) => (
                  <tr key={row.month} className="border-b border-cyan-500/10">
                    <td className="px-4 py-2 font-medium text-cyan-100">{row.month}</td>
                    <td className="px-4 py-2 text-right text-cyan-100">{row.labs}</td>
                    <td className="px-4 py-2 text-right text-cyan-100">{row.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="border-b border-cyan-500/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Most Active Labs</p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#8ea6d8]">No active labs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-cyan-500/15 bg-[#0d1626] text-left text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2 text-right">Activity Count</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activity.mostActiveLabs.map((lab) => (
                  <tr key={lab.organizationId ?? lab.name} className="border-b border-cyan-500/10">
                    <td className="px-4 py-2 font-medium text-cyan-100">{lab.name}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{lab.email || "-"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-cyan-50">
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
