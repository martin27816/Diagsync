"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePatientButton({
  visitId,
  patientName,
  visitNumber,
}: {
  visitId: string;
  patientName: string;
  visitNumber?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (busy) return;
    const approved = window.confirm(
      `Delete this visit for ${patientName}${visitNumber ? ` (${visitNumber})` : ""}? This removes only this visit's tests/results/reports/tasks and keeps previous visits.`
    );
    if (!approved) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Unable to delete visit");
        return;
      }
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
        onClick={onDelete}
        disabled={busy}
        className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete Visit"}
      </button>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
