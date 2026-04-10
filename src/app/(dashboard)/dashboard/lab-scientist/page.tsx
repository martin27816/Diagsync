import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FlaskConical, Clock, CheckCircle, AlertCircle, Edit } from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";

export default async function LabScientistDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Scientist Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your assigned tests and enter results
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Assigned Tests"
          value={0}
          subtitle="Tests assigned to you"
          icon={FlaskConical}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="In Progress"
          value={0}
          subtitle="Tests currently running"
          icon={Clock}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Pending Submission"
          value={0}
          subtitle="Results drafted, not submitted"
          icon={Edit}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatsCard
          title="Completed Today"
          value={0}
          subtitle="Tests submitted today"
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Active Test Queue
          </h2>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <FlaskConical className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No tests assigned yet.</p>
            <p className="text-xs mt-1">Mark yourself as Available to receive assignments.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Edit Requests
          </h2>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No edit requests.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
