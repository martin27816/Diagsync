type StatCardProps = {
  title: string;
  value: string;
  sub?: string;
  color?: "default" | "green" | "red";
};

export function StatCard({ title, value, sub, color = "default" }: StatCardProps) {
  const valueClass =
    color === "green" ? "text-emerald-600" : color === "red" ? "text-red-600" : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
