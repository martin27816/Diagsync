import { auth } from "@/lib/auth";
import { canViewAuditLogs } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDateTime, ROLE_LABELS } from "@/lib/utils";

function shortValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 60)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  if (typeof value === "object") return "{…}";
  return String(value);
}

function pickDisplayChanges(log: { changes: unknown; newValue: unknown; oldValue: unknown }) {
  const payload =
    (log.changes && typeof log.changes === "object" ? log.changes : null) ??
    (log.newValue && typeof log.newValue === "object" ? log.newValue : null) ??
    (log.oldValue && typeof log.oldValue === "object" ? log.oldValue : null);
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .slice(0, 4)
    .map(([key, value]) => ({ key, value: shortValue(value) }));
}

const actionStyle: Record<string, string> = {
  STAFF_CREATED: "bg-green-50 text-green-700",
  STAFF_UPDATED: "bg-blue-50 text-blue-700",
  STAFF_DEACTIVATED: "bg-red-50 text-red-600",
  ORGANIZATION_CREATED: "bg-green-50 text-green-700",
  ORGANIZATION_UPDATED: "bg-blue-50 text-blue-700",
  AVAILABILITY_CHANGED: "bg-amber-50 text-amber-700",
  STAFF_LOGIN: "bg-slate-100 text-slate-600",
  STAFF_LOGOUT: "bg-slate-100 text-slate-600",
  TEST_ASSIGNED: "bg-blue-50 text-blue-700",
  TEST_REASSIGNED: "bg-amber-50 text-amber-700",
  TEST_STARTED: "bg-blue-50 text-blue-700",
  RESULT_SUBMITTED: "bg-green-50 text-green-700",
  RESULT_APPROVED: "bg-green-50 text-green-700",
  RESULT_REJECTED: "bg-red-50 text-red-600",
  TASK_OVERRIDDEN: "bg-amber-50 text-amber-700",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: {
    userId?: string;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!canViewAuditLogs(user.role)) redirect("/dashboard/hrm");

  const fromDate = searchParams?.from ? new Date(`${searchParams.from}T00:00:00`) : null;
  const toDate = searchParams?.to ? new Date(`${searchParams.to}T23:59:59`) : null;

  const where = {
    actor: { organizationId: user.organizationId },
    ...(searchParams?.userId ? { actorId: searchParams.userId } : {}),
    ...(searchParams?.action ? { action: searchParams.action } : {}),
    ...(searchParams?.entityType ? { entityType: searchParams.entityType } : {}),
    ...(fromDate || toDate
      ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [logs, actors, actionOptions, entityOptions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { id: true, fullName: true, role: true } } },
    }),
    prisma.staff.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { actor: { organizationId: user.organizationId } },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { actor: { organizationId: user.organizationId } },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-slate-800">Audit Log</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {logs.length} records · Full action history for your organisation
        </p>
      </div>

      {/* Filter bar */}
      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <select
          name="userId"
          defaultValue={searchParams?.userId ?? ""}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="">All users</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </select>

        <select
          name="action"
          defaultValue={searchParams?.action ?? ""}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="">All actions</option>
          {actionOptions.map((r) => (
            <option key={r.action} value={r.action}>
              {r.action.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select
          name="entityType"
          defaultValue={searchParams?.entityType ?? ""}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="">All entities</option>
          {entityOptions.map((r) => (
            <option key={r.entityType} value={r.entityType}>
              {r.entityType}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">From</span>
          <input
            type="date"
            name="from"
            defaultValue={searchParams?.from ?? ""}
            className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">To</span>
          <input
            type="date"
            name="to"
            defaultValue={searchParams?.to ?? ""}
            className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Filter
        </button>
        <a
          href="/dashboard/hrm/audit"
          className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Reset
        </a>
      </form>

      {/* Log table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">No activity logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Actor</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Action</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Entity</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Changes</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const changes = pickDisplayChanges(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{log.actor.fullName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{ROLE_LABELS[log.actorRole]}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            actionStyle[log.action] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {log.action.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {log.entityType}
                        {log.entityId && (
                          <span className="ml-1 font-mono text-slate-300">
                            #{log.entityId.slice(-6)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[280px]">
                        {changes.length > 0 ? (
                          <div className="space-y-0.5">
                            {changes.map((c) => (
                              <div key={c.key} className="flex gap-1.5">
                                <span className="font-medium text-slate-600">{c.key}:</span>
                                <span className="break-all text-slate-400">{c.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}