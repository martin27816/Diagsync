import Link from "next/link";
import { notFound } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";
import { getOrganizationDetail } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import {
  activateLabAction,
  approvePaymentRequestAction,
  rejectPaymentRequestAction,
  suspendLabAction,
  syncLabCatalogAction,
} from "../actions";

function asNumber(value: Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export default async function AdminLabDetailPage({ params }: { params: { id: string } }) {
  await requireMegaAdmin();
  const detail = await getOrganizationDetail(params.id);

  if (!detail) {
    notFound();
  }

  const { organization, users, paymentRequests, stats } = detail;

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
        <div className="flex items-center gap-2">
          <form action={syncLabCatalogAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <button className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100">
              Sync Test Catalog
            </button>
          </form>
          {organization.status === "SUSPENDED" ? (
            <form action={activateLabAction}>
              <input type="hidden" name="organizationId" value={organization.id} />
              <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-100">
                Activate Lab
              </button>
            </form>
          ) : (
            <form action={suspendLabAction}>
              <input type="hidden" name="organizationId" value={organization.id} />
              <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-100">
                Suspend Lab
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Plan</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{organization.plan}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{organization.status}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Created</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{formatDateTime(organization.createdAt)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Last Activity</p>
          <p className="mt-2 text-xl font-semibold text-gray-900">{stats.lastActivity ? formatDateTime(stats.lastActivity) : "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Patients</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Test Requests</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalTestRequests}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800">Billing</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-medium text-gray-500">Trial</p>
            <p className="mt-1 text-gray-700">Start: {organization.trialStartedAt ? formatDateTime(organization.trialStartedAt) : "-"}</p>
            <p className="text-gray-700">End: {organization.trialEndsAt ? formatDateTime(organization.trialEndsAt) : "-"}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-medium text-gray-500">Subscription</p>
            <p className="mt-1 text-gray-700">Start: {organization.subscriptionStartedAt ? formatDateTime(organization.subscriptionStartedAt) : "-"}</p>
            <p className="text-gray-700">End: {organization.subscriptionEndsAt ? formatDateTime(organization.subscriptionEndsAt) : "-"}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-medium text-gray-500">Current Controls</p>
            <p className="mt-1 text-gray-700">Watermark: {organization.watermarkEnabled ? "Enabled" : "Disabled"}</p>
            <p className="text-gray-700">Staff Limit: {organization.staffLimit ?? "Unlimited"}</p>
            <p className="text-gray-700">Last Payment: {organization.lastPaymentAt ? formatDateTime(organization.lastPaymentAt) : "-"}</p>
          </div>
        </div>
        {organization.billingLockReason ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Billing lock: {organization.billingLockReason}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Payment Requests</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3">Requested Plan</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Proof</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Submitted</th>
                <th className="px-5 py-3">Reviewed</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    No payment requests found for this lab
                  </td>
                </tr>
              ) : (
                paymentRequests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{request.requestedPlan}</td>
                    <td className="px-5 py-3 text-gray-700">{formatCurrency(asNumber(request.amount))}</td>
                    <td className="px-5 py-3 text-gray-500">{request.transactionReference ?? "-"}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {request.proofUrl ? (
                        <a className="text-blue-600 hover:underline" href={request.proofUrl} target="_blank" rel="noreferrer">
                          View proof
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          request.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : request.status === "REJECTED"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDateTime(request.createdAt)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {request.reviewedAt
                        ? `${formatDateTime(request.reviewedAt)}${request.reviewedBy ? ` by ${request.reviewedBy.fullName}` : ""}`
                        : "-"}
                    </td>
                    <td className="px-5 py-3">
                      {request.status === "PENDING" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={approvePaymentRequestAction}>
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <input type="hidden" name="paymentRequestId" value={request.id} />
                            <button className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50">
                              Approve
                            </button>
                          </form>
                          <form action={rejectPaymentRequestAction} className="flex items-center gap-1">
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <input type="hidden" name="paymentRequestId" value={request.id} />
                            <input
                              name="rejectionNote"
                              placeholder="Reason"
                              className="h-7 rounded border border-gray-200 px-2 text-xs text-gray-700"
                            />
                            <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No action</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                  <tr key={user.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{user.fullName}</td>
                    <td className="px-5 py-3 text-gray-400">{user.email}</td>
                    <td className="px-5 py-3 text-gray-600">{user.role}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{user.lastSeen ? formatDateTime(user.lastSeen) : "-"}</td>
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
