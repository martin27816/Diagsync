import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  Activity,
  Clock3,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { formatDateTime, formatMinutes, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/index";

export default async function HRMDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard");

  const [totalStaff, activeStaff, unavailableStaff, recentAuditLogs, overview] =
    await Promise.all([
      prisma.staff.count({ where: { organizationId: user.organizationId } }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "AVAILABLE" },
      }),
      prisma.staff.count({
        where: { organizationId: user.organizationId, availabilityStatus: "UNAVAILABLE" },
      }),
      prisma.auditLog.findMany({
        where: { actor: { organizationId: user.organizationId } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { fullName: true, role: true } } },
      }),
      getHrmOverview({
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Operations Overview</h1>
          {user.role === "SUPER_ADMIN" ? (
            <Link href="/dashboard/hrm/settings" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Settings2 className="h-4 w-4" />
              Settings
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor workflow movement, staff load, and release readiness across your lab
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Patients Today"
          value={overview.metrics.todayPatients}
          subtitle="Registered today"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Active Visits"
          value={overview.metrics.activeVisits}
          subtitle="Still in workflow"
          icon={Activity}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatsCard
          title="Pending Tasks"
          value={overview.metrics.pendingTasks}
          subtitle="Awaiting completion"
          icon={Clock3}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Completed Tasks"
          value={overview.metrics.completedTasks}
          subtitle="Done so far"
          icon={CheckCircle2}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatsCard
          title="Delayed Tasks"
          value={overview.metrics.delayedTasks}
          subtitle="Exceeded target time"
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Timer className="h-4 w-4 text-muted-foreground" />
              Basic Analytics
            </h2>
            <Link href="/dashboard/hrm/operations" className="text-xs text-primary hover:underline">
              Open operations -&gt;
            </Link>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-muted-foreground">Average completion time</span>
              <span className="font-semibold">{formatMinutes(overview.analytics.averageCompletionMinutes)}</span>
            </div>
            <div>
              <p className="mb-2 text-muted-foreground">Tasks per department</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(overview.analytics.tasksPerDepartment).map(([department, count]) => (
                  <Badge key={department} variant="secondary">
                    {department}: {count}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-muted-foreground">Busiest staff right now</p>
              <div className="space-y-2">
                {overview.analytics.busiestStaff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active workload yet.</p>
                ) : (
                  overview.analytics.busiestStaff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="font-medium">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[s.role]}</p>
                      </div>
                      <Badge variant={s.overloaded ? "warning" : "info"}>{s.active} active</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <Link href="/dashboard/hrm/audit" className="text-xs text-primary hover:underline">
              View all -&gt;
            </Link>
          </div>
          <div className="space-y-3">
            {recentAuditLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-b py-2 last:border-0">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Staff"
          value={totalStaff}
          subtitle="All staff accounts"
          icon={ClipboardList}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
        />
        <StatsCard
          title="Available Staff"
          value={activeStaff}
          subtitle="Ready to receive tasks"
          icon={UserCheck}
          iconBg="bg-green-50"
          iconColor="text-green-700"
        />
        <StatsCard
          title="Unavailable Staff"
          value={unavailableStaff}
          subtitle="Not receiving new tasks"
          icon={UserX}
          iconBg="bg-amber-50"
          iconColor="text-amber-700"
        />
      </div>
    </div>
  );
}
