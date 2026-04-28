import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReportsBoard } from "@/components/insights/reports-board";

export const dynamic = "force-dynamic";

export default async function InsightsReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  const reports = await prisma.labInsightReport.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const normalized = reports.map((report) => {
    const data = (report.data as Record<string, unknown>) ?? {};
    return {
      id: report.id,
      reportType: report.reportType,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      summary: {
        revenue: Number(data.revenue ?? 0),
        growth: Number(data.growth ?? 0),
        totalPatients: Number(data.totalPatients ?? 0),
        delays: Number(data.delays ?? 0),
      },
      data,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Lab Performance Reports</h1>
        <p className="text-xs text-slate-500">Weekly and monthly generated reports.</p>
      </div>
      {normalized.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No data yet
        </div>
      ) : (
        <ReportsBoard reports={normalized} />
      )}
    </div>
  );
}
