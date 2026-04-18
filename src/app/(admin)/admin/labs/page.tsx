import Link from "next/link";
import { listOrganizations } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/utils";
import { activateLabAction, suspendLabAction } from "./actions";

type SearchParams = {
  page?: string;
  pageSize?: string;
  search?: string;
  plan?: string;
  status?: string;
};

export default async function AdminLabsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireMegaAdmin();

  const page = Number(searchParams.page ?? "1");
  const pageSize = Number(searchParams.pageSize ?? "20");
  const search = searchParams.search ?? "";
  const plan = searchParams.plan ?? "";
  const status = searchParams.status ?? "";

  const data = await listOrganizations({
    page,
    pageSize,
    search: search || undefined,
    plan: plan || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.08em] text-cyan-100">Labs</h1>
        <p className="text-xs text-[#8ea6d8]">Monitor and manage organizations on the platform.</p>
      </div>

      <form className="grid grid-cols-1 gap-2 rounded-xl border border-cyan-500/20 bg-[#08101d]/85 p-3 shadow-[0_18px_36px_rgba(2,8,23,0.55)] sm:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search lab name or email"
          className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100 placeholder:text-[#7390c7]"
        />
        <select name="plan" defaultValue={plan} className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100">
          <option value="">All plans</option>
          <option value="STARTER">STARTER</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-cyan-500/30 bg-[#0b1628] px-3 py-2 text-sm text-cyan-100"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/30">Apply</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-[#08101d]/85 shadow-[0_18px_36px_rgba(2,8,23,0.55)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-cyan-500/15 bg-[#0d1626] text-left text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                <th className="px-4 py-2">Lab Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total Users</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Last Activity</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8ea6d8]">
                    No labs found
                  </td>
                </tr>
              ) : (
                data.items.map((lab) => (
                  <tr key={lab.id} className="border-b border-cyan-500/10">
                    <td className="px-4 py-2 font-medium text-cyan-100">{lab.name}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{lab.email}</td>
                    <td className="px-4 py-2 text-[#b7c8ec]">{lab.plan}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          lab.status === "ACTIVE"
                            ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border border-red-400/30 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-cyan-100">{lab.totalUsers}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">{formatDateTime(lab.createdAt)}</td>
                    <td className="px-4 py-2 text-[#9db3e1]">
                      {lab.lastActivity ? formatDateTime(lab.lastActivity) : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/labs/${lab.id}`}
                          className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                        >
                          View
                        </Link>
                        {lab.status === "ACTIVE" ? (
                          <form action={suspendLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded-lg border border-red-400/35 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20">
                              Suspend
                            </button>
                          </form>
                        ) : (
                          <form action={activateLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20">
                              Activate
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-[#08101d]/85 px-4 py-3 text-sm">
        <p className="text-[#9db3e1]">
          Page {data.page} of {Math.max(data.totalPages, 1)} - {data.total} labs
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/labs?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-cyan-500/10 text-[#5f739c]" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/labs?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded-lg border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-cyan-500/10 text-[#5f739c]" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
