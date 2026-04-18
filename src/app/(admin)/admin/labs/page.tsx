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
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold text-gray-900">Labs</h1>
        <p className="text-xs text-gray-400 mt-0.5">Monitor and manage organizations on the platform.</p>
      </div>

      {/* Filters */}
      <form className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search lab name or email"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <select name="plan" defaultValue={plan} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <option value="">All plans</option>
          <option value="STARTER">Starter</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <select name="status" defaultValue={status} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3">Lab Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Users</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Last Activity</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">No labs found</td>
                </tr>
              ) : (
                data.items.map((lab) => (
                  <tr key={lab.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{lab.name}</td>
                    <td className="px-5 py-3 text-gray-400">{lab.email}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">{lab.plan}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5 ${
                        lab.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${lab.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">{lab.totalUsers}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDateTime(lab.createdAt)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {lab.lastActivity ? formatDateTime(lab.lastActivity) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/labs/${lab.id}`}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          View
                        </Link>
                        {lab.status === "ACTIVE" ? (
                          <form action={suspendLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                              Suspend
                            </button>
                          </form>
                        ) : (
                          <form action={activateLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors">
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

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm text-sm">
        <p className="text-gray-400 text-xs">
          Page {data.page} of {Math.max(data.totalPages, 1)} · {data.total} labs
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/labs?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${data.page <= 1 ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Previous
          </Link>
          <Link
            href={`/admin/labs?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${data.page >= data.totalPages ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}