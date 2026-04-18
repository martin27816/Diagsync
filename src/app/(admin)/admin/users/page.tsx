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
        <h1 className="text-lg font-semibold uppercase tracking-[0.08em] text-cyan-100">Users</h1>
        <p className="text-xs text-[#8ea6d8]">Platform-wide user list across all organizations.</p>
      </div>

      <form className="grid grid-cols-1 gap-2 rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-3 shadow-[0_18px_36px_rgba(2,8,23,0.55)] sm:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search name or email"
          className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100 placeholder:text-[#7390c7]"
        />
        <input
          type="text"
          name="organizationId"
          defaultValue={organizationId}
          placeholder="Filter by organization ID"
          className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100 placeholder:text-[#7390c7]"
        />
        <select name="role" defaultValue={role} className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100">
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
          className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/30 sm:col-span-4">
          Apply Filters
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-cyan-500/15 bg-[#0d1626] text-left text-xs uppercase tracking-[0.18em] text-cyan-200/70">
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
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8ea6d8]">
                    No users match this filter
                  </td>
                </tr>
              ) : (
                data.items.map((user) => (
                  <tr key={user.id} className="border-b border-cyan-500/10">
                    <td className="px-4 py-2 font-medium text-cyan-100">{user.name}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{user.email}</td>
                    <td className="px-4 py-2 text-[#b7c8ec]">{user.role}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{user.organization?.name ?? "Platform"}</td>
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

      <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-[#08101d]/85 px-4 py-3 text-sm">
        <p className="text-[#9db3e1]">
          Page {data.page} of {Math.max(data.totalPages, 1)} - {data.total} users
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-cyan-500/10 text-[#5f739c]" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/users?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`}
            className={`rounded-lg border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-cyan-500/10 text-[#5f739c]" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
