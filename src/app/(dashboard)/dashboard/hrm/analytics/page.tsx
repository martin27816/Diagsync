import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/index";
import { formatMinutes, ROLE_LABELS } from "@/lib/utils";

export default async function HrmAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["HRM", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  const overview = await getHrmOverview({
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick view of throughput, delays, and workload concentration across the lab.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Average Completion Time</p>
          <p className="mt-1 text-2xl font-bold">{formatMinutes(overview.analytics.averageCompletionMinutes)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Delayed Tasks</p>
          <p className="mt-1 text-2xl font-bold">{overview.metrics.delayedTasks}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Most Active Staff Load</p>
          <p className="mt-1 text-2xl font-bold">{overview.analytics.busiestStaff[0]?.active ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold">Tasks Per Department</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(overview.analytics.tasksPerDepartment).map(([dept, count]) => (
            <Badge key={dept} variant="secondary">
              {dept}: {count}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold">Busiest Staff</h2>
        {overview.analytics.busiestStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active workload yet.</p>
        ) : (
          <div className="space-y-2">
            {overview.analytics.busiestStaff.map((staff) => (
              <div key={staff.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="font-medium">{staff.fullName}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[staff.role]}</p>
                </div>
                <Badge variant={staff.overloaded ? "warning" : "info"}>{staff.active} active</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
