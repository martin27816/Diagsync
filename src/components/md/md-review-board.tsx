"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { ResultInsightBox } from "@/components/results/result-insight-box";
import { buildResultInsights } from "@/lib/result-insights";
import { PatientInsights } from "@/components/patients/patient-insights";
import { analyzePatientInsights, type PatientHistoryRow } from "@/lib/patient-insights";
import { Skeleton } from "@/components/ui/skeleton";

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
  review: {
    status: ReviewStatus;
    comments?: string | null;
    rejectionReason?: string | null;
    editedData?: unknown;
  } | null;
  results: Array<{
    testOrderId: string;
    testOrder: { test: { name: string } };
    currentVersion: number;
    resultData: Record<string, unknown>;
    notes?: string | null;
    versionHistory: Array<{
      id: string;
      version: number;
      isActive: boolean;
      parentId?: string | null;
      resultData: Record<string, unknown>;
      notes?: string | null;
      editReason: string;
      editedBy: { id: string; fullName: string };
      createdAt: string;
    }>;
  }>;
  radiologyReport: {
    currentVersion: number;
    findings: string;
    impression: string;
    notes?: string | null;
    versionHistory: Array<{
      id: string;
      version: number;
      isActive: boolean;
      parentId?: string | null;
      findings: string;
      impression: string;
      notes?: string | null;
      editReason: string;
      editedBy: { id: string; fullName: string };
      createdAt: string;
    }>;
  } | null;
  imagingFiles: Array<{ id: string; fileName: string; fileUrl: string }>;
  patientHistory: PatientHistoryRow[];
  patientVisitCount: number;
};

function formatResultData(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && `${v}`.trim() !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return entries.length ? entries.join(", ") : "-";
}

function minutesAgoLabel(dateText: string) {
  const deltaMs = Date.now() - new Date(dateText).getTime();
  const mins = Math.max(1, Math.floor(deltaMs / 60000));
  return `${mins} min${mins > 1 ? "s" : ""} ago`;
}

