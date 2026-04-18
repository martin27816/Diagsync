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
        <h1 className="text-lg font-semibold uppercase tracking-[0.08em] text-cyan-100">Platform Dashboard</h1>
        <p className="text-xs text-[#8ea6d8]">Top-level metrics across all organizations.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_18px_36px_rgba(2,8,23,0.55)]">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-cyan-50">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="border-b border-cyan-500/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
            Most Active Labs (This Week)
          </p>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#8ea6d8]">No lab activity found this week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
