"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@/lib/utils";

type ReportType = "lab" | "radiology";
type Department = "LABORATORY" | "RADIOLOGY";
type ReportStatus = "DRAFT" | "RELEASED";

type ReportListItem = {
  id: string; reportType: ReportType; department: Department;
  status: ReportStatus; isReleased: boolean; releasedAt?: string | null; updatedAt: string;
  visit: { visitNumber: string; patient: { fullName: string; patientId: string; age: number; sex: string } };
};
type ReportDetails = ReportListItem & {
  comments?: string | null; prescription?: string | null; releaseInstructions?: string | null;
  versions: Array<{ id: string; version: number; isActive: boolean; content: any; comments?: string | null; prescription?: string | null; editReason: string; createdAt: string; editedBy: { id: string; fullName: string } }>;
};

function deepCopy<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

const inputCls = "h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[11px] font-medium text-slate-500 mb-1";
const areaCls = "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ReportWorkspace({ role }: { role: "MD" | "HRM" | "SUPER_ADMIN" | "RECEPTIONIST" }) {
  const REPORT_LIST_CACHE_TTL_MS = 20_000;
  const REPORT_DETAILS_CACHE_TTL_MS = 20_000;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ReportListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [details, setDetails] = useState<ReportDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"ALL" | ReportStatus>("ALL");
  const [filterType, setFilterType] = useState<"ALL" | ReportType>("ALL");
  const [editReason, setEditReason] = useState("");
  const [editComments, setEditComments] = useState("");
  const [editPrescription, setEditPrescription] = useState("");
  const [editableContent, setEditableContent] = useState<any>(null);
  const [releaseMethod, setReleaseMethod] = useState<"PRINT" | "DOWNLOAD" | "WHATSAPP">("PRINT");
  const [receptionInstruction, setReceptionInstruction] = useState("");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [printLetterheadMode, setPrintLetterheadMode] = useState<"with" | "without">("with");
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const loadReportsSeqRef = useRef(0);
  const loadDetailsSeqRef = useRef(0);
  const reportListCacheRef = useRef<Map<string, { at: number; rows: ReportListItem[] }>>(new Map());
  const reportDetailsCacheRef = useRef<Map<string, { at: number; details: ReportDetails }>>(new Map());

  const canMdEdit = role === "MD" || role === "SUPER_ADMIN";
  const canHrmRelease = role === "HRM" || role === "SUPER_ADMIN";
  const canReceptionDispatch = role === "RECEPTIONIST";

  const activeVersion = useMemo(() => {
    if (!details) return null;
    return details.versions.find((v) => v.isActive) ?? details.versions[0] ?? null;
  }, [details]);

  function invalidateReportCache(reportId?: string) {
    reportListCacheRef.current.clear();
    if (reportId) {
      reportDetailsCacheRef.current.delete(reportId);
      return;
    }
    reportDetailsCacheRef.current.clear();
  }

  function previewUrl(
    reportId: string,
    letterheadMode: "with" | "without",
    opts?: { showPrintButton?: boolean; autoPrint?: boolean }
  ) {
    const query = new URLSearchParams();
    if (letterheadMode === "without") query.set("letterhead", "without");
    if (opts?.showPrintButton) query.set("printButton", "1");
    if (opts?.autoPrint) query.set("autoPrint", "1");
    if (previewNonce > 0) query.set("v", String(previewNonce));
    const suffix = query.toString();
    return `/api/reports/${reportId}/preview${suffix ? `?${suffix}` : ""}`;
  }

  function pdfUrl(reportId: string, letterheadMode: "with" | "without") {
    const query = new URLSearchParams();
    if (letterheadMode === "without") query.set("letterhead", "without");
    if (previewNonce > 0) query.set("v", String(previewNonce));
    const suffix = query.toString();
    return `/api/reports/${reportId}/pdf${suffix ? `?${suffix}` : ""}`;
  }

  async function loadReports(opts?: { signal?: AbortSignal; force?: boolean }) {
    const cacheKey = `${filterStatus}:${filterType}`;
    if (!opts?.force) {
      const cached = reportListCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.at < REPORT_LIST_CACHE_TTL_MS) {
        setError("");
        setLoading(false);
        setRows(cached.rows);
        if (cached.rows.length === 0) {
          setSelectedId("");
          setDetails(null);
        } else {
          const nextId = selectedId && cached.rows.some((r) => r.id === selectedId) ? selectedId : cached.rows[0].id;
          setSelectedId(nextId);
        }
        return;
      }
    }

    const requestId = ++loadReportsSeqRef.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/reports?${new URLSearchParams({ status: filterStatus, reportType: filterType })}`, { signal: opts?.signal });
      const json = await res.json();
      if (requestId !== loadReportsSeqRef.current || opts?.signal?.aborted) return;
      if (!json.success) { setError(json.error ?? "Failed to load reports"); return; }
      const items = json.data as ReportListItem[];
      reportListCacheRef.current.set(cacheKey, { at: Date.now(), rows: items });
      setRows(items);
      if (items.length === 0) { setSelectedId(""); setDetails(null); return; }
      const nextId = selectedId && items.some((r) => r.id === selectedId) ? selectedId : items[0].id;
      setSelectedId(nextId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error");
    } finally {
      if (requestId !== loadReportsSeqRef.current || opts?.signal?.aborted) return;
      setLoading(false);
    }
  }

  async function loadDetails(reportId: string, opts?: { signal?: AbortSignal; force?: boolean }) {
    if (!opts?.force) {
      const cached = reportDetailsCacheRef.current.get(reportId);
      if (cached && Date.now() - cached.at < REPORT_DETAILS_CACHE_TTL_MS) {
        setError("");
        const data = cached.details;
        setDetails(data);
        const cur = data.versions.find((v) => v.isActive) ?? data.versions[0];
        setEditableContent(deepCopy(cur?.content ?? {}));
        setEditComments(cur?.comments ?? data.comments ?? "");
        setEditPrescription(cur?.prescription ?? data.prescription ?? "");
        setReceptionInstruction(data.releaseInstructions ?? "");
        return;
      }
    }

    const requestId = ++loadDetailsSeqRef.current;
    setError("");
    try {
      const res = await fetch(`/api/reports/${reportId}`, { signal: opts?.signal });
      const json = await res.json();
      if (requestId !== loadDetailsSeqRef.current || opts?.signal?.aborted) return;
      if (!json.success) { setError(json.error ?? "Failed to load report details"); return; }
      const data = json.data as ReportDetails;
      reportDetailsCacheRef.current.set(reportId, { at: Date.now(), details: data });
      setDetails(data);
      const cur = data.versions.find((v) => v.isActive) ?? data.versions[0];
      setEditableContent(deepCopy(cur?.content ?? {}));
      setEditComments(cur?.comments ?? data.comments ?? "");
      setEditPrescription(cur?.prescription ?? data.prescription ?? "");
      setReceptionInstruction(data.releaseInstructions ?? "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error while loading report details");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadReports({ signal: controller.signal });
    return () => controller.abort();
  }, [filterStatus, filterType]);
  useEffect(() => {
    if (!selectedId) return;
    setPreviewLoaded(false);
    const controller = new AbortController();
    void loadDetails(selectedId, { signal: controller.signal });
    return () => controller.abort();
  }, [selectedId]);
  useEffect(() => { setShowVersionHistory(false); }, [selectedId]);

  function updateLabField(
    tIdx: number,
    rIdx: number,
    key: "value" | "unit" | "reference",
    value: string
  ) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !Array.isArray(prev.tests[tIdx]?.rows)) return prev;
      const tests = [...prev.tests];
      const test = { ...tests[tIdx] };
      const rows = [...test.rows];
      rows[rIdx] = { ...rows[rIdx], [key]: value };
      test.rows = rows;
      tests[tIdx] = test;
      return { ...prev, tests };
    });
  }
  function updateRadField(tIdx: number, key: "findings" | "impression" | "notes", value: string) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !prev.tests[tIdx]) return prev;
      const tests = [...prev.tests];
      tests[tIdx] = { ...tests[tIdx], [key]: value };
      return { ...prev, tests };
    });
  }

  async function saveMdEdits() {
    if (!details) return;
    const resolvedReason = editReason.trim() || (details.isReleased ? "Dispatch correction" : "");
    if (!resolvedReason) { setError("Edit reason is required."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/draft`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportContent: editableContent, comments: editComments || null, prescription: editPrescription || null, reason: resolvedReason }) })).json();
      if (!json.success) { setError(json.error ?? "Unable to save edits"); return; }
      invalidateReportCache(details.id);
      setMessage(details.isReleased ? "Report updated." : "Draft updated."); setEditReason("");
      setPreviewLoaded(false);
      setPreviewNonce((value) => value + 1);
      await loadDetails(details.id, { force: true }); await loadReports({ force: true });
    } finally { setBusy(false); }
  }

  async function releaseReport() {
    if (!details) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/release`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: releaseMethod, instructions: receptionInstruction || undefined }) })).json();
      if (!json.success) { setError(json.error ?? "Release failed"); return; }
      invalidateReportCache(details.id);
      setMessage("Report released.");
      setPreviewLoaded(false);
      setPreviewNonce((value) => value + 1);
      await loadDetails(details.id, { force: true }); await loadReports({ force: true });
    } finally { setBusy(false); }
  }

  async function printReport() {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PRINT" }) });
    window.open(
      previewUrl(details.id, printLetterheadMode, { showPrintButton: true }),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function printNow() {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "PRINT" }),
    });
    window.open(
      previewUrl(details.id, printLetterheadMode, { showPrintButton: true, autoPrint: true }),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function downloadReport() {
    if (!details) return;
    setError("");
    setMessage("");
    await fetch(`/api/reports/${details.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DOWNLOAD" }),
    });
    const link = document.createElement("a");
    link.href = pdfUrl(details.id, printLetterheadMode);
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage("PDF download started.");
  }

  async function sendWhatsapp() {
    if (!details) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SEND_WHATSAPP" }) });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "WhatsApp handoff failed"); return; }
      const link = document.createElement("a");
      link.href = pdfUrl(details.id, "with");
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (json.data?.waUrl) {
        window.open(json.data.waUrl, "_blank", "noopener,noreferrer");
        setMessage("PDF downloaded. WhatsApp opened, attach the PDF in chat.");
      } else {
        setError("WhatsApp destination unavailable.");
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <option value="ALL">All types</option>
          <option value="lab">Lab reports</option>
          <option value="radiology">Radiology reports</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RELEASED">Released</option>
        </select>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      {message && <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Report list */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reports</span>
          </div>
          {loading ? (
            <p className="px-3 py-4 text-xs text-slate-400">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400">No reports found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <button key={row.id} onClick={() => setSelectedId(row.id)}
                  className={`w-full px-3 py-2.5 text-left transition-colors ${row.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{row.visit.patient.fullName}</p>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${row.isReleased ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {row.isReleased ? "Released" : "Draft"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{row.reportType === "lab" ? "Lab" : "Radiology"} · {row.visit.visitNumber}</p>
                  <p className="text-[11px] text-slate-300">{formatDateTime(row.updatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {!details ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Select a report to view details.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {details.reportType === "lab" ? "Lab Report" : "Radiology Report"} — {details.visit.patient.fullName}
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">{details.visit.patient.patientId} · {details.visit.visitNumber}</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{details.department}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${details.isReleased ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{details.status}</span>
                </div>
              </div>

              {/* Preview iframe */}
              <div className="p-4">
                <iframe title="Report preview" ref={previewRef}
                  key={`${details.id}:${printLetterheadMode}`}
                  src={previewUrl(details.id, printLetterheadMode)}
                  onLoad={() => setPreviewLoaded(true)} className="h-96 w-full rounded border border-slate-200" />
              </div>

              {/* Edit section */}
              {(canMdEdit || ((canHrmRelease || canReceptionDispatch) && details.isReleased)) && (
                <div className="p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Report Edits</p>
                  {details.department === "LABORATORY" ? (
                    <div className="space-y-2">
                      {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                        <div key={tIdx} className="rounded border border-slate-100 p-2">
                          <p className="text-xs font-medium text-slate-700 mb-2">{test?.name ?? `Test ${tIdx + 1}`}</p>
                          <div className="grid grid-cols-1 gap-2">
                            {(Array.isArray(test?.rows) ? test.rows : []).map((row: any, rIdx: number) => (
                              <div key={rIdx} className="rounded border border-slate-100 p-2">
                                <span className="block text-[11px] font-medium text-slate-500 mb-2">{row?.name ?? `Field ${rIdx + 1}`}</span>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                                  <label>
                                    <span className="block text-[11px] text-slate-400">Result</span>
                                    <input
                                      value={row?.value ?? ""}
                                      onChange={(e) => updateLabField(tIdx, rIdx, "value", e.target.value)}
                                      className={inputCls}
                                    />
                                  </label>
                                  <label>
                                    <span className="block text-[11px] text-slate-400">Unit</span>
                                    <input
                                      value={row?.unit ?? ""}
                                      onChange={(e) => updateLabField(tIdx, rIdx, "unit", e.target.value)}
                                      className={inputCls}
                                    />
                                  </label>
                                  <label>
                                    <span className="block text-[11px] text-slate-400">Reference/Range</span>
                                    <input
                                      value={row?.reference ?? ""}
                                      onChange={(e) => updateLabField(tIdx, rIdx, "reference", e.target.value)}
                                      className={inputCls}
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                        <div key={tIdx} className="rounded border border-slate-100 p-2 space-y-1.5">
                          <p className="text-xs font-medium text-slate-700">{test?.name ?? `Report ${tIdx + 1}`}</p>
                          {(["findings", "impression", "notes"] as const).map((key) => (
                            <label key={key}>
                              <span className={labelCls}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                              <textarea rows={2} value={test?.[key] ?? ""} onChange={(e) => updateRadField(tIdx, key, e.target.value)} className={areaCls} />
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Comments (optional)</label>
                    <textarea rows={2} value={editComments} onChange={(e) => setEditComments(e.target.value)} className={areaCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Prescription (optional)</label>
                    <textarea rows={2} value={editPrescription} onChange={(e) => setEditPrescription(e.target.value)} className={areaCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{details.isReleased ? "Edit reason (optional)" : "Edit reason *"}</label>
                    <textarea
                      rows={1}
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder={details.isReleased ? "Optional for released report corrections" : ""}
                      className={areaCls}
                    />
                  </div>
                  <button disabled={busy} onClick={saveMdEdits}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {busy ? "Saving..." : "Save Edits"}
                  </button>
                </div>
              )}

              {/* Release / Dispatch controls */}
              {(canHrmRelease || canReceptionDispatch) && (
                <div className="p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {canReceptionDispatch ? "Dispatch" : "Release"}
                  </p>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    Print option: choose with or without letterhead. Watermark stays in both modes. WhatsApp always uses letterhead.
                  </div>
                  <div>
                    <label className={labelCls}>Print format</label>
                    <select
                      value={printLetterheadMode}
                      onChange={(e) => {
                        setPreviewLoaded(false);
                        setPrintLetterheadMode(e.target.value as "with" | "without");
                      }}
                      className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                    >
                      <option value="with">With letterhead</option>
                      <option value="without">Without letterhead (B/W friendly)</option>
                    </select>
                  </div>
                  {!canReceptionDispatch && (
                    <>
                      <div>
                        <label className={labelCls}>Instruction for receptionist (optional)</label>
                        <textarea rows={2} value={receptionInstruction} onChange={(e) => setReceptionInstruction(e.target.value)} className={areaCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Release method</label>
                        <select value={releaseMethod} onChange={(e) => setReleaseMethod(e.target.value as any)}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
                          <option value="PRINT">Print</option>
                          <option value="DOWNLOAD">Download</option>
                          <option value="WHATSAPP">WhatsApp</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={printNow} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">Print</button>
                    <button disabled={busy} onClick={printReport} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Print Preview</button>
                    <button disabled={busy || !details.isReleased || !previewLoaded} onClick={downloadReport} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Download</button>
                    <button disabled={busy || !details.isReleased || !previewLoaded} onClick={sendWhatsapp} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">WhatsApp</button>
                    {!canReceptionDispatch && (
                      <button disabled={busy || details.isReleased} onClick={releaseReport}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {details.isReleased ? "Released" : "Release Report"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Version history */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Version History</p>
                  <button
                    onClick={() => setShowVersionHistory((prev) => !prev)}
                    className="rounded border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {showVersionHistory ? "Hide" : "Show"}
                  </button>
                </div>
                {showVersionHistory ? (
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-1.5 text-left font-medium text-slate-400">Version</th>
                        <th className="pb-1.5 text-left font-medium text-slate-400">By</th>
                        <th className="pb-1.5 text-left font-medium text-slate-400">Reason</th>
                        <th className="pb-1.5 text-right font-medium text-slate-400">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details.versions.map((v) => (
                        <tr key={v.id}>
                          <td className="py-1.5 font-mono text-slate-700">v{v.version} {v.isActive && <span className="text-blue-600">(active)</span>}</td>
                          <td className="py-1.5 text-slate-600">{v.editedBy.fullName}</td>
                          <td className="py-1.5 text-slate-400">{v.editReason}</td>
                          <td className="py-1.5 text-right text-slate-400 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Version history is collapsed to keep this view fast.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
