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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/labs" className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
            Back to labs
          </Link>
          <h1 className="mt-1 text-base font-semibold text-gray-900">{organization.name}</h1>
          <p className="text-xs text-gray-400">{organization.email}</p>
        </div>
        {organization.status === "ACTIVE" ? (
          <form action={suspendLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-100 transition-colors">
              Suspend Lab
            </button>
          </form>
        ) : (
          <form action={activateLabAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-100 transition-colors">
              Activate Lab
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Plan</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{organization.plan}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Status</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{organization.status}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Created</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{formatDateTime(organization.createdAt)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Activity</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.lastActivity ? formatDateTime(stats.lastActivity) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Patients</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Test Requests</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalTestRequests}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Last Seen</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    No users found for this lab
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{user.fullName}</td>
                    <td className="px-5 py-3 text-gray-400">{user.email}</td>
                    <td className="px-5 py-3 text-gray-600">{user.role}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {user.lastSeen ? formatDateTime(user.lastSeen) : "-"}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{formatDateTime(user.createdAt)}</td>
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
