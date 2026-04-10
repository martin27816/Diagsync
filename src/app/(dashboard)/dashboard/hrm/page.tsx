import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Users, UserCheck, UserX, ClipboardList, Activity, Building2 } from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { formatDateTime, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/index";

export default async function HRMDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  const [totalStaff, activeStaff, unavailableStaff, recentStaff, recentAuditLogs] =
    await prisma.$transaction([
      prisma.staff.count({ where: { organizationId: user.organizationId } }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "AVAILABLE" },
      }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "UNAVAILABLE" },
      }),
      prisma.staff.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          fullName: true,
          role: true,
          department: true,
          status: true,
          availabilityStatus: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { actor: { organizationId: user.organizationId } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { fullName: true, role: true } } },
      }),
    ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Operations Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor staff, workflow, and activity across your lab
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Staff"
          value={totalStaff}
          subtitle="All registered staff members"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Currently Available"
          value={activeStaff}
          subtitle="Marked as available now"
          icon={UserCheck}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatsCard
          title="Unavailable"
          value={unavailableStaff}
          subtitle="Off duty or unavailable"
          icon={UserX}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Audit Events Today"
          value={recentAuditLogs.length}
          subtitle="Actions logged today"
          icon={ClipboardList}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent staff */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Recent Staff
            </h2>
            <a href="/dashboard/hrm/staff" className="text-xs text-primary hover:underline">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {recentStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No staff added yet. Add your first staff member.
              </p>
            ) : (
              recentStaff.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {s.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[s.role]}</p>
                    </div>
                  </div>
                  <Badge variant={s.availabilityStatus === "AVAILABLE" ? "success" : "secondary"}>
                    {s.availabilityStatus === "AVAILABLE" ? "Available" : "Away"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent audit activity */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <a href="/dashboard/hrm/audit" className="text-xs text-primary hover:underline">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {recentAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity logged yet.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {log.actor.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{log.actor.fullName}</span>{" "}
                      <span className="text-muted-foreground">
                        {log.action.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
