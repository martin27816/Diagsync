import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizationDetail } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/utils";
import { activateLabAction, suspendLabAction } from "../actions";

export default async function AdminLabDetailPage({ params }: { params: { id: string } }) {
  await requireMegaAdmin();
  const detail = await getOrganizationDetail(params.id);

  if (!detail) {
    notFound();
  }

  const { organization, users, stats } = detail;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/labs" className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline">
            Back to labs
          </Link>
          <h1 className="mt-1 text-lg font-semibold uppercase tracking-[0.08em] text-cyan-100">{organization.name}</h1>
          <p className="text-xs text-[#8ea6d8]">{organization.email}</p>
        </div>
        {organization.status === "ACTIVE" ? (
          <form action={suspendLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20">
              Suspend Lab
            </button>
          </form>
        ) : (
          <form action={activateLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20">
              Activate Lab
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Plan</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{organization.plan}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Status</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{organization.status}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Created</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{formatDateTime(organization.createdAt)}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Last Activity</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">
            {stats.lastActivity ? formatDateTime(stats.lastActivity) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Total Patients</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{stats.totalPatients}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Total Test Requests</p>
          <p className="mt-1 text-2xl font-bold text-cyan-50">{stats.totalTestRequests}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="border-b border-cyan-500/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-cyan-500/15 bg-[#0d1626] text-left text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Last Seen</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#8ea6d8]">
                    No users found for this lab
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-cyan-500/10">
                    <td className="px-4 py-2 font-medium text-cyan-100">{user.fullName}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{user.email}</td>
                    <td className="px-4 py-2 text-[#b7c8ec]">{user.role}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">
                      {user.lastSeen ? formatDateTime(user.lastSeen) : "-"}
                    </td>
                    <td className="px-4 py-2 text-[#9db3e1]">{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
