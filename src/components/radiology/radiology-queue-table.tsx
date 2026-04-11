"use client";

import { Badge } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  taskId: string;
  patientName: string;
  patientId: string;
  visitNumber: string;
  tests: string[];
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  taskStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedAt: Date;
  updatedAt: Date;
};

function priorityVariant(priority: Row["priority"]) {
  if (priority === "EMERGENCY") return "destructive";
  if (priority === "URGENT") return "warning";
  return "secondary";
}

export function RadiologyQueueTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function startTask(taskId: string) {
    setBusy(taskId);
    setError("");
    try {
      const res = await fetch(`/api/radiology/tasks/${taskId}/start`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to start task");
        return;
      }
      router.push("/dashboard/radiographer");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        No radiology queue items yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Patient</th>
              <th className="px-4 py-3 text-left font-semibold">Requested Tests</th>
              <th className="px-4 py-3 text-left font-semibold">Priority</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Assigned At</th>
              <th className="px-4 py-3 text-left font-semibold">Updated At</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.taskId} className="border-t align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.patientName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.patientId}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.visitNumber}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {row.tests.map((t, idx) => (
                      <p key={`${row.taskId}-${idx}`}>{t}</p>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge></td>
                <td className="px-4 py-3"><Badge variant={row.taskStatus === "COMPLETED" ? "success" : row.taskStatus === "IN_PROGRESS" ? "info" : row.taskStatus === "CANCELLED" ? "destructive" : "secondary"}>{row.taskStatus}</Badge></td>
                <td className="px-4 py-3">{formatDateTime(row.assignedAt)}</td>
                <td className="px-4 py-3">{formatDateTime(row.updatedAt)}</td>
                <td className="px-4 py-3">
                  {row.taskStatus === "PENDING" ? (
                    <Button size="sm" disabled={busy === row.taskId} onClick={() => startTask(row.taskId)}>
                      {busy === row.taskId ? "Starting..." : "Start Task"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/radiographer")}>
                      Open Dashboard
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

