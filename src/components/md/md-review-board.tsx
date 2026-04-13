"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { ResultInsightBox } from "@/components/results/result-insight-box";
import { buildResultInsights } from "@/lib/result-insights";
import { PatientInsights } from "@/components/patients/patient-insights";
import { analyzePatientInsights, type PatientHistoryRow } from "@/lib/patient-insights";
import { toCustomFieldKey } from "@/lib/custom-fields-core";
import { SIGNOFF_IMAGE_KEY, SIGNOFF_NAME_KEY, isDataImageUrl } from "@/lib/report-signoff";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type TaskDepartment = "LABORATORY" | "RADIOLOGY";

type Item = {
  id: string;
  department: TaskDepartment;
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  updatedAt: string;
  visit: { visitNumber: string; patient: { fullName: string; patientId: string; age: number; sex: string } };
  staff: { fullName: string } | null;
  review: { status: ReviewStatus; comments?: string | null; rejectionReason?: string | null; editedData?: unknown } | null;
  results: Array<{
    testOrderId: string;
    testOrder: { test: { name: string } };
    currentVersion: number;
    resultData: Record<string, unknown>;
    notes?: string | null;
    versionHistory: Array<{ id: string; version: number; isActive: boolean; parentId?: string | null; resultData: Record<string, unknown>; notes?: string | null; editReason: string; editedBy: { id: string; fullName: string }; createdAt: string }>;
  }>;
  radiologyReport: { currentVersion: number; findings: string; impression: string; notes?: string | null; extraFields?: Record<string, string> | null; versionHistory: Array<{ id: string; version: number; isActive: boolean; parentId?: string | null; findings: string; impression: string; notes?: string | null; extraFields?: Record<string, string> | null; editReason: string; editedBy: { id: string; fullName: string }; createdAt: string }> } | null;
  imagingFiles: Array<{ id: string; fileName: string; fileUrl: string }>;
  patientHistory: PatientHistoryRow[];
  patientVisitCount: number;
};

const priorityStyle: Record<string, string> = {
  EMERGENCY: "bg-red-50 text-red-600",
  URGENT: "bg-amber-50 text-amber-700",
  ROUTINE: "bg-slate-100 text-slate-600",
};

const reviewStyle: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
};

function minutesAgoLabel(dateText: string) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(dateText).getTime()) / 60000));
  return `${mins}m ago`;
}

function normalizeResultData(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value ?? {}).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])
  );
}

function getHighlightFields(review: Item["review"]) {
  if (!review?.editedData || typeof review.editedData !== "object") return [];
  const data = review.editedData as { highlightFields?: unknown };
  if (!Array.isArray(data.highlightFields)) return [];
  return data.highlightFields.filter((row): row is string => typeof row === "string");
}

function getRadiologySignature(extraFields?: Record<string, string> | null) {
  const signatureName = extraFields?.[SIGNOFF_NAME_KEY]?.trim() ?? "";
  const signatureImage = extraFields?.[SIGNOFF_IMAGE_KEY]?.trim() ?? "";
  if (!signatureName || !signatureImage) return null;
  if (!isDataImageUrl(signatureImage)) return null;
  return { signatureName, signatureImage };
}

function getVisibleRadiologyExtraFields(extraFields?: Record<string, string> | null) {
  return Object.entries(extraFields ?? {}).filter(
    ([key, value]) =>
      key !== SIGNOFF_IMAGE_KEY &&
      key !== SIGNOFF_NAME_KEY &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  );
}

