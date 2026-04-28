export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-52 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-52 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}
