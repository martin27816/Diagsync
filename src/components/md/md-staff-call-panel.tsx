"use client";

import { useState } from "react";

type TargetRole = "RECEPTIONIST" | "LAB_SCIENTIST" | "HRM" | "RADIOGRAPHER";

const CALL_TARGETS: Array<{ role: TargetRole; label: string }> = [
  { role: "RECEPTIONIST", label: "Call Receptionist" },
  { role: "LAB_SCIENTIST", label: "Call Lab Scientist" },
  { role: "HRM", label: "Call HRM" },
  { role: "RADIOGRAPHER", label: "Call Radiographer" },
];

export function MdStaffCallPanel() {
  const [busyRole, setBusyRole] = useState<TargetRole | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function callRole(targetRole: TargetRole) {
    setBusyRole(targetRole);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/md/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Could not notify staff right now.");
        return;
      }
      setMessage(json?.message ?? "Staff has been notified.");
    } catch {
      setError("Network error while sending MD call notification.");
    } finally {
      setBusyRole(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Staff Quick Call
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Send urgent “MD wants to see you” notification to staff.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CALL_TARGETS.map((target) => (
          <button
            key={target.role}
            onClick={() => void callRole(target.role)}
            disabled={busyRole !== null}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {busyRole === target.role ? "Calling..." : target.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 rounded border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}