export function MdReviewBoard({ initialStatus = "pending" }: { initialStatus?: "pending" | "approved" | "rejected" | "all" }) {
  const REVIEW_CACHE_TTL_MS = 20_000;
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectFieldHints, setRejectFieldHints] = useState<Record<string, string>>({});
  const [editReasons, setEditReasons] = useState<Record<string, string>>({});
  const [approveComments, setApproveComments] = useState<Record<string, string>>({});
  const [labEdits, setLabEdits] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [labEditNotes, setLabEditNotes] = useState<Record<string, Record<string, string>>>({});
  const [radiologyEdits, setRadiologyEdits] = useState<Record<string, { findings: string; impression: string; notes: string; extraFields: Record<string, string> }>>({});
  const [newRadFieldLabel, setNewRadFieldLabel] = useState<Record<string, string>>({});
  const [newRadFieldValue, setNewRadFieldValue] = useState<Record<string, string>>({});
  const loadDataSeqRef = useRef(0);
  const reviewCacheRef = useRef<Map<string, { at: number; items: Item[]; counts: { pending: number; approved: number; rejected: number } }>>(new Map());

  function applyLoadedData(data: { items: Item[]; counts: { pending: number; approved: number; rejected: number } }) {
    setItems(data.items);
    setCounts(data.counts);
    const nextLabEdits: Record<string, Record<string, Record<string, string>>> = {};
    const nextLabNotes: Record<string, Record<string, string>> = {};
    const nextRadEdits: Record<string, { findings: string; impression: string; notes: string; extraFields: Record<string, string> }> = {};
    for (const item of data.items) {
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
          extraFields: item.radiologyReport?.extraFields ?? {},
        };
      }
    }
    setLabEdits(nextLabEdits);
    setLabEditNotes(nextLabNotes);
    setRadiologyEdits(nextRadEdits);
  }

  async function loadData(opts?: { signal?: AbortSignal; force?: boolean }) {
    const cacheKey = status;
    if (!opts?.force) {
      const cached = reviewCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.at < REVIEW_CACHE_TTL_MS) {
        setError("");
        setLoading(false);
        applyLoadedData({ items: cached.items, counts: cached.counts });
        return;
      }
    }

    const requestId = ++loadDataSeqRef.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/md/reviews?status=${status}`, { signal: opts?.signal });
      const json = await res.json() as { success: boolean; error?: string; data: { items: Item[]; counts: { pending: number; approved: number; rejected: number } } };
      if (requestId !== loadDataSeqRef.current || opts?.signal?.aborted) return;
      if (!json.success) { setError(json.error ?? "Failed to load review queue"); return; }
      reviewCacheRef.current.set(cacheKey, { at: Date.now(), items: json.data.items, counts: json.data.counts });
      applyLoadedData(json.data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error while loading reviews");
    } finally {
      if (requestId !== loadDataSeqRef.current || opts?.signal?.aborted) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadData({ signal: controller.signal });
    return () => controller.abort();
  }, [status]);

  function applyOptimisticReview(taskId: string, nextStatus: ReviewStatus, reason?: string) {
    const current = items.find((item) => item.id === taskId)?.review?.status ?? "PENDING";
    setItems((prev) => prev.map((item) => item.id === taskId ? { ...item, review: { status: nextStatus, comments: item.review?.comments ?? null, rejectionReason: reason ?? item.review?.rejectionReason ?? null, editedData: item.review?.editedData } } : item));
    if (current !== nextStatus) {
      setCounts((prev) => ({
        pending: prev.pending + (current === "PENDING" ? -1 : 0) + (nextStatus === "PENDING" ? 1 : 0),
        approved: prev.approved + (current === "APPROVED" ? -1 : 0) + (nextStatus === "APPROVED" ? 1 : 0),
        rejected: prev.rejected + (current === "REJECTED" ? -1 : 0) + (nextStatus === "REJECTED" ? 1 : 0),
      }));
    }
  }
  function invalidateReviewCache() {
    reviewCacheRef.current.clear();
  }

  async function approve(taskId: string) {
    setBusyTaskId(taskId); setError("");
    invalidateReviewCache();
    applyOptimisticReview(taskId, "APPROVED");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comments: approveComments[taskId] ?? "" }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) { setError(json.error ?? "Approval failed"); await loadData(); }
      else setExpandedId(null);
    } finally { setBusyTaskId(null); }
  }

  async function reject(taskId: string) {
    const reason = rejectReasons[taskId]?.trim();
    if (!reason) { setError("Rejection reason is required."); return; }
    setBusyTaskId(taskId); setError("");
    invalidateReviewCache();
    applyOptimisticReview(taskId, "REJECTED", reason);
    try {
      const highlightFields = (rejectFieldHints[taskId] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
      const res = await fetch(`/api/md/reviews/${taskId}/reject`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, highlightFields }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) { setError(json.error ?? "Rejection failed"); await loadData(); }
      else setExpandedId(null);
    } finally { setBusyTaskId(null); }
  }

  async function edit(taskId: string) {
    const reason = editReasons[taskId]?.trim();
    if (!reason) { setError("Edit reason is required."); return; }
    const item = items.find((row) => row.id === taskId);
    if (!item) { setError("Task not found."); return; }
    let payload: any;
    if (item.department === "LABORATORY") {
      payload = { testResults: item.results.map((result) => ({ testOrderId: result.testOrderId, resultData: labEdits[taskId]?.[result.testOrderId] ?? normalizeResultData(result.resultData), notes: labEditNotes[taskId]?.[result.testOrderId] ?? result.notes ?? "" })) };
    } else {
      const current = radiologyEdits[taskId] ?? {
        findings: item.radiologyReport?.findings ?? "",
        impression: item.radiologyReport?.impression ?? "",
        notes: item.radiologyReport?.notes ?? "",
        extraFields: item.radiologyReport?.extraFields ?? {},
      };
      if (!current.findings.trim() || !current.impression.trim()) { setError("Findings and impression are required."); return; }
      payload = { report: current };
    }
    setBusyTaskId(taskId); setError("");
    invalidateReviewCache();
    applyOptimisticReview(taskId, "PENDING");
    try {
      const res = await fetch(`/api/md/reviews/${taskId}/edit`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, comments: "Controlled edit created and sent for re-approval", editedData: payload }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) { setError(json.error ?? "Edit failed"); await loadData(); }
      else setExpandedId(null);
    } finally { setBusyTaskId(null); }
  }

  function setRadExtraField(taskId: string, fieldKey: string, value: string) {
    setRadiologyEdits((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? { findings: "", impression: "", notes: "", extraFields: {} }),
        extraFields: {
          ...((prev[taskId] ?? { findings: "", impression: "", notes: "", extraFields: {} }).extraFields ?? {}),
          [fieldKey]: value,
        },
      },
    }));
  }

  function removeRadExtraField(taskId: string, fieldKey: string) {
    setRadiologyEdits((prev) => {
      const current = prev[taskId] ?? { findings: "", impression: "", notes: "", extraFields: {} };
      if (!Object.prototype.hasOwnProperty.call(current.extraFields, fieldKey)) return prev;
      const nextExtra = { ...current.extraFields };
      delete nextExtra[fieldKey];
      return { ...prev, [taskId]: { ...current, extraFields: nextExtra } };
    });
  }

  function addRadExtraField(taskId: string, label: string, value: string) {
    const key = toCustomFieldKey(label);
    if (!key) {
      setError("Field name is invalid.");
      return;
    }
    const current = radiologyEdits[taskId] ?? { findings: "", impression: "", notes: "", extraFields: {} };
    if (Object.prototype.hasOwnProperty.call(current.extraFields, key)) {
      setError(`Field '${key}' already exists.`);
      return;
    }
    setError("");
    setRadExtraField(taskId, key, value);
  }

  function resetRadExtraFields(taskId: string) {
    setRadiologyEdits((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? { findings: "", impression: "", notes: "", extraFields: {} }),
        extraFields: {},
      },
    }));
  }

  if (loading) return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">Loading...</div>
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[{ label: "Pending", value: counts.pending }, { label: "Approved", value: counts.approved }, { label: "Rejected", value: counts.rejected }].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <button onClick={() => void loadData({ force: true })} className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Refresh</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No cases for selected status.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Dept</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests / Report</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">By</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Updated</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const reviewStatus = item.review?.status ?? "PENDING";
                const highlightFields = getHighlightFields(item.review);
                const isExpanded = expandedId === item.id;
                const submittedRadSignature = getRadiologySignature(item.radiologyReport?.extraFields);
                const submittedRadExtraFields = getVisibleRadiologyExtraFields(item.radiologyReport?.extraFields);
                const editRadSignature = getRadiologySignature(radiologyEdits[item.id]?.extraFields);
                const editRadExtraFields = getVisibleRadiologyExtraFields(radiologyEdits[item.id]?.extraFields);
                const insights = isExpanded
                  ? analyzePatientInsights({
                      visitCount: item.patientVisitCount,
                      currentTestNames:
                        item.department === "LABORATORY"
                          ? item.results.map((r) => r.testOrder.test.name)
                          : ["Radiology follow-up"],
                      history: item.patientHistory,
                    })
                  : null;

                return (
                  <>
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isExpanded ? "bg-blue-50/20" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{item.visit.patient.fullName}</p>
                        <p className="font-mono text-slate-400">{item.visit.patient.patientId} Â· {item.visit.patient.age}y Â· {item.visit.patient.sex}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{item.department}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {item.department === "LABORATORY"
                          ? item.results.map((r) => r.testOrder.test.name).join(", ")
                          : `Findings: ${(item.radiologyReport?.findings ?? "").slice(0, 40)}...`}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[item.priority]}`}>{item.priority}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${reviewStyle[reviewStatus]}`}>{reviewStatus}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{item.staff?.fullName ?? "â€”"}</td>
                      <td className="px-4 py-2.5 text-slate-400">{minutesAgoLabel(item.updatedAt)}</td>
                      <td className="px-4 py-2.5">
                        {reviewStatus !== "APPROVED" && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {isExpanded ? "Close" : "Review"}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${item.id}-expand`}>
                        <td colSpan={8} className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                            {/* Left: submitted output */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted Output</p>
                              {insights ? <PatientInsights insights={insights} /> : null}
                              {item.department === "LABORATORY" ? (
                                <div className="space-y-2">
                                  {item.results.map((result) => (
                                    <div key={result.testOrderId} className="rounded border border-slate-100 p-2">
                                      <p className="font-medium text-slate-800">{result.testOrder.test.name} <span className="font-mono text-slate-400 text-[11px]">v{result.currentVersion}</span></p>
                                      <p className="text-slate-500 mt-1">
                                        {Object.entries(result.resultData as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && `${v}`.trim()).map(([k, v]) => `${k}: ${v}`).join(" Â· ") || "â€”"}
                                      </p>
                                      {result.notes && <p className="text-slate-400 text-[11px] mt-0.5">Note: {result.notes}</p>}
                                      <ResultInsightBox messages={buildResultInsights(result.resultData)} />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-slate-700"><span className="font-medium">Findings:</span> {item.radiologyReport?.findings ?? "â€”"}</p>
                                  <p className="text-slate-700"><span className="font-medium">Impression:</span> {item.radiologyReport?.impression ?? "â€”"}</p>
                                  {submittedRadExtraFields.map(([key, value]) => (
                                    <p key={key} className="text-slate-700">
                                      <span className="font-medium">{key}:</span> {value}
                                    </p>
                                  ))}
                                  {submittedRadSignature ? (
                                    <div className="rounded border border-slate-200 bg-slate-50 p-2">
                                      <p className="text-[11px] font-medium text-slate-600 mb-1">Signature</p>
                                      <img
                                        src={submittedRadSignature.signatureImage}
                                        alt={submittedRadSignature.signatureName}
                                        className="h-14 w-auto max-w-[220px] object-contain border border-slate-200 rounded bg-white p-1"
                                      />
                                      <p className="text-[11px] text-slate-700 mt-1">{submittedRadSignature.signatureName}</p>
                                    </div>
                                  ) : null}
                                  <p className="font-mono text-slate-400 text-[11px]">v{item.radiologyReport?.currentVersion ?? 1}</p>
                                </div>
                              )}
                            </div>

                            {/* Right: actions */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actions</p>

                              {item.review?.rejectionReason && (
                                <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                                  Edit requested: {item.review.rejectionReason}
                                </div>
                              )}

                              {/* Approve */}
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Approval comment (optional)</label>
                                <input
                                  value={approveComments[item.id] ?? ""}
                                  onChange={(e) => setApproveComments((p) => ({ ...p, [item.id]: e.target.value }))}
                                  className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Optional comment..."
                                />
                                <button disabled={busyTaskId === item.id} onClick={() => approve(item.id)}
                                  className="mt-1.5 rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                                  Approve
                                </button>
                              </div>

                              {/* Reject */}
                              <div className="border-t border-slate-100 pt-3">
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Rejection reason *</label>
                                <textarea rows={2} value={rejectReasons[item.id] ?? ""} onChange={(e) => setRejectReasons((p) => ({ ...p, [item.id]: e.target.value }))}
                                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                <label className="block text-[11px] font-medium text-slate-500 mt-1.5 mb-1">Fields needing change (comma-separated)</label>
                                <input value={rejectFieldHints[item.id] ?? ""} onChange={(e) => setRejectFieldHints((p) => ({ ...p, [item.id]: e.target.value }))}
                                  placeholder="e.g. hemoglobin, wbc"
                                  className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                <button disabled={busyTaskId === item.id} onClick={() => reject(item.id)}
                                  className="mt-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors">
                                  Reject
                                </button>
                              </div>

                              {/* Edit data */}
                              <div className="border-t border-slate-100 pt-3">
                                <p className="text-[11px] font-semibold text-slate-400 mb-2">Edit Data</p>
                                {item.department === "LABORATORY" ? (
                                  <div className="space-y-2">
                                    {item.results.map((result) => (
                                      <div key={result.testOrderId} className="rounded border border-slate-100 p-2 space-y-1.5">
                                        <p className="font-medium text-slate-700">{result.testOrder.test.name}</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                          {Object.keys(normalizeResultData(result.resultData)).map((fieldKey) => (
                                            <label key={fieldKey}>
                                              <span className="block text-[11px] text-slate-400">{fieldKey}</span>
                                              <input
                                                value={labEdits[item.id]?.[result.testOrderId]?.[fieldKey] ?? ""}
                                                onChange={(e) => setLabEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [result.testOrderId]: { ...((prev[item.id] ?? {})[result.testOrderId] ?? {}), [fieldKey]: e.target.value } } }))}
                                                className={`h-7 w-full rounded border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${highlightFields.includes(fieldKey) ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
                                              />
                                            </label>
                                          ))}
                                        </div>
                                        <label>
                                          <span className="block text-[11px] text-slate-400">Notes</span>
                                          <input value={labEditNotes[item.id]?.[result.testOrderId] ?? ""} onChange={(e) => setLabEditNotes((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [result.testOrderId]: e.target.value } }))}
                                            className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {(["findings", "impression", "notes"] as const).map((field) => (
                                      <label key={field}>
                                        <span className="block text-[11px] text-slate-400 capitalize">{field}</span>
                                        <textarea rows={field === "notes" ? 1 : 2} value={radiologyEdits[item.id]?.[field] ?? ""}
                                          onChange={(e) => setRadiologyEdits((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { findings: "", impression: "", notes: "", extraFields: {} }), [field]: e.target.value } }))}
                                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                      </label>
                                    ))}
                                    <div className="rounded border border-slate-200 p-2">
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">Extra Fields</span>
                                        <button
                                          type="button"
                                          onClick={() => resetRadExtraFields(item.id)}
                                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                                        >
                                          Reset Default
                                        </button>
                                      </div>
                                      <div className="space-y-1.5">
                                        {editRadExtraFields.map(([key, value]) => (
                                          <div key={key} className="grid grid-cols-12 gap-1.5 items-center">
                                            <input value={key} readOnly className="col-span-4 h-7 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-500" />
                                            <input
                                              value={value}
                                              onChange={(e) => setRadExtraField(item.id, key, e.target.value)}
                                              className="col-span-6 h-7 rounded border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!window.confirm(`Remove extra field '${key}'?`)) return;
                                                removeRadExtraField(item.id, key);
                                              }}
                                              className="col-span-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        ))}
                                        {editRadSignature ? (
                                          <div className="rounded border border-slate-200 bg-slate-50 p-2">
                                            <p className="text-[11px] font-medium text-slate-600 mb-1">Signature Preview</p>
                                            <img
                                              src={editRadSignature.signatureImage}
                                              alt={editRadSignature.signatureName}
                                              className="h-14 w-auto max-w-[220px] object-contain border border-slate-200 rounded bg-white p-1"
                                            />
                                            <p className="text-[11px] text-slate-700 mt-1">{editRadSignature.signatureName}</p>
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="mt-2 grid grid-cols-12 gap-1.5">
                                        <input
                                          value={newRadFieldLabel[item.id] ?? ""}
                                          onChange={(e) => setNewRadFieldLabel((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                          placeholder="Field name"
                                          className="col-span-4 h-7 rounded border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <input
                                          value={newRadFieldValue[item.id] ?? ""}
                                          onChange={(e) => setNewRadFieldValue((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                          placeholder="Value"
                                          className="col-span-6 h-7 rounded border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const label = newRadFieldLabel[item.id] ?? "";
                                            const value = newRadFieldValue[item.id] ?? "";
                                            if (!label.trim()) return;
                                            addRadExtraField(item.id, label, value);
                                            setNewRadFieldLabel((prev) => ({ ...prev, [item.id]: "" }));
                                            setNewRadFieldValue((prev) => ({ ...prev, [item.id]: "" }));
                                          }}
                                          className="col-span-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <label className="mt-2 block">
                                  <span className="block text-[11px] font-medium text-slate-500 mb-1">Edit reason *</span>
                                  <textarea rows={1} value={editReasons[item.id] ?? ""} onChange={(e) => setEditReasons((p) => ({ ...p, [item.id]: e.target.value }))}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </label>
                                <button disabled={busyTaskId === item.id} onClick={() => edit(item.id)}
                                  className="mt-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                                  Save Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
