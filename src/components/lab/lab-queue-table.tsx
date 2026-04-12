"use client";

import { formatDateTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QueueRow = {
  taskId: string;
  patientName: string;
  patientId: string;
  visitNumber: string;
  tests: string[];
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  taskStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  sampleStatus: "PENDING" | "COLLECTED" | "RECEIVED" | "PROCESSING" | "DONE";
  assignedAt: Date;
  updatedAt: Date;
};

const priorityStyle: Record<string, string> = {
  EMERGENCY: "bg-red-50 text-red-600",
  URGENT: "bg-amber-50 text-amber-700",
  ROUTINE: "bg-slate-100 text-slate-600",
};

const statusStyle: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
};

export function LabQueueTable({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function startTask(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/lab/tasks/${taskId}/start`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Unable to start task"); return; }
      router.push("/dashboard/lab-scientist");
      router.refresh();
    } finally {
      setBusyTaskId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
        No lab queue items yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Sample</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Assigned</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Updated</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.taskId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{row.patientName}</p>
                    <p className="font-mono text-slate-400">{row.patientId} · {row.visitNumber}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.tests.join(", ")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[row.priority]}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[row.taskStatus]}`}>
                      {row.taskStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.sampleStatus}</td>
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(row.assignedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(row.updatedAt)}</td>
                  <td className="px-4 py-2.5">
                    {row.taskStatus === "PENDING" ? (
                      <button
                        disabled={busyTaskId === row.taskId}
                        onClick={() => startTask(row.taskId)}
                        className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busyTaskId === row.taskId ? "Starting..." : "Start"}
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/dashboard/lab-scientist")}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}