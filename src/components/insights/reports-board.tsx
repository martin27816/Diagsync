"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ReportCard } from "@/components/insights/ReportCard";
import { SectionCard } from "@/components/insights/SectionCard";

type ReportItem = {
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    revenue: number;
    growth: number;
    totalPatients: number;
    delays: number;
  };
  data: Record<string, unknown>;
};

export function ReportsBoard({ reports }: { reports: ReportItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeReport = useMemo(() => reports.find((r) => r.id === activeId) ?? null, [activeId, reports]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            id={report.id}
            type={report.reportType}
            periodStart={new Date(report.periodStart)}
            periodEnd={new Date(report.periodEnd)}
            revenue={report.summary.revenue}
            growth={report.summary.growth}
            onClick={setActiveId}
          />
        ))}
      </div>

      {activeReport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{activeReport.reportType} Report</p>
                <p className="text-xs text-slate-500">
                  {formatDate(activeReport.periodStart)} - {formatDate(activeReport.periodEnd)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <SectionCard title="Revenue">
                <p className="text-sm text-slate-700">Revenue: {formatCurrency(Number(activeReport.data.revenue ?? 0))}</p>
                <p className="text-sm text-slate-700">Previous: {formatCurrency(Number(activeReport.data.previousRevenue ?? 0))}</p>
                <p className="text-sm text-slate-700">
                  Growth: {Number(activeReport.data.growth ?? 0) >= 0 ? "+" : ""}
                  {Number(activeReport.data.growth ?? 0)}%
                </p>
              </SectionCard>
              <SectionCard title="Patients">
                <p className="text-sm text-slate-700">Total Patients: {Number(activeReport.data.totalPatients ?? 0)}</p>
                <p className="text-sm text-slate-700">New Patients: {Number(activeReport.data.newPatients ?? 0)}</p>
              </SectionCard>
              <SectionCard title="Top Tests">
                <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(activeReport.data.topTests ?? [], null, 2)}
                </pre>
              </SectionCard>
              <SectionCard title="Delays">
                <p className="text-sm text-slate-700">Delayed Tests: {Number(activeReport.data.delays ?? 0)}</p>
              </SectionCard>
              <SectionCard title="Staff Performance">
                <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(activeReport.data.staffPerformance ?? [], null, 2)}
                </pre>
              </SectionCard>
              <SectionCard title="Missed Opportunities">
                <p className="text-sm text-slate-700">{Number(activeReport.data.missedOpportunities ?? 0)}</p>
              </SectionCard>
              <SectionCard title="Activity Insight">
                <p className="text-sm text-slate-700">Busiest Day: {String(activeReport.data.busiestDay ?? "-")}</p>
                <p className="text-sm text-slate-700">Quietest Day: {String(activeReport.data.quietestDay ?? "-")}</p>
              </SectionCard>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
