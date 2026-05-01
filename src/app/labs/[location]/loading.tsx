export default function LabsByLocationLoading() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-72 rounded bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-36 rounded bg-slate-100" />
          <div className="h-36 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
