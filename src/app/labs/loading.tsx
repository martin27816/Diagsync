export default function LabsIndexLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-72 rounded bg-slate-200" />
        <div className="h-4 w-[32rem] rounded bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-36 rounded-xl bg-slate-100" />
          <div className="h-36 rounded-xl bg-slate-100" />
          <div className="h-36 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
