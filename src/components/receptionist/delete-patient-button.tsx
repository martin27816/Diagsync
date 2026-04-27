"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePatientButton({
  visitId,
  patientId,
  patientName,
  visitNumber,
}: {
  visitId: string;
  patientId: string;
  patientName: string;
  visitNumber?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteEntirePatient, setDeleteEntirePatient] = useState(false);

  async function onDeleteConfirmed() {
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        deleteEntirePatient ? `/api/patients/${patientId}` : `/api/visits/${visitId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Unable to delete visit");
        return;
      }
      setOpen(false);
      setDeleteEntirePatient(false);
      router.refresh();
    } catch {
      setError("Network error while deleting patient");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          setDeleteEntirePatient(false);
          setOpen(true);
        }}
        disabled={busy}
        className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete Visit"}
      </button>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Delete Patient Data</h3>
              <p className="mt-1 text-xs text-slate-500">
                {patientName}
                {visitNumber ? ` (${visitNumber})` : ""}
              </p>
            </div>

            <p className="mb-3 text-xs text-slate-600">
              Unchecked: delete only this visit. Checked: delete everything about this patient (all visits and records).
            </p>

            <label className="mb-4 flex items-start gap-2 rounded border border-red-100 bg-red-50 px-2.5 py-2">
              <input
                type="checkbox"
                checked={deleteEntirePatient}
                onChange={(e) => setDeleteEntirePatient(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs text-red-700">Delete everything about this patient</span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setOpen(false);
                }}
                disabled={busy}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onDeleteConfirmed()}
                disabled={busy}
                className="rounded border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy
                  ? "Deleting..."
                  : deleteEntirePatient
                    ? "Delete Patient + All Visits"
                    : "Delete This Visit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
