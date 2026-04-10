import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/index";
import { formatDateTime, ROLE_LABELS } from "@/lib/utils";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard/hrm");

  const logs = await prisma.auditLog.findMany({
    where: { actor: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { fullName: true, role: true } },
    },
  });

  const actionColor: Record<string, "success" | "destructive" | "info" | "warning" | "secondary"> = {
    STAFF_CREATED: "success",
    STAFF_UPDATED: "info",
    STAFF_DEACTIVATED: "destructive",
    ORGANIZATION_CREATED: "success",
    ORGANIZATION_UPDATED: "info",
    AVAILABILITY_CHANGED: "warning",
    STAFF_LOGIN: "secondary",
    STAFF_LOGOUT: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full history of every key action in your organization
        </p>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No activity logged yet</p>
            <p className="text-sm text-muted-foreground mt-1">
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
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
                      {log.entityId && (
                        <span className="ml-1 text-xs opacity-60">
                          #{log.entityId.slice(-6)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {log.notes ?? "—"}
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
