"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type ReportType = "lab" | "radiology";
type Department = "LABORATORY" | "RADIOLOGY";
type ReportStatus = "DRAFT" | "RELEASED";

type ReportListItem = {
  id: string;
  reportType: ReportType;
  department: Department;
  status: ReportStatus;
  isReleased: boolean;
  releasedAt?: string | null;
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
};

type ReportDetails = ReportListItem & {
  comments?: string | null;
  prescription?: string | null;
  releaseInstructions?: string | null;
  versions: Array<{
    id: string;
    version: number;
    isActive: boolean;
    content: any;
    comments?: string | null;
    prescription?: string | null;
    editReason: string;
    createdAt: string;
    editedBy: { id: string; fullName: string };
  }>;
};

type Props = {
  role: "MD" | "HRM" | "SUPER_ADMIN";
};

function reportLabel(reportType: ReportType) {
  return reportType === "lab" ? "Lab Report" : "Radiology Report";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function ReportWorkspace({ role }: Props) {
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

  const canMdEdit = role === "MD" || role === "SUPER_ADMIN";
  const canHrmRelease = role === "HRM" || role === "SUPER_ADMIN";

  const activeVersion = useMemo(() => {
    if (!details) return null;
    return details.versions.find((v) => v.isActive) ?? details.versions[0] ?? null;
  }, [details]);

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        status: filterStatus,
        reportType: filterType,
      });
      const res = await fetch(`/api/reports?${query.toString()}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load reports");
        return;
      }
      const items = json.data as ReportListItem[];
      setRows(items);
      if (items.length === 0) {
        setSelectedId("");
        setDetails(null);
        return;
      }
      const nextId = selectedId && items.some((r) => r.id === selectedId) ? selectedId : items[0].id;
      setSelectedId(nextId);
    } catch {
      setError("Network error while loading reports");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(reportId: string) {
    setError("");
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load report details");
        return;
      }
      const data = json.data as ReportDetails;
      setDetails(data);
      const currentVersion = data.versions.find((v) => v.isActive) ?? data.versions[0];
      setEditableContent(clone(currentVersion?.content ?? {}));
      setEditComments(currentVersion?.comments ?? data.comments ?? "");
      setEditPrescription(currentVersion?.prescription ?? data.prescription ?? "");
      setReceptionInstruction(data.releaseInstructions ?? "");
    } catch {
      setError("Network error while loading report details");
    }
  }

  useEffect(() => {
    void loadReports();
  }, [filterStatus, filterType]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetails(selectedId);
  }, [selectedId]);

  function updateLabField(testIndex: number, rowIndex: number, value: string) {
    setEditableContent((prev: any) => {
      const next = clone(prev);
      if (!Array.isArray(next?.tests)) return prev;
      if (!Array.isArray(next.tests[testIndex]?.rows)) return prev;
      next.tests[testIndex].rows[rowIndex].value = value;
      return next;
    });
  }

  function updateRadField(testIndex: number, key: "findings" | "impression" | "notes", value: string) {
    setEditableContent((prev: any) => {
      const next = clone(prev);
      if (!Array.isArray(next?.tests)) return prev;
      next.tests[testIndex][key] = value;
      return next;
    });
  }

  async function saveMdEdits() {
    if (!details) return;
    if (!editReason.trim()) {
      setError("Edit reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportContent: editableContent,
          comments: editComments || null,
          prescription: editPrescription || null,
          reason: editReason.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to save MD edits");
        return;
      }
      setMessage("Draft updated successfully.");
      setEditReason("");
      await loadDetails(details.id);
      await loadReports();
    } finally {
      setBusy(false);
    }
  }

  async function releaseReport() {
    if (!details) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/release`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: releaseMethod,
          instructions: receptionInstruction || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Release failed");
        return;
      }
      setMessage("Report released.");
      await loadDetails(details.id);
      await loadReports();
    } finally {
      setBusy(false);
    }
  }

  async function trackAction(action: "PRINT" | "DOWNLOAD") {
    if (!details) return;
    await fetch(`/api/reports/${details.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }

  async function printReport() {
    if (!details) return;
    await trackAction("PRINT");
    window.open(`/api/reports/${details.id}/preview`, "_blank", "noopener,noreferrer");
  }

  async function downloadReport() {
    if (!details) return;
    setError("");
    const res = await fetch(`/api/reports/${details.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DOWNLOAD" }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    if (!json.success) {
      setError(json.error ?? "Download tracking failed");
      return;
    }
    window.open(`/api/reports/${details.id}/preview`, "_blank", "noopener,noreferrer");
  }

  async function sendWhatsapp() {
    if (!details) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/reports/${details.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_WHATSAPP" }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "WhatsApp handoff failed");
        return;
      }
      setMessage("WhatsApp handoff opened.");
      if (json.data?.waUrl) {
        window.open(json.data.waUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "ALL" | ReportType)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All report types</option>
          <option value="lab">Lab reports</option>
          <option value="radiology">Radiology reports</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "ALL" | ReportStatus)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RELEASED">Released</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">Reports</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports found.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    row.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{row.visit.patient.fullName}</p>
                    <Badge variant={row.isReleased ? "success" : "warning"}>{row.isReleased ? "Released" : "Draft"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reportLabel(row.reportType)} - {row.visit.visitNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated: {formatDateTime(row.updatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          {!details ? (
            <p className="text-sm text-muted-foreground">Select a report to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{reportLabel(details.reportType)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {details.visit.patient.fullName} ({details.visit.patient.patientId}) - {details.visit.visitNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{details.department}</Badge>
                  <Badge variant={details.isReleased ? "success" : "warning"}>{details.status}</Badge>
                </div>
              </div>

              <iframe
                title="Report preview"
                src={`/api/reports/${details.id}/preview`}
                className="h-[420px] w-full rounded-md border"
              />

              {canMdEdit ? (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="font-medium">MD Edit Draft</p>

                  {details.department === "LABORATORY" ? (
                    <div className="space-y-3">
                      {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                        <div key={tIdx} className="rounded-md border p-2">
                          <p className="mb-2 text-sm font-medium">{test?.name ?? `Test ${tIdx + 1}`}</p>
                          {(Array.isArray(test?.rows) ? test.rows : []).map((row: any, rIdx: number) => (
                            <label key={rIdx} className="mb-2 block text-xs">
                              <span className="mb-1 block text-muted-foreground">{row?.name ?? `Field ${rIdx + 1}`}</span>
                              <input
                                value={row?.value ?? ""}
                                onChange={(e) => updateLabField(tIdx, rIdx, e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              />
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(editableContent?.tests) ? editableContent.tests : []).map((test: any, tIdx: number) => (
                        <div key={tIdx} className="rounded-md border p-2 space-y-2">
                          <p className="text-sm font-medium">{test?.name ?? `Report ${tIdx + 1}`}</p>
                          <label className="block text-xs">
                            <span className="mb-1 block text-muted-foreground">Findings</span>
                            <textarea
                              rows={2}
                              value={test?.findings ?? ""}
                              onChange={(e) => updateRadField(tIdx, "findings", e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 block text-muted-foreground">Impression</span>
                            <textarea
                              rows={2}
                              value={test?.impression ?? ""}
                              onChange={(e) => updateRadField(tIdx, "impression", e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 block text-muted-foreground">Notes</span>
                            <input
                              value={test?.notes ?? ""}
                              onChange={(e) => updateRadField(tIdx, "notes", e.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="block text-sm">
                    <span className="mb-1 block">Comments (optional)</span>
                    <textarea
                      rows={2}
                      value={editComments}
                      onChange={(e) => setEditComments(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block">Prescription (optional)</span>
                    <textarea
                      rows={2}
                      value={editPrescription}
                      onChange={(e) => setEditPrescription(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block">Edit reason (required)</span>
                    <textarea
                      rows={2}
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <Button disabled={busy || details.isReleased} onClick={saveMdEdits}>
                    {busy ? "Saving..." : "Save MD Edits"}
                  </Button>
                </div>
              ) : null}

              {canHrmRelease ? (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="font-medium">HRM Release Controls</p>
                  <label className="block text-sm">
                    <span className="mb-1 block">Instruction for receptionist (optional)</span>
                    <textarea
                      rows={2}
                      value={receptionInstruction}
                      onChange={(e) => setReceptionInstruction(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block">Release method</span>
                    <select
                      value={releaseMethod}
                      onChange={(e) => setReleaseMethod(e.target.value as "PRINT" | "DOWNLOAD" | "WHATSAPP")}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="PRINT">Print</option>
                      <option value="DOWNLOAD">Download</option>
                      <option value="WHATSAPP">WhatsApp</option>
                    </select>
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Button variant="outline" disabled={busy} onClick={printReport}>
                      Print Preview
                    </Button>
                    <Button variant="outline" disabled={busy || !details.isReleased} onClick={downloadReport}>
                      Download
                    </Button>
                    <Button variant="outline" disabled={busy || !details.isReleased} onClick={sendWhatsapp}>
                      Send WhatsApp
                    </Button>
                    <Button disabled={busy || details.isReleased} onClick={releaseReport}>
                      {details.isReleased ? "Already Released" : "Release Report"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">Version History</p>
                <div className="space-y-2">
                  {details.versions.map((v) => (
                    <div key={v.id} className="rounded border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">
                          v{v.version} by {v.editedBy.fullName} {v.isActive ? "(Active)" : ""}
                        </p>
                        <p className="text-muted-foreground">{formatDateTime(v.createdAt)}</p>
                      </div>
                      <p className="text-muted-foreground">Reason: {v.editReason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
