"use client";

import html2canvas from "html2canvas";
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

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

const inputCls = "h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[11px] font-medium text-slate-500 mb-1";
const areaCls = "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ReportWorkspace({ role }: { role: "MD" | "HRM" | "SUPER_ADMIN" | "RECEPTIONIST" }) {
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
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  const canMdEdit = role === "MD" || role === "SUPER_ADMIN";
  const canHrmRelease = role === "HRM" || role === "SUPER_ADMIN";
  const canReceptionDispatch = role === "RECEPTIONIST";

  const activeVersion = useMemo(() => {
    if (!details) return null;
    return details.versions.find((v) => v.isActive) ?? details.versions[0] ?? null;
  }, [details]);

  async function loadReports() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/reports?${new URLSearchParams({ status: filterStatus, reportType: filterType })}`);
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to load reports"); return; }
      const items = json.data as ReportListItem[];
      setRows(items);
      if (items.length === 0) { setSelectedId(""); setDetails(null); return; }
      const nextId = selectedId && items.some((r) => r.id === selectedId) ? selectedId : items[0].id;
      setSelectedId(nextId);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function loadDetails(reportId: string) {
    setError("");
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to load report details"); return; }
      const data = json.data as ReportDetails;
      setDetails(data);
      const cur = data.versions.find((v) => v.isActive) ?? data.versions[0];
      setEditableContent(clone(cur?.content ?? {}));
      setEditComments(cur?.comments ?? data.comments ?? "");
      setEditPrescription(cur?.prescription ?? data.prescription ?? "");
      setReceptionInstruction(data.releaseInstructions ?? "");
    } catch { setError("Network error while loading report details"); }
  }

  useEffect(() => { void loadReports(); }, [filterStatus, filterType]);
  useEffect(() => { if (!selectedId) return; setPreviewLoaded(false); void loadDetails(selectedId); }, [selectedId]);

  function updateLabField(tIdx: number, rIdx: number, value: string) {
    setEditableContent((prev: any) => { const next = clone(prev); if (!Array.isArray(next?.tests) || !Array.isArray(next.tests[tIdx]?.rows)) return prev; next.tests[tIdx].rows[rIdx].value = value; return next; });
  }
  function updateRadField(tIdx: number, key: "findings" | "impression" | "notes", value: string) {
    setEditableContent((prev: any) => { const next = clone(prev); if (!Array.isArray(next?.tests)) return prev; next.tests[tIdx][key] = value; return next; });
  }

  async function saveMdEdits() {
    if (!details || !editReason.trim()) { setError("Edit reason is required."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/draft`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportContent: editableContent, comments: editComments || null, prescription: editPrescription || null, reason: editReason.trim() }) })).json();
      if (!json.success) { setError(json.error ?? "Unable to save edits"); return; }
      setMessage("Draft updated."); setEditReason("");
      await loadDetails(details.id); await loadReports();
    } finally { setBusy(false); }
  }

  async function releaseReport() {
    if (!details) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const json = await (await fetch(`/api/reports/${details.id}/release`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: releaseMethod, instructions: receptionInstruction || undefined }) })).json();
      if (!json.success) { setError(json.error ?? "Release failed"); return; }
      setMessage("Report released.");
      await loadDetails(details.id); await loadReports();
    } finally { setBusy(false); }
  }

  async function printReport() {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PRINT" }) });
    window.open(`/api/reports/${details.id}/preview`, "_blank", "noopener,noreferrer");
  }

  async function captureReportPng(): Promise<{ blob: Blob; fileName: string } | null> {
    if (!details) return null;
    const iframe = previewRef.current;
    if (!iframe?.contentDocument) { setError("Preview not ready. Wait a moment and retry."); return null; }
    const doc = iframe.contentDocument;
    const target = (doc.body as HTMLElement | null) ?? (doc.querySelector(".page") as HTMLElement | null);
    if (!target) { setError("Preview content unavailable."); return null; }
    try {
      iframe.contentWindow?.scrollTo(0, 0);
      const w = Math.max(doc.documentElement?.scrollWidth ?? 0, doc.body?.scrollWidth ?? 0, target.scrollWidth);
      const h = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0, target.scrollHeight);
      const canvas = await html2canvas(target, { useCORS: true, allowTaint: false, scale: 2, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0, width: w || target.clientWidth, height: h || target.clientHeight });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png", 1));
      if (!blob) { setError("Could not generate image."); return null; }
      const safePatient = details.visit.patient.fullName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      const safeVisit = details.visit.visitNumber.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      return { blob, fileName: `${safePatient}-${safeVisit}-${details.reportType}-report.png` };
    } catch { setError("Image export failed. Check CORS settings, then retry."); return null; }
  }

  async function downloadReport() {
    setError("");
    const captured = await captureReportPng();
    if (!captured) return;
    const url = URL.createObjectURL(captured.blob);
    const a = document.createElement("a"); a.href = url; a.download = captured.fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    await fetch(`/api/reports/${details!.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "DOWNLOAD" }) });
    setMessage("Report downloaded.");
  }

  async function sendWhatsapp() {
    if (!details) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SEND_WHATSAPP" }) });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "WhatsApp handoff failed"); return; }
      const captured = await captureReportPng();
      const canShare = Boolean(captured) && typeof navigator?.share === "function" && typeof navigator?.canShare === "function";
      if (captured && canShare) {
        const file = new File([captured.blob], captured.fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: "Diagnostic Report", text: `Report for ${details.visit.patient.fullName}` }); setMessage("Shared. Choose WhatsApp if prompted."); return; }
          catch (err) { if (!(err instanceof DOMException && err.name === "AbortError")) setError("Share failed. Falling back to link."); else return; }
        }
      }
      if (json.data?.waUrl) { setMessage("WhatsApp opened."); window.open(json.data.waUrl, "_blank", "noopener,noreferrer"); }
      else setError("No WhatsApp destination returned.");
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
                <iframe title="Report preview" ref={previewRef} src={`/api/reports/${details.id}/preview`}
                  onLoad={() => setPreviewLoaded(true)} className="h-96 w-full rounded border border-slate-200" />
              </div>

              {/* MD Edit section */}
              {canMdEdit && (
                <div className="p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">MD Edits</p>
                  {details.department === "LABORATORY" ? (
                    <div className="space-y-2">
                      {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                        <div key={tIdx} className="rounded border border-slate-100 p-2">
                          <p className="text-xs font-medium text-slate-700 mb-2">{test?.name ?? `Test ${tIdx + 1}`}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(Array.isArray(test?.rows) ? test.rows : []).map((row: any, rIdx: number) => (
                              <label key={rIdx}>
                                <span className="block text-[11px] text-slate-400">{row?.name ?? `Field ${rIdx + 1}`}</span>
                                <input value={row?.value ?? ""} onChange={(e) => updateLabField(tIdx, rIdx, e.target.value)} className={inputCls} />
                              </label>
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
                    <label className={labelCls}>Edit reason *</label>
                    <textarea rows={1} value={editReason} onChange={(e) => setEditReason(e.target.value)} className={areaCls} />
                  </div>
                  <button disabled={busy || details.isReleased} onClick={saveMdEdits}
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Version History</p>
                <table className="w-full text-xs">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}