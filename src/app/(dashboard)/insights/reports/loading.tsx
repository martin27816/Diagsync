export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
