import { auth } from "@/lib/auth";
import { canViewAuditLogs } from "@/lib/audit-core";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/index";
import { formatDateTime, ROLE_LABELS } from "@/lib/utils";

function shortValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 60)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  if (typeof value === "object") return "{...}";
  return String(value);
}

function pickDisplayChanges(log: {
  changes: unknown;
  newValue: unknown;
  oldValue: unknown;
}) {
  const payload =
    (log.changes && typeof log.changes === "object" ? log.changes : null) ??
    (log.newValue && typeof log.newValue === "object" ? log.newValue : null) ??
    (log.oldValue && typeof log.oldValue === "object" ? log.oldValue : null);

  if (!payload || typeof payload !== "object") return [];

  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 5)
    .map(([key, value]) => ({ key, value: shortValue(value) }));

  return entries;
}

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
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [logs, actors, actionOptions, entityOptions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: { select: { id: true, fullName: true, role: true } },
      },
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

  const actionColor: Record<string, "success" | "destructive" | "info" | "warning" | "secondary"> = {
    STAFF_CREATED: "success",
    STAFF_UPDATED: "info",
    STAFF_DEACTIVATED: "destructive",
    ORGANIZATION_CREATED: "success",
    ORGANIZATION_UPDATED: "info",
    AVAILABILITY_CHANGED: "warning",
    STAFF_LOGIN: "secondary",
    STAFF_LOGOUT: "secondary",
    TEST_ASSIGNED: "info",
    TEST_REASSIGNED: "warning",
    TEST_STARTED: "info",
    RESULT_SUBMITTED: "success",
    RESULT_APPROVED: "success",
    RESULT_REJECTED: "destructive",
    TASK_OVERRIDDEN: "warning",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6" />
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full history of every key action in your organization
        </p>
      </div>

      <form className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <select
            name="userId"
            defaultValue={searchParams?.userId ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All users</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.fullName}
              </option>
            ))}
          </select>
          <select
            name="action"
            defaultValue={searchParams?.action ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All actions</option>
            {actionOptions.map((row) => (
              <option key={row.action} value={row.action}>
                {row.action}
              </option>
            ))}
          </select>
          <select
            name="entityType"
            defaultValue={searchParams?.entityType ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All entities</option>
            {entityOptions.map((row) => (
              <option key={row.entityType} value={row.entityType}>
                {row.entityType}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="from"
            defaultValue={searchParams?.from ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="date"
            name="to"
            defaultValue={searchParams?.to ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-3">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Apply Filters
          </button>
          <a href="/dashboard/hrm/audit" className="rounded-md border px-4 py-2 text-sm">
            Reset
          </a>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No activity logged yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Actions taken in the system will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Changes</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.actor.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[log.actorRole]}</td>
                    <td className="px-4 py-3">
                      <Badge variant={actionColor[log.action] ?? "secondary"} className="text-xs">
                        {log.action.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.entityType}
                      {log.entityId && <span className="ml-1 text-xs opacity-60">#{log.entityId.slice(-6)}</span>}
                    </td>
                    <td className="max-w-[340px] px-4 py-3 text-xs text-muted-foreground align-top">
                      {pickDisplayChanges(log).length > 0 ? (
                        <div className="space-y-1">
                          {pickDisplayChanges(log).map((entry) => (
                            <div key={entry.key} className="flex gap-2">
                              <span className="font-medium text-foreground/80">{entry.key}:</span>
                              <span className="break-all">{entry.value}</span>
                            </div>
                          ))}
                          <details className="pt-1">
                            <summary className="cursor-pointer text-primary">View full JSON</summary>
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border bg-muted/40 p-2">
                              {JSON.stringify(log.changes ?? log.newValue ?? log.oldValue ?? {}, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {log.ipAddress ? <div>{log.ipAddress}</div> : <div>-</div>}
                      {log.userAgent ? <div className="max-w-[220px] truncate">{log.userAgent}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
