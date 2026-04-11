"use client";

import { Badge } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
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

function priorityVariant(priority: QueueRow["priority"]) {
  if (priority === "EMERGENCY") return "destructive";
  if (priority === "URGENT") return "warning";
  return "secondary";
}

function statusVariant(status: QueueRow["taskStatus"]) {
  if (status === "CANCELLED") return "destructive";
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "info";
  return "secondary";
}

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
      if (!json.success) {
        setError(json.error ?? "Unable to start task");
        return;
      }
      router.push("/dashboard/lab-scientist");
      router.refresh();
    } finally {
      setBusyTaskId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        No lab queue items yet.
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
              <th className="px-4 py-3 text-left font-semibold">Patient Name</th>
              <th className="px-4 py-3 text-left font-semibold">Requested Tests</th>
              <th className="px-4 py-3 text-left font-semibold">Priority</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Sample</th>
              <th className="px-4 py-3 text-left font-semibold">Assigned At</th>
              <th className="px-4 py-3 text-left font-semibold">Last Updated</th>
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
                <td className="px-4 py-3">
                  <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(row.taskStatus)}>{row.taskStatus.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{row.sampleStatus}</Badge>
                </td>
                <td className="px-4 py-3">{formatDateTime(row.assignedAt)}</td>
                <td className="px-4 py-3">{formatDateTime(row.updatedAt)}</td>
                <td className="px-4 py-3">
                  {row.taskStatus === "PENDING" ? (
                    <Button
                      size="sm"
                      disabled={busyTaskId === row.taskId}
                      onClick={() => startTask(row.taskId)}
                    >
                      {busyTaskId === row.taskId ? "Starting..." : "Start Test"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/lab-scientist")}>
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
