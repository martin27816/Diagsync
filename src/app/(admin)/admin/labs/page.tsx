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
        <h1 className="text-lg font-semibold text-slate-800">Labs</h1>
        <p className="text-xs text-slate-500">Monitor and manage organizations on the platform.</p>
      </div>

      <form className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search lab name or email"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <select name="plan" defaultValue={plan} className="rounded border border-slate-200 px-3 py-2 text-sm">
          <option value="">All plans</option>
          <option value="STARTER">STARTER</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white">Apply</button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    No labs found
                  </td>
                </tr>
              ) : (
                data.items.map((lab) => (
                  <tr key={lab.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{lab.name}</td>
                    <td className="px-4 py-2 text-slate-500">{lab.email}</td>
                    <td className="px-4 py-2 text-slate-600">{lab.plan}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          lab.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{lab.totalUsers}</td>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(lab.createdAt)}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {lab.lastActivity ? formatDateTime(lab.lastActivity) : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/labs/${lab.id}`}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        >
                          View
                        </Link>
                        {lab.status === "ACTIVE" ? (
                          <form action={suspendLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">
                              Suspend
                            </button>
                          </form>
                        ) : (
                          <form action={activateLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700">
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {Math.max(data.totalPages, 1)} - {data.total} labs
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/labs?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/labs?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
