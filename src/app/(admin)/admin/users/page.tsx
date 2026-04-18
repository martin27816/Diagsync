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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Users</h1>
        <p className="text-xs text-slate-500">Platform-wide user list across all organizations.</p>
      </div>

      <form className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search name or email"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="organizationId"
          defaultValue={organizationId}
          placeholder="Filter by organization ID"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <select name="role" defaultValue={role} className="rounded border border-slate-200 px-3 py-2 text-sm">
          <option value="">All roles</option>
          <option value="MEGA_ADMIN">MEGA_ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          <option value="HRM">HRM</option>
          <option value="RECEPTIONIST">RECEPTIONIST</option>
          <option value="LAB_SCIENTIST">LAB_SCIENTIST</option>
          <option value="RADIOGRAPHER">RADIOGRAPHER</option>
          <option value="MD">MD</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white sm:col-span-4">
          Apply Filters
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Last Seen</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No users match this filter
                  </td>
                </tr>
              ) : (
                data.items.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{user.name}</td>
                    <td className="px-4 py-2 text-slate-500">{user.email}</td>
                    <td className="px-4 py-2 text-slate-600">{user.role}</td>
                    <td className="px-4 py-2 text-slate-500">{user.organization?.name ?? "Platform"}</td>
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {Math.max(data.totalPages, 1)} - {data.total} users
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/users?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
