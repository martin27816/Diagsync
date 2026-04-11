"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type TaskDepartment = "LABORATORY" | "RADIOLOGY";

type Item = {
  id: string;
  department: TaskDepartment;
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  updatedAt: string;
  visit: {
    visitNumber: string;
    patient: {
      fullName: string;
      patientId: string;
      age: number;
      sex: string;
    };
  };
  staff: { fullName: string } | null;
  review: { status: ReviewStatus; comments?: string | null; rejectionReason?: string | null } | null;
  results: Array<{
    testOrder: { test: { name: string } };
    resultData: Record<string, any>;
    notes?: string | null;
  }>;
  radiologyReport: {
    findings: string;
    impression: string;
    notes?: string | null;
  } | null;
  imagingFiles: Array<{ id: string; fileName: string; fileUrl: string }>;
};

function formatResultData(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && `${v}`.trim() !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return entries.length ? entries.join(", ") : "-";
}

export function MdReviewBoard({
  initialStatus = "pending",
}: {
  initialStatus?: "pending" | "approved" | "rejected" | "all";
}) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [editPayloads, setEditPayloads] = useState<Record<string, string>>({});
  const [approveComments, setApproveComments] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/md/reviews?status=${status}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load review queue");
        return;
      }
      setItems(json.data.items);
      setCounts(json.data.counts);
    } catch {
      setError("Network error while loading reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [status]);

  const totalPending = useMemo(() => counts.pending, [counts.pending]);
  const totalApproved = useMemo(() => counts.approved, [counts.approved]);
  const totalRejected = useMemo(() => counts.rejected, [counts.rejected]);

  async function approve(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: approveComments[taskId] ?? "" }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Approval failed");
        return;
      }
      await loadData();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function reject(taskId: string) {
    const reason = rejectReasons[taskId]?.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Rejection failed");
        return;
      }
      await loadData();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function edit(taskId: string) {
    const raw = editPayloads[taskId]?.trim();
    if (!raw) {
      setError("Edit payload JSON is required.");
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("Edit payload must be valid JSON.");
      return;
    }

    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: "MD edited values before final decision",
          editedData: parsed,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Edit failed");
        return;
      }
      await loadData();
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading MD review queue...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Pending Reviews</p>
          <p className="mt-1 text-2xl font-bold">{totalPending}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Approved</p>
          <p className="mt-1 text-2xl font-bold">{totalApproved}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Rejected / Edit Requested</p>
          <p className="mt-1 text-2xl font-bold">{totalRejected}</p>
        </div>
      </div>

      <Select value={status} onValueChange={(v) => setStatus(v as any)}>
        <SelectTrigger className="max-w-xs">
          <SelectValue placeholder="Filter status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No cases found for selected review status.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const reviewStatus = item.review?.status ?? "PENDING";
            return (
              <div key={item.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Visit {item.visit.visitNumber}</p>
                    <h3 className="text-lg font-semibold">{item.visit.patient.fullName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.visit.patient.patientId} · {item.visit.patient.age}y · {item.visit.patient.sex}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last update: {formatDateTime(item.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.priority === "EMERGENCY" ? "destructive" : item.priority === "URGENT" ? "warning" : "secondary"}>
                      {item.priority}
                    </Badge>
                    <Badge variant={reviewStatus === "APPROVED" ? "success" : reviewStatus === "REJECTED" ? "destructive" : "info"}>
                      {reviewStatus}
                    </Badge>
                    <Badge variant="outline">{item.department}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="font-medium mb-2">Submitted Output</p>
                    {item.department === "LABORATORY" ? (
                      <div className="space-y-2">
                        {item.results.map((r, idx) => (
                          <div key={idx}>
                            <p className="font-medium text-sm">{r.testOrder.test.name}</p>
                            <p className="text-sm text-muted-foreground">{formatResultData(r.resultData)}</p>
                            {r.notes && <p className="text-xs text-muted-foreground">Note: {r.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Findings:</span> {item.radiologyReport?.findings ?? "-"}</p>
                        <p className="text-sm"><span className="font-medium">Impression:</span> {item.radiologyReport?.impression ?? "-"}</p>
                        {item.radiologyReport?.notes && (
                          <p className="text-sm"><span className="font-medium">Notes:</span> {item.radiologyReport.notes}</p>
                        )}
                        <div className="space-y-1">
                          {item.imagingFiles.map((img) => (
                            <a key={img.id} href={img.fileUrl} target="_blank" rel="noreferrer" className="block text-primary text-sm hover:underline">
                              {img.fileName}
                            </a>
                          ))}
                          {item.imagingFiles.length === 0 && (
                            <p className="text-sm text-muted-foreground">No imaging files attached.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <Label>Approval Comment (optional)</Label>
                    <textarea
                      rows={2}
                      value={approveComments[item.id] ?? ""}
                      onChange={(e) => setApproveComments((p) => ({ ...p, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />

                    <Label>Rejection Reason (required if rejecting)</Label>
                    <textarea
                      rows={2}
                      value={rejectReasons[item.id] ?? ""}
                      onChange={(e) => setRejectReasons((p) => ({ ...p, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />

                    <Label>Edit Payload JSON (optional)</Label>
                    <textarea
                      rows={3}
                      placeholder={item.department === "LABORATORY" ? '{"testResults":[{"testOrderId":"...","resultData":{"key":"value"}}]}' : '{"report":{"findings":"...","impression":"...","notes":"..."}}'}
                      value={editPayloads[item.id] ?? ""}
                      onChange={(e) => setEditPayloads((p) => ({ ...p, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button
                        disabled={busyTaskId === item.id || reviewStatus === "APPROVED"}
                        onClick={() => approve(item.id)}
                      >
                        {busyTaskId === item.id ? "Working..." : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyTaskId === item.id || reviewStatus === "APPROVED"}
                        onClick={() => reject(item.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyTaskId === item.id || reviewStatus === "APPROVED"}
                        onClick={() => edit(item.id)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
