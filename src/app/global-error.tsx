"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GLOBAL_ERROR_BOUNDARY]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto mt-20 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Unexpected app error</h2>
          <p className="mt-1 text-xs text-slate-500">
            We hit an unexpected error while rendering this route.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}

