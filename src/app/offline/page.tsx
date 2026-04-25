export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are offline. Changes will sync when connection returns.
        </p>
      </div>
    </main>
  );
}
