import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Stethoscope, Clock, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";

export default async function MDDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medical Review Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review submitted results, approve or request corrections
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Awaiting Review"
          value={0}
          subtitle="Results submitted for review"
          icon={Clock}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Critical / Urgent"
          value={0}
          subtitle="Flagged critical results"
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatsCard
          title="Approved Today"
          value={0}
          subtitle="Results approved today"
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatsCard
          title="Edit Requests Sent"
          value={0}
          subtitle="Corrections requested today"
          icon={RotateCcw}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            Review Queue
          </h2>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No results awaiting review.</p>
            <p className="text-xs mt-1">Submitted lab and radiology results will appear here.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Critical Results
          </h2>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No critical results flagged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
