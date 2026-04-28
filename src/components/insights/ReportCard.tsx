import { formatCurrency, formatDate } from "@/lib/utils";

type ReportCardProps = {
  id: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  revenue: number;
  growth: number;
  onClick?: (id: string) => void;
};

export function ReportCard({ id, type, periodStart, periodEnd, revenue, growth, onClick }: ReportCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {type}
        </span>
        <span className={`text-xs font-semibold ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {growth >= 0 ? "+" : ""}
          {growth}%
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {formatDate(periodStart)} - {formatDate(periodEnd)}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(revenue)}</p>
      <button
        type="button"
        onClick={() => onClick?.(id)}
        className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        View Details
      </button>
    </div>
  );
}
