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
          <Link href="/admin/labs" className="text-xs text-blue-600 hover:underline">
            Back to labs
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-slate-800">{organization.name}</h1>
          <p className="text-xs text-slate-500">{organization.email}</p>
        </div>
        {organization.status === "ACTIVE" ? (
          <form action={suspendLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Suspend Lab
            </button>
          </form>
        ) : (
          <form action={activateLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Activate Lab
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Plan</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{organization.plan}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{organization.status}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Created</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{formatDateTime(organization.createdAt)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Last Activity</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {stats.lastActivity ? formatDateTime(stats.lastActivity) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.totalUsers}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Patients</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.totalPatients}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Test Requests</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.totalTestRequests}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    No users found for this lab
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{user.fullName}</td>
                    <td className="px-4 py-2 text-slate-500">{user.email}</td>
                    <td className="px-4 py-2 text-slate-600">{user.role}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {user.lastSeen ? formatDateTime(user.lastSeen) : "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(user.createdAt)}</td>
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
