"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/utils";

type ConsultationStatus = "WAITING" | "CALLED" | "CONSULTED" | "CANCELLED";

type QueueItem = {
  id: string;
  fullName: string;
  age: number;
  contact: string;
  vitalsNote?: string | null;
  status: ConsultationStatus;
  arrivalAt: string;
  calledAt?: string | null;
  consultedAt?: string | null;
  createdBy?: { fullName: string } | null;
  calledBy?: { fullName: string } | null;
  acknowledgedBy?: { fullName: string } | null;
};

type QueueResponse = {
  active: QueueItem[];
  consultedToday: QueueItem[];
};

const statusStyle: Record<ConsultationStatus, string> = {
  WAITING: "bg-slate-100 text-slate-700",
  CALLED: "bg-amber-50 text-amber-700",
  CONSULTED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function ConsultationBoard({ role }: { role: "RECEPTIONIST" | "MD" | "SUPER_ADMIN" }) {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [data, setData] = useState<QueueResponse>({ active: [], consultedToday: [] });
  const [form, setForm] = useState({ fullName: "", age: "", contact: "", vitalsNote: "" });

  const isReception = role === "RECEPTIONIST" || role === "SUPER_ADMIN";
  const isMd = role === "MD" || role === "SUPER_ADMIN";

  async function loadQueue() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/consultations", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load consultation queue");
        return;
      }
      setData(json.data);
    } catch {
      setError("Network error while loading consultation queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function addPatient() {
    setError("");
    setMessage("");
    if (!form.fullName.trim() || !form.age.trim() || !form.contact.trim()) {
      setError("Patient name, age, and contact are required.");
      return;
    }
    const age = Number(form.age);
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      setError("Enter a valid age.");
      return;
    }

    setBusyId("create");
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          age,
          contact: form.contact.trim(),
          vitalsNote: form.vitalsNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to add consultation patient");
        return;
      }
      setMessage("Patient added to consultation queue.");
      setForm({ fullName: "", age: "", contact: "", vitalsNote: "" });
      await loadQueue();
    } catch {
      setError("Network error while adding patient");
    } finally {
      setBusyId(null);
    }
  }

  async function callPatient(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/consultations/${id}/call`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to call patient");
        return;
      }
      setMessage("Reception has been notified to bring in the patient.");
      await loadQueue();
    } catch {
      setError("Network error while calling patient");
    } finally {
      setBusyId(null);
    }
  }

  async function markConsulted(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/consultations/${id}/consulted`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to mark consulted");
        return;
      }
      setMessage("Patient marked as consulted.");
      await loadQueue();
    } catch {
      setError("Network error while updating queue");
    } finally {
      setBusyId(null);
    }
  }

  const waitingCount = useMemo(() => data.active.filter((item) => item.status === "WAITING").length, [data.active]);
  const calledCount = useMemo(() => data.active.filter((item) => item.status === "CALLED").length, [data.active]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Waiting</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{waitingCount}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Called</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{calledCount}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Consulted Today</p>
          <p className="text-xl font-bold text-green-700 mt-0.5">{data.consultedToday.length}</p>
        </div>
      </div>

      {isReception ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Consultation Patient</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="Patient name"
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={form.age}
              onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
              placeholder="Age"
              type="number"
              min={0}
              max={130}
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={form.contact}
              onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
              placeholder="Contact"
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => void addPatient()}
              disabled={busyId === "create"}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {busyId === "create" ? "Adding..." : "Add To Queue"}
            </button>
          </div>
          <textarea
            value={form.vitalsNote}
            onChange={(e) => setForm((prev) => ({ ...prev, vitalsNote: e.target.value }))}
            placeholder="Vitals / note (optional)"
            rows={2}
            className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ) : null}

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{message}</div> : null}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultation Queue (Arrival Order)</span>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-xs text-slate-400">Loading queue...</p>
        ) : data.active.length === 0 ? (
          <p className="px-4 py-8 text-xs text-slate-400">No active consultation patients.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">#</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Age</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Vitals / Note</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Arrival Time</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.active.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-slate-400">{index + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{row.fullName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.age}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.contact}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.vitalsNote?.trim() ? row.vitalsNote : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[row.status]}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(row.arrivalAt)}</td>
                  <td className="px-4 py-2.5">
                    {isMd ? (
                      <button
                        disabled={busyId === row.id || row.status === "CONSULTED"}
                        onClick={() => void callPatient(row.id)}
                        className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busyId === row.id ? "Calling..." : "Call Patient"}
                      </button>
                    ) : null}
                    {isReception ? (
                      <button
                        disabled={busyId === row.id || row.status === "CONSULTED"}
                        onClick={() => void markConsulted(row.id)}
                        className="rounded bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {busyId === row.id ? "Updating..." : "Mark Consulted"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

