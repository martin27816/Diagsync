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

type LabCatalogTest = {
  id: string;
  name: string;
  code: string;
  resultFields?: Array<{
    id: string;
    label: string;
    unit?: string | null;
    normalMin?: number | null;
    normalMax?: number | null;
    normalText?: string | null;
  }>;
};

function deepCopy<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

// Shared input styles — larger, easier to read
const inputCls = "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide";
const areaCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none";
const sectionHeadingCls = "text-xs font-bold uppercase tracking-widest text-gray-400 mb-3";

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
  const [showEditSection, setShowEditSection] = useState(false);
  const [printLetterheadMode, setPrintLetterheadMode] = useState<"with" | "without">("with");
  const [addLabTestName, setAddLabTestName] = useState("");
  const [labTestSearch, setLabTestSearch] = useState("");
  const [labTestSearchBusy, setLabTestSearchBusy] = useState(false);
  const [labTestSearchResults, setLabTestSearchResults] = useState<LabCatalogTest[]>([]);
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
        setError(""); setLoading(false); setRows(cached.rows);
        if (cached.rows.length === 0) { setSelectedId(""); setDetails(null); }
        else {
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
      setError("Network error loading details");
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
    setShowEditSection(false);
    const controller = new AbortController();
    void loadDetails(selectedId, { signal: controller.signal });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => { setShowVersionHistory(false); }, [selectedId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void searchLabCatalog(labTestSearch); }, 250);
    return () => window.clearTimeout(timer);
  }, [labTestSearch]);

  function updateLabField(tIdx: number, rIdx: number, key: "value" | "unit" | "reference", value: string) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !Array.isArray(prev.tests[tIdx]?.rows)) return prev;
      const tests = [...prev.tests];
      const test = { ...tests[tIdx] };
      const rows = [...test.rows];
      rows[rIdx] = { ...rows[rIdx], [key]: value };
      test.rows = rows; tests[tIdx] = test;
      return { ...prev, tests };
    });
  }

  function updateLabTestName(tIdx: number, value: string) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !prev.tests[tIdx]) return prev;
      const tests = [...prev.tests];
      tests[tIdx] = { ...tests[tIdx], name: value };
      return { ...prev, tests };
    });
  }

  function addLabTest(testName?: string) {
    setEditableContent((prev: any) => {
      const tests = Array.isArray(prev?.tests) ? [...prev.tests] : [];
      tests.push({ name: (testName ?? "").trim() || `Laboratory Test ${tests.length + 1}`, forceShow: true, rows: [{ name: "Result Field", value: "", unit: "", reference: "" }] });
      return { ...(prev ?? {}), tests };
    });
    setAddLabTestName("");
  }

  function removeLabTest(tIdx: number) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests)) return prev;
      return { ...prev, tests: prev.tests.filter((_: unknown, index: number) => index !== tIdx) };
    });
  }

  function addLabField(tIdx: number) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !Array.isArray(prev.tests[tIdx]?.rows)) return prev;
      const tests = [...prev.tests];
      const test = { ...tests[tIdx] };
      const rows = [...test.rows, { name: "Result Field", value: "", unit: "", reference: "" }];
      test.rows = rows; tests[tIdx] = test;
      return { ...prev, tests };
    });
  }

  function removeLabField(tIdx: number, rIdx: number) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !Array.isArray(prev.tests[tIdx]?.rows)) return prev;
      const tests = [...prev.tests];
      const test = { ...tests[tIdx] };
      const rows = test.rows.filter((_: unknown, index: number) => index !== rIdx);
      test.rows = rows.length > 0 ? rows : [{ name: "Result Field", value: "", unit: "", reference: "" }];
      tests[tIdx] = test;
      return { ...prev, tests };
    });
  }

  function updateLabFieldName(tIdx: number, rIdx: number, value: string) {
    setEditableContent((prev: any) => {
      if (!Array.isArray(prev?.tests) || !Array.isArray(prev.tests[tIdx]?.rows)) return prev;
      const tests = [...prev.tests];
      const test = { ...tests[tIdx] };
      const rows = [...test.rows];
      rows[rIdx] = { ...rows[rIdx], name: value };
      test.rows = rows; tests[tIdx] = test;
      return { ...prev, tests };
    });
  }

  function buildReferenceFromTemplate(field: NonNullable<LabCatalogTest["resultFields"]>[number]) {
    const normalText = String(field.normalText ?? "").trim();
    if (normalText) return normalText;
    if (typeof field.normalMin === "number" && typeof field.normalMax === "number") {
      const range = `${field.normalMin} - ${field.normalMax}`;
      return field.unit ? `${range} ${field.unit}` : range;
    }
    return "";
  }

  function addLabTestFromCatalog(test: LabCatalogTest) {
    setEditableContent((prev: any) => {
      const tests = Array.isArray(prev?.tests) ? [...prev.tests] : [];
      const rows = (Array.isArray(test.resultFields) ? test.resultFields : []).map((field) => ({
        name: field.label, value: "", unit: field.unit ?? "", reference: buildReferenceFromTemplate(field),
      }));
      tests.push({ name: test.name, forceShow: true, rows: rows.length > 0 ? rows : [{ name: "Result Field", value: "", unit: "", reference: "" }] });
      return { ...(prev ?? {}), tests };
    });
    setLabTestSearch(""); setLabTestSearchResults([]);
  }

  async function searchLabCatalog(query: string) {
    const trimmed = query.trim();
    if (!trimmed) { setLabTestSearchResults([]); return; }
    setLabTestSearchBusy(true);
    try {
      const res = await fetch(`/api/tests?search=${encodeURIComponent(trimmed)}&type=LAB&department=LABORATORY`);
      const json = await res.json();
      if (!json.success) { setLabTestSearchResults([]); return; }
      setLabTestSearchResults((json.data as LabCatalogTest[]).slice(0, 8));
    } catch { setLabTestSearchResults([]); }
    finally { setLabTestSearchBusy(false); }
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
    if (!resolvedReason) { setError("Please enter an edit reason."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/draft`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportContent: editableContent, comments: editComments || null, prescription: editPrescription || null, reason: resolvedReason }) })).json();
      if (!json.success) { setError(json.error ?? "Unable to save edits"); return; }
      invalidateReportCache(details.id);
      setMessage(details.isReleased ? "Report updated." : "Draft saved.");
      setEditReason(""); setPreviewLoaded(false); setPreviewNonce((v) => v + 1);
      await loadDetails(details.id, { force: true }); await loadReports({ force: true });
    } finally { setBusy(false); }
  }

  async function releaseReport() {
    if (!details) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/release`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: releaseMethod, instructions: receptionInstruction || undefined }) })).json();
      if (!json.success) { setError(json.error ?? "Release failed"); return; }
      invalidateReportCache(details.id); setMessage("Report released.");
      setPreviewLoaded(false); setPreviewNonce((v) => v + 1);
      await loadDetails(details.id, { force: true }); await loadReports({ force: true });
    } finally { setBusy(false); }
  }

  async function printReport() {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PRINT" }) });
    window.open(previewUrl(details.id, printLetterheadMode, { showPrintButton: true }), "_blank", "noopener,noreferrer");
  }

  async function printNow() {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PRINT" }) });
    window.open(previewUrl(details.id, printLetterheadMode, { showPrintButton: true, autoPrint: true }), "_blank", "noopener,noreferrer");
  }

  async function downloadReport() {
    if (!details) return;
    setError(""); setMessage("");
    await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "DOWNLOAD" }) });
    const link = document.createElement("a");
    link.href = pdfUrl(details.id, printLetterheadMode);
    link.rel = "noopener noreferrer";
    document.body.appendChild(link); link.click(); link.remove();
    setMessage("PDF download started.");
  }

  async function sendWhatsapp() {
    if (!details) return;
    const whatsappWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    let shouldCloseWindow = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SEND_WHATSAPP" }) });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "WhatsApp handoff failed"); return; }
      if (json.data?.waUrl) {
        if (whatsappWindow) { whatsappWindow.location.href = json.data.waUrl; }
        else { try { window.location.href = json.data.waUrl; } catch { } }
        shouldCloseWindow = false;
        setMessage("WhatsApp opened. Send the report link to the patient.");
      } else { setError("WhatsApp destination unavailable."); }
    } finally {
      if (shouldCloseWindow && whatsappWindow && whatsappWindow.location.href === "about:blank") whatsappWindow.close();
      setBusy(false);
    }
  }

  const canEdit = canMdEdit || ((canHrmRelease || canReceptionDispatch) && details?.isReleased);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          <option value="ALL">All types</option>
          <option value="lab">Lab reports</option>
          <option value="radiology">Radiology reports</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RELEASED">Released</option>
        </select>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-red-500">⚠</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="mt-0.5 text-green-500">✓</span>
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {/* Main layout */}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        {/* Report list */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <span className={sectionHeadingCls}>Reports</span>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading reports…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No reports found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${row.id === selectedId ? "bg-blue-50 border-l-4 border-blue-500" : "hover:bg-gray-50 border-l-4 border-transparent"}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{row.visit.patient.fullName}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.isReleased ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.isReleased ? "Released" : "Draft"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{row.reportType === "lab" ? "Lab" : "Radiology"} · {row.visit.visitNumber}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{formatDateTime(row.updatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {!details ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 text-4xl">📋</div>
              <p className="text-sm font-medium text-gray-500">Select a report to view details</p>
            </div>
          ) : (
            <div>
              {/* Patient header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{details.visit.patient.fullName}</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-mono">{details.visit.patient.patientId} · {details.visit.visitNumber}</p>
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {details.reportType === "lab" ? "Lab" : "Radiology"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${details.isReleased ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {details.isReleased ? "Released" : "Draft"}
                  </span>
                </div>
              </div>

              {/* Report preview */}
              <div className="px-6 py-5 border-b border-gray-100">
                <p className={sectionHeadingCls}>Report Preview</p>
                <iframe
                  title="Report preview"
                  ref={previewRef}
                  key={`${details.id}:${printLetterheadMode}`}
                  src={previewUrl(details.id, printLetterheadMode)}
                  onLoad={() => setPreviewLoaded(true)}
                  className="h-96 w-full rounded-xl border border-gray-200"
                />
              </div>

              {/* Release / Dispatch controls */}
              {(canHrmRelease || canReceptionDispatch) && (
                <div className="px-6 py-5 border-b border-gray-100 space-y-4">
                  <p className={sectionHeadingCls}>{canReceptionDispatch ? "Dispatch" : "Release"}</p>

                  {/* Print format */}
                  <div>
                    <label className={labelCls}>Print format</label>
                    <select
                      value={printLetterheadMode}
                      onChange={(e) => { setPreviewLoaded(false); setPrintLetterheadMode(e.target.value as "with" | "without"); }}
                      className="h-9 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    >
                      <option value="with">With letterhead</option>
                      <option value="without">Without letterhead</option>
                    </select>
                    <p className="mt-1.5 text-xs text-gray-400">Watermark appears in both formats. WhatsApp always uses letterhead.</p>
                  </div>

                  {/* HRM-only: Release method + receptionist note */}
                  {!canReceptionDispatch && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Release method</label>
                        <select
                          value={releaseMethod}
                          onChange={(e) => setReleaseMethod(e.target.value as any)}
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                          <option value="PRINT">Print</option>
                          <option value="DOWNLOAD">Download</option>
                          <option value="WHATSAPP">WhatsApp</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Note for receptionist</label>
                        <input
                          value={receptionInstruction}
                          onChange={(e) => setReceptionInstruction(e.target.value)}
                          className={inputCls}
                          placeholder="Optional note…"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={printNow}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      🖨 Print Now
                    </button>
                    <button
                      disabled={busy}
                      onClick={printReport}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Preview & Print
                    </button>
                    <button
                      disabled={busy || !details.isReleased || !previewLoaded}
                      onClick={downloadReport}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      ↓ Download PDF
                    </button>
                    <button
                      disabled={busy || !details.isReleased || !previewLoaded}
                      onClick={sendWhatsapp}
                      className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      WhatsApp
                    </button>
                    {!canReceptionDispatch && (
                      <button
                        disabled={busy || details.isReleased}
                        onClick={releaseReport}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {details.isReleased ? "✓ Released" : "Release Report"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Edit section — collapsible */}
              {canEdit && (
                <div className="px-6 py-5 border-b border-gray-100">
                  <button
                    onClick={() => setShowEditSection((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <p className={sectionHeadingCls + " mb-0"}>Edit Report</p>
                    <span className="text-xs text-gray-400 font-medium">{showEditSection ? "▲ Collapse" : "▼ Expand"}</span>
                  </button>

                  {showEditSection && (
                    <div className="mt-4 space-y-5">
                      {/* Lab edits */}
                      {details.department === "LABORATORY" ? (
                        <div className="space-y-4">
                          {/* Add test from catalog */}
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <p className="text-sm font-semibold text-gray-700">Add a Test</p>
                            <div className="flex gap-2">
                              <input
                                value={labTestSearch}
                                onChange={(e) => setLabTestSearch(e.target.value)}
                                className={inputCls}
                                placeholder="Search catalog (e.g. FBC, urine M/C/S…)"
                              />
                              <button
                                type="button"
                                disabled={busy || labTestSearchBusy}
                                onClick={() => void searchLabCatalog(labTestSearch)}
                                className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                {labTestSearchBusy ? "…" : "Search"}
                              </button>
                            </div>
                            {labTestSearchResults.length > 0 && (
                              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                                {labTestSearchResults.map((test) => (
                                  <div key={test.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{test.name}</p>
                                      <p className="text-xs text-gray-400">{test.code}</p>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => addLabTestFromCatalog(test)}
                                      className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                value={addLabTestName}
                                onChange={(e) => setAddLabTestName(e.target.value)}
                                className={inputCls}
                                placeholder="Or enter a custom test name…"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => addLabTest(addLabTestName)}
                                className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                + Custom
                              </button>
                            </div>
                          </div>

                          {/* Existing tests */}
                          {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                            <div key={tIdx} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                              {/* Test name header */}
                              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                                <input
                                  value={test?.name ?? ""}
                                  onChange={(e) => updateLabTestName(tIdx, e.target.value)}
                                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                  placeholder={`Test ${tIdx + 1}`}
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeLabTest(tIdx)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>

                              {/* Result rows */}
                              <div className="divide-y divide-gray-100">
                                {(Array.isArray(test?.rows) ? test.rows : []).map((row: any, rIdx: number) => (
                                  <div key={rIdx} className="px-4 py-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={row?.name ?? ""}
                                        onChange={(e) => updateLabFieldName(tIdx, rIdx, e.target.value)}
                                        className="flex-1 h-8 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                        placeholder={`Field ${rIdx + 1} name`}
                                      />
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => removeLabField(tIdx, rIdx)}
                                        className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">Result</label>
                                        <input value={row?.value ?? ""} onChange={(e) => updateLabField(tIdx, rIdx, "value", e.target.value)} className={inputCls} />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">Unit</label>
                                        <input value={row?.unit ?? ""} onChange={(e) => updateLabField(tIdx, rIdx, "unit", e.target.value)} className={inputCls} />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">Reference</label>
                                        <input value={row?.reference ?? ""} onChange={(e) => updateLabField(tIdx, rIdx, "reference", e.target.value)} className={inputCls} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => addLabField(tIdx)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                  + Add Row
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Radiology edits */
                        <div className="space-y-3">
                          {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                            <div key={tIdx} className="rounded-xl border border-gray-200 p-4 space-y-3">
                              <p className="text-sm font-semibold text-gray-700">{test?.name ?? `Report ${tIdx + 1}`}</p>
                              {(["findings", "impression", "notes"] as const).map((key) => (
                                <div key={key}>
                                  <label className={labelCls}>{key}</label>
                                  <textarea rows={2} value={test?.[key] ?? ""} onChange={(e) => updateRadField(tIdx, key, e.target.value)} className={areaCls} />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments, Prescription, Edit reason */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Comments <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                          <textarea rows={3} value={editComments} onChange={(e) => setEditComments(e.target.value)} className={areaCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Prescription <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                          <textarea rows={3} value={editPrescription} onChange={(e) => setEditPrescription(e.target.value)} className={areaCls} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>
                          Reason for edit {!details.isReleased && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className={inputCls}
                          placeholder={details.isReleased ? "Optional for released report corrections" : "Required — briefly describe the change"}
                        />
                      </div>

                      <button
                        disabled={busy}
                        onClick={saveMdEdits}
                        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busy ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Version history — collapsible */}
              <div className="px-6 py-5">
                <button
                  onClick={() => setShowVersionHistory((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <p className={sectionHeadingCls + " mb-0"}>Version History</p>
                  <span className="text-xs text-gray-400 font-medium">{showVersionHistory ? "▲ Hide" : "▼ Show"}</span>
                </button>

                {showVersionHistory ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-2 text-left text-xs font-semibold text-gray-400">Version</th>
                          <th className="pb-2 text-left text-xs font-semibold text-gray-400">Edited by</th>
                          <th className="pb-2 text-left text-xs font-semibold text-gray-400">Reason</th>
                          <th className="pb-2 text-right text-xs font-semibold text-gray-400">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {details.versions.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2.5 font-mono text-gray-700 text-sm">
                              v{v.version} {v.isActive && <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">active</span>}
                            </td>
                            <td className="py-2.5 text-gray-600">{v.editedBy.fullName}</td>
                            <td className="py-2.5 text-gray-400">{v.editReason}</td>
                            <td className="py-2.5 text-right text-gray-400 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">Tap "Show" to see all edits made to this report.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}