function getHighlightFields(review: Item["review"]) {
  if (!review?.editedData || typeof review.editedData !== "object") return [];
  const data = review.editedData as { highlightFields?: unknown };
  if (!Array.isArray(data.highlightFields)) return [];
  return data.highlightFields.filter((row): row is string => typeof row === "string");
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
  const [rejectFieldHints, setRejectFieldHints] = useState<Record<string, string>>({});
  const [editReasons, setEditReasons] = useState<Record<string, string>>({});
  const [approveComments, setApproveComments] = useState<Record<string, string>>({});
  const [labEdits, setLabEdits] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [labEditNotes, setLabEditNotes] = useState<Record<string, Record<string, string>>>({});
  const [radiologyEdits, setRadiologyEdits] = useState<Record<string, { findings: string; impression: string; notes: string }>>({});

  function normalizeResultData(value: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(value ?? {}).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])
    );
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/md/reviews?status=${status}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data: { items: Item[]; counts: { pending: number; approved: number; rejected: number } };
      };
      if (!json.success) {
        setError(json.error ?? "Failed to load review queue");
        return;
      }
      setItems(json.data.items);
      setCounts(json.data.counts);

      const nextLabEdits: Record<string, Record<string, Record<string, string>>> = {};
      const nextLabNotes: Record<string, Record<string, string>> = {};
      const nextRadEdits: Record<string, { findings: string; impression: string; notes: string }> = {};
      for (const item of json.data.items) {
        if (item.department === "LABORATORY") {
          nextLabEdits[item.id] = {};
          nextLabNotes[item.id] = {};
          for (const result of item.results) {
            nextLabEdits[item.id][result.testOrderId] = normalizeResultData(result.resultData);
            nextLabNotes[item.id][result.testOrderId] = result.notes ?? "";
          }
        } else {
          nextRadEdits[item.id] = {
            findings: item.radiologyReport?.findings ?? "",
            impression: item.radiologyReport?.impression ?? "",
            notes: item.radiologyReport?.notes ?? "",
          };
        }
      }
      setLabEdits(nextLabEdits);
      setLabEditNotes(nextLabNotes);
      setRadiologyEdits(nextRadEdits);
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

  function applyOptimisticReview(taskId: string, nextStatus: ReviewStatus, reason?: string) {
    const current = items.find((item) => item.id === taskId)?.review?.status ?? "PENDING";

    setItems((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              review: {
                status: nextStatus,
                comments: item.review?.comments ?? null,
                rejectionReason: reason ?? item.review?.rejectionReason ?? null,
                editedData: item.review?.editedData,
              },
            }
          : item
      )
    );

    if (current !== nextStatus) {
      setCounts((prev) => ({
        pending: prev.pending + (current === "PENDING" ? -1 : 0) + (nextStatus === "PENDING" ? 1 : 0),
        approved: prev.approved + (current === "APPROVED" ? -1 : 0) + (nextStatus === "APPROVED" ? 1 : 0),
        rejected: prev.rejected + (current === "REJECTED" ? -1 : 0) + (nextStatus === "REJECTED" ? 1 : 0),
      }));
    }
  }

  async function approve(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    applyOptimisticReview(taskId, "APPROVED");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: approveComments[taskId] ?? "" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Approval failed");
        await loadData();
      }
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
    applyOptimisticReview(taskId, "REJECTED", reason);
    try {
      const highlightFields = (rejectFieldHints[taskId] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const res = await fetch(`/api/md/reviews/${taskId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, highlightFields }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Rejection failed");
        await loadData();
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function edit(taskId: string) {
    const reason = editReasons[taskId]?.trim();
    if (!reason) {
      setError("Edit reason is required.");
      return;
    }

    const item = items.find((row) => row.id === taskId);
    if (!item) {
      setError("Task not found for edit.");
      return;
    }

    let payload:
      | { testResults: Array<{ testOrderId: string; resultData: Record<string, string>; notes: string }> }
      | { report: { findings: string; impression: string; notes: string } };

    if (item.department === "LABORATORY") {
      payload = {
        testResults: item.results.map((result) => ({
          testOrderId: result.testOrderId,
          resultData: labEdits[taskId]?.[result.testOrderId] ?? normalizeResultData(result.resultData),
          notes: labEditNotes[taskId]?.[result.testOrderId] ?? result.notes ?? "",
        })),
      };
    } else {
      const current = radiologyEdits[taskId] ?? {
        findings: item.radiologyReport?.findings ?? "",
        impression: item.radiologyReport?.impression ?? "",
        notes: item.radiologyReport?.notes ?? "",
      };
      if (!current.findings.trim() || !current.impression.trim()) {
        setError("Findings and impression are required for radiology edit.");
        return;
      }
      payload = { report: current };
    }

    setBusyTaskId(taskId);
    setError("");
    applyOptimisticReview(taskId, "PENDING");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          comments: "Controlled edit created and sent for re-approval",
          editedData: payload,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Edit failed");
        await loadData();
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
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

      <Select value={status} onValueChange={(v) => setStatus(v as "pending" | "approved" | "rejected" | "all")}>
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
            const highlightFields = getHighlightFields(item.review);
            const insights = analyzePatientInsights({
              visitCount: item.patientVisitCount,
              currentTestNames:
                item.department === "LABORATORY"
                  ? item.results.map((result) => result.testOrder.test.name)
                  : ["Radiology follow-up"],
              history: item.patientHistory,
            });
            return (
              <div key={item.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Visit {item.visit.visitNumber}</p>
                    <h3 className="text-lg font-semibold">{item.visit.patient.fullName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.visit.patient.patientId} - {item.visit.patient.age}y - {item.visit.patient.sex}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Last update: {minutesAgoLabel(item.updatedAt)}</p>
                    <p className="text-xs text-muted-foreground">Last updated by {item.staff?.fullName ?? "Unassigned"}</p>
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
                  <div className="rounded-md border p-3 space-y-3">
                    <p className="font-medium">Submitted Output</p>
                    <PatientInsights insights={insights} />
                    {item.department === "LABORATORY" ? (
                      <div className="space-y-2">
                        {item.results.map((result) => (
                          <div key={result.testOrderId} className="space-y-1 rounded-md border p-2">
                            <p className="font-medium text-sm">{result.testOrder.test.name}</p>
                            <p className="text-xs text-muted-foreground">Version {result.currentVersion}</p>
                            <p className="text-sm text-muted-foreground">{formatResultData(result.resultData)}</p>
                            {result.notes ? <p className="text-xs text-muted-foreground">Note: {result.notes}</p> : null}
                            <ResultInsightBox messages={buildResultInsights(result.resultData)} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Findings:</span> {item.radiologyReport?.findings ?? "-"}</p>
                        <p className="text-sm"><span className="font-medium">Impression:</span> {item.radiologyReport?.impression ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">Version {item.radiologyReport?.currentVersion ?? 1}</p>
                        <div className="space-y-1">
                          {item.imagingFiles.map((img) => (
                            <a key={img.id} href={img.fileUrl} target="_blank" rel="noreferrer" className="block text-primary text-sm hover:underline">
                              {img.fileName}
                            </a>
                          ))}
                          {item.imagingFiles.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No imaging files attached.</p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <Label>Approval Comment (optional)</Label>
                    <textarea
                      rows={2}
                      value={approveComments[item.id] ?? ""}
                      onChange={(e) => setApproveComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />

                    <Label>Rejection Reason (required if rejecting)</Label>
                    <textarea
                      rows={2}
                      value={rejectReasons[item.id] ?? ""}
                      onChange={(e) => setRejectReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />

                    <Label>Fields Needing Change (optional, comma-separated)</Label>
                    <input
                      value={rejectFieldHints[item.id] ?? ""}
                      onChange={(e) => setRejectFieldHints((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="e.g. hemoglobin, wbc"
                    />

                    <Label>Edit Data</Label>
                    {item.department === "LABORATORY" ? (
                      <div className="space-y-2 rounded-md border p-2">
                        {item.review?.rejectionReason ? (
                          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                            Edit requested: {item.review.rejectionReason}
                          </div>
                        ) : null}
                        {item.results.map((result) => (
                          <div key={result.testOrderId} className="space-y-2 rounded-md border p-2">
                            <p className="text-sm font-medium">{result.testOrder.test.name}</p>
                            <div className="grid gap-2 md:grid-cols-2">
                              {Object.keys(normalizeResultData(result.resultData)).map((fieldKey) => (
                                <label key={fieldKey} className="space-y-1 text-xs">
                                  <span className="text-muted-foreground">{fieldKey}</span>
                                  <input
                                    value={labEdits[item.id]?.[result.testOrderId]?.[fieldKey] ?? ""}
                                    onChange={(e) =>
                                      setLabEdits((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...(prev[item.id] ?? {}),
                                          [result.testOrderId]: {
                                            ...((prev[item.id] ?? {})[result.testOrderId] ?? {}),
                                            [fieldKey]: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    className={`h-9 w-full rounded-md border bg-background px-2 text-sm ${
                                      highlightFields.includes(fieldKey) ? "border-amber-300 bg-amber-50" : "border-input"
                                    }`}
                                  />
                                </label>
                              ))}
                            </div>
                            <label className="space-y-1 text-xs block">
                              <span className="text-muted-foreground">Result note</span>
                              <input
                                value={labEditNotes[item.id]?.[result.testOrderId] ?? ""}
                                onChange={(e) =>
                                  setLabEditNotes((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...(prev[item.id] ?? {}),
                                      [result.testOrderId]: e.target.value,
                                    },
                                  }))
                                }
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-md border p-2">
                        <label className="space-y-1 text-xs block">
                          <span className="text-muted-foreground">Findings</span>
                          <textarea
                            rows={2}
                            value={radiologyEdits[item.id]?.findings ?? ""}
                            onChange={(e) =>
                              setRadiologyEdits((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] ?? { findings: "", impression: "", notes: "" }), findings: e.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-1 text-xs block">
                          <span className="text-muted-foreground">Impression</span>
                          <textarea
                            rows={2}
                            value={radiologyEdits[item.id]?.impression ?? ""}
                            onChange={(e) =>
                              setRadiologyEdits((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] ?? { findings: "", impression: "", notes: "" }), impression: e.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-1 text-xs block">
                          <span className="text-muted-foreground">Notes</span>
                          <input
                            value={radiologyEdits[item.id]?.notes ?? ""}
                            onChange={(e) =>
                              setRadiologyEdits((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] ?? { findings: "", impression: "", notes: "" }), notes: e.target.value },
                              }))
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          />
                        </label>
                      </div>
                    )}

                    <Label>Edit Reason (required)</Label>
                    <textarea
                      rows={2}
                      value={editReasons[item.id] ?? ""}
                      onChange={(e) => setEditReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button disabled={busyTaskId === item.id || reviewStatus === "APPROVED"} onClick={() => approve(item.id)}>
                        {busyTaskId === item.id ? "Working..." : "Approve"}
                      </Button>
                      <Button variant="outline" disabled={busyTaskId === item.id || reviewStatus === "APPROVED"} onClick={() => reject(item.id)}>
                        Reject
                      </Button>
                      <Button variant="outline" disabled={busyTaskId === item.id || reviewStatus === "APPROVED"} onClick={() => edit(item.id)}>
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
