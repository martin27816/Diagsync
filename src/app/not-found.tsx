import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Page not found</h2>
        <p className="mt-1 text-xs text-slate-500">
          The route may have moved or the link is no longer valid.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

