import Link from "next/link";
import { listPlatformUsers } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/utils";

type SearchParams = {
  page?: string;
  pageSize?: string;
  search?: string;
  role?: string;
  organizationId?: string;
  status?: string;
};

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireMegaAdmin();

  const page = Number(searchParams.page ?? "1");
  const pageSize = Number(searchParams.pageSize ?? "20");
  const search = searchParams.search ?? "";
  const role = searchParams.role ?? "";
  const organizationId = searchParams.organizationId ?? "";
  const status = searchParams.status ?? "";

  const data = await listPlatformUsers({
    page,
    pageSize,
    search: search || undefined,
    role: role || undefined,
    organizationId: organizationId || undefined,
    status: status || undefined,
  });

  const rolePill: Record<string, string> = {
    MEGA_ADMIN: "bg-red-50 text-red-600",
    SUPER_ADMIN: "bg-amber-50 text-amber-600",
    HRM: "bg-indigo-50 text-indigo-600",
    RECEPTIONIST: "bg-blue-50 text-blue-600",
    LAB_SCIENTIST: "bg-violet-50 text-violet-600",
    RADIOGRAPHER: "bg-orange-50 text-orange-600",
    MD: "bg-teal-50 text-teal-600",
  };

  const statusPill: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    INACTIVE: "bg-gray-100 text-gray-400",
    SUSPENDED: "bg-red-50 text-red-500",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold text-gray-900">Users</h1>
        <p className="text-xs text-gray-400 mt-0.5">Platform-wide user list across all organizations.</p>
      </div>

      {/* Filters */}
      <form className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search name or email"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <input
          type="text"
          name="organizationId"
          defaultValue={organizationId}
          placeholder="Filter by organization ID"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <select name="role" defaultValue={role} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <option value="">All roles</option>
          <option value="MEGA_ADMIN">Mega Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="HRM">HRM</option>
          <option value="RECEPTIONIST">Receptionist</option>
          <option value="LAB_SCIENTIST">Lab Scientist</option>
          <option value="RADIOGRAPHER">Radiographer</option>
          <option value="MD">MD</option>
        </select>
        <select name="status" defaultValue={status} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors sm:col-span-2 lg:col-span-4">
          Apply Filters
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">Last Seen</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">No users match this filter</td>
                </tr>
              ) : (
                data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{user.name}</td>
                    <td className="px-5 py-3 text-gray-400">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${rolePill[user.role] ?? "bg-gray-100 text-gray-500"}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${statusPill[user.status] ?? "bg-gray-100 text-gray-400"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{user.organization?.name ?? "Platform"}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {user.lastSeen ? formatDateTime(user.lastSeen) : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <p className="text-xs text-gray-400">
          Page {data.page} of {Math.max(data.totalPages, 1)} · {data.total} users
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${data.page <= 1 ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/users?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${data.page >= data.totalPages ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}