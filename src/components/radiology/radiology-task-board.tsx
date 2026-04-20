"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { formatDateTime } from "@/lib/utils";
import { toCustomFieldKey } from "@/lib/custom-fields-core";
import { SIGNOFF_IMAGE_KEY, SIGNOFF_NAME_KEY } from "@/lib/report-signoff";
import {
  listOfflineRadiologyDraftItems,
  removeOfflineRadiologyDraft,
  upsertOfflineRadiologyDraft,
} from "@/lib/offline-sync";
import {
  SignaturePreset,
  loadSignaturePresets,
  removeSignaturePreset,
  saveSignaturePresets,
  upsertSignaturePreset,
} from "@/lib/signature-presets";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";
type Report = {
  findings: string;
  impression: string;
  notes?: string | null;
  extraFields?: Record<string, string> | null;
  isSubmitted: boolean;
};
type Task = { id: string; status: TaskStatus; priority: Priority; createdAt: string; updatedAt: string; visit: { visitNumber: string; patient: { fullName: string; patientId: string; age: number; sex: string } }; radiologyReport: Report | null };
type Draft = {
  findings: string;
  impression: string;
  notes: string;
  extraFields: Record<string, string>;
  signatureName: string;
  signatureImage: string;
};

const EMPTY_DRAFT: Draft = {
  findings: "",
  impression: "",
  notes: "",
  extraFields: {},
  signatureName: "",
  signatureImage: "",
};

const priorityStyle: Record<string, string> = {
  EMERGENCY: "bg-red-50 text-red-600", URGENT: "bg-amber-50 text-amber-700", ROUTINE: "bg-slate-100 text-slate-600",
};
const statusStyle: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-blue-50 text-blue-700", COMPLETED: "bg-green-50 text-green-700", CANCELLED: "bg-red-50 text-red-600",
};

export function RadiologyTaskBoard() {
  const TASK_CACHE_TTL_MS = 20_000;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newExtraFieldLabel, setNewExtraFieldLabel] = useState<Record<string, string>>({});
  const [newExtraFieldValue, setNewExtraFieldValue] = useState<Record<string, string>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [signatureLibrary, setSignatureLibrary] = useState<SignaturePreset[]>([]);
  const [selectedSignatureByTask, setSelectedSignatureByTask] = useState<Record<string, string>>({});
  const signatureInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const loadTasksSeqRef = useRef(0);
  const taskCacheRef = useRef<Map<string, { at: number; tasks: Task[] }>>(new Map());
  const draftsRef = useRef<Record<string, Draft>>({});
  const tasksRef = useRef<Task[]>([]);
  function invalidateTaskCache() {
    taskCacheRef.current.clear();
  }

  function patchTask(taskId: string, patch: Partial<Task>) {
    setTasks((prev) => {
      const next = prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task));
      taskCacheRef.current.forEach((cached, key) => {
        taskCacheRef.current.set(key, {
          ...cached,
          tasks: cached.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
        });
      });
      return next;
    });
  }

  function applyLoadedRows(rows: Task[]) {
    setTasks(rows);
    tasksRef.current = rows;
    const offlineByTask = new Map(listOfflineRadiologyDraftItems().map((item) => [item.taskId, item]));
    const nextDrafts: Record<string, Draft> = {};
    for (const task of rows) {
      const offline = offlineByTask.get(task.id)?.draft;
      nextDrafts[task.id] = {
        findings: offline?.findings ?? task.radiologyReport?.findings ?? "",
        impression: offline?.impression ?? task.radiologyReport?.impression ?? "",
        notes: offline?.notes ?? task.radiologyReport?.notes ?? "",
        extraFields: offline?.extraFields ?? task.radiologyReport?.extraFields ?? {},
        signatureName:
          offline?.signatureName ?? task.radiologyReport?.extraFields?.[SIGNOFF_NAME_KEY] ?? "",
        signatureImage:
          offline?.signatureImage ?? task.radiologyReport?.extraFields?.[SIGNOFF_IMAGE_KEY] ?? "",
      };
    }
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
  }

  async function loadTasks(opts?: { signal?: AbortSignal; force?: boolean }) {
    const cacheKey = `${statusFilter}:${sort}`;
    if (!opts?.force) {
      const cached = taskCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.at < TASK_CACHE_TTL_MS) {
        setError("");
        setLoading(false);
        applyLoadedRows(cached.tasks);
        return;
      }
    }

    const requestId = ++loadTasksSeqRef.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/radiology/tasks?${new URLSearchParams({ status: statusFilter, sort })}`, { signal: opts?.signal });
      const json = await res.json();
      if (requestId !== loadTasksSeqRef.current || opts?.signal?.aborted) return;
      if (!json.success) { setError(json.error ?? "Failed to load tasks"); return; }
      const rows = json.data.tasks as Task[];
      taskCacheRef.current.set(cacheKey, { at: Date.now(), tasks: rows });
      applyLoadedRows(rows);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error while loading radiology tasks");
    } finally {
      if (requestId !== loadTasksSeqRef.current || opts?.signal?.aborted) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadTasks({ signal: controller.signal });
    return () => controller.abort();
  }, [statusFilter, sort]);

  useEffect(() => {
    const refreshNow = () => {
      if (document.visibilityState !== "visible") return;
      void loadTasks({ force: true });
    };

    const poll = window.setInterval(refreshNow, 12_000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);

    const stream = new EventSource("/api/notifications/stream");
    stream.addEventListener("notification", refreshNow);
    stream.onerror = () => {
      stream.close();
    };

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
      stream.close();
    };
  }, [loadTasks]);

  useEffect(() => {
    setSignatureLibrary(loadSignaturePresets("reporting"));
  }, []);

  const filtered = useMemo(() => tasks.filter((t) => priorityFilter === "ALL" || t.priority === priorityFilter), [tasks, priorityFilter]);
  const counts = useMemo(() => ({ pending: filtered.filter((t) => t.status === "PENDING").length, inProgress: filtered.filter((t) => t.status === "IN_PROGRESS").length, completed: filtered.filter((t) => t.status === "COMPLETED").length }), [filtered]);

  function updateDraft(taskId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? EMPTY_DRAFT),
        ...patch,
      },
    }));
  }
  function reportReady(taskId: string) {
    const d = drafts[taskId];
    return Boolean(d?.findings?.trim()) && Boolean(d?.impression?.trim());
  }

  function setExtraFieldValue(taskId: string, fieldKey: string, value: string) {
    const current = drafts[taskId] ?? EMPTY_DRAFT;
    updateDraft(taskId, { extraFields: { ...current.extraFields, [fieldKey]: value } });
  }

  function removeExtraField(taskId: string, fieldKey: string) {
    const current = drafts[taskId] ?? EMPTY_DRAFT;
    if (!Object.prototype.hasOwnProperty.call(current.extraFields, fieldKey)) return;
    const next = { ...current.extraFields };
    delete next[fieldKey];
    updateDraft(taskId, { extraFields: next });
  }

  function addExtraField(taskId: string, label: string, value: string) {
    const baseKey = toCustomFieldKey(label);
    if (!baseKey) return;
    const current = drafts[taskId] ?? EMPTY_DRAFT;
    if (Object.prototype.hasOwnProperty.call(current.extraFields, baseKey)) {
      setError(`Field '${baseKey}' already exists.`);
      return;
    }
    updateDraft(taskId, { extraFields: { ...current.extraFields, [baseKey]: value } });
    setError("");
  }

  function resetExtraFields(taskId: string) {
    updateDraft(taskId, { extraFields: {} });
  }

  function applySignaturePreset(taskId: string, presetId: string) {
    const preset = signatureLibrary.find((item) => item.id === presetId);
    if (!preset) return;
    updateDraft(taskId, { signatureName: preset.name, signatureImage: preset.image });
    setSelectedSignatureByTask((prev) => ({ ...prev, [taskId]: presetId }));
  }

  function saveCurrentSignatureToLibrary(taskId: string) {
    const draft = drafts[taskId];
    if (!draft?.signatureName?.trim() || !draft?.signatureImage?.trim()) return;
    const res = upsertSignaturePreset(signatureLibrary, {
      name: draft.signatureName,
      image: draft.signatureImage,
    });
    if (!res.id) return;
    setSignatureLibrary(res.items);
    saveSignaturePresets("reporting", res.items);
    setSelectedSignatureByTask((prev) => ({ ...prev, [taskId]: res.id as string }));
  }

  function deleteSignaturePreset(presetId: string) {
    const next = removeSignaturePreset(signatureLibrary, presetId);
    setSignatureLibrary(next);
    saveSignaturePresets("reporting", next);
    setSelectedSignatureByTask((prev) =>
      Object.fromEntries(Object.entries(prev).map(([taskId, selectedId]) => [taskId, selectedId === presetId ? "" : selectedId]))
    );
  }

  async function startTask(taskId: string) {
    setBusyTaskId(taskId); setError("");
    invalidateTaskCache();
    try {
      const json = await (await fetch(`/api/radiology/tasks/${taskId}/start`, { method: "PATCH" })).json();
      if (!json.success) { setError(json.error ?? "Unable to start task"); return; }
      patchTask(taskId, { status: "IN_PROGRESS" });
    } finally { setBusyTaskId(null); }
  }

  async function saveReport(taskId: string) {
    setBusyTaskId(taskId); setError("");
    invalidateTaskCache();
    try {
    const d = drafts[taskId] ?? EMPTY_DRAFT;
    const json = await (await fetch(`/api/radiology/tasks/${taskId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })).json();
      if (!json.success) { setError(json.error ?? "Unable to save report"); return; }
      const pending = listOfflineRadiologyDraftItems().find((item) => item.taskId === taskId);
      if (pending) removeOfflineRadiologyDraft(pending.id);
      patchTask(taskId, {
        radiologyReport: {
          findings: d.findings,
          impression: d.impression,
          notes: d.notes,
          extraFields: d.extraFields,
          ...(d.signatureName && d.signatureImage
            ? {
                extraFields: {
                  ...d.extraFields,
                  [SIGNOFF_NAME_KEY]: d.signatureName,
                  [SIGNOFF_IMAGE_KEY]: d.signatureImage,
                },
              }
            : {}),
          isSubmitted: false,
        },
      });
    } finally { setBusyTaskId(null); }
  }

  async function submitTask(taskId: string) {
    setBusyTaskId(taskId); setError("");
    invalidateTaskCache();
    try {
      const d = drafts[taskId] ?? EMPTY_DRAFT;
      if (!d.findings.trim() || !d.impression.trim()) { setError("Findings and impression are required before submission."); return; }
      await fetch(`/api/radiology/tasks/${taskId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const json = await (await fetch(`/api/radiology/tasks/${taskId}/submit`, { method: "PATCH", headers: { "Content-Type": "application/json" } })).json();
      if (!json.success) { setError(json.error ?? "Unable to submit report"); return; }
      const pending = listOfflineRadiologyDraftItems().find((item) => item.taskId === taskId);
      if (pending) removeOfflineRadiologyDraft(pending.id);
      setExpandedTask(null);
      patchTask(taskId, { status: "COMPLETED" });
    } finally { setBusyTaskId(null); }
  }

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!expandedTask) return;
    const task = tasksRef.current.find((row) => row.id === expandedTask);
    if (!task || task.status === "COMPLETED") return;
    const timer = window.setTimeout(() => {
      const draft = draftsRef.current[task.id] ?? EMPTY_DRAFT;
      upsertOfflineRadiologyDraft({
        taskId: task.id,
        draft: {
          findings: draft.findings,
          impression: draft.impression,
          notes: draft.notes,
          extraFields: draft.extraFields ?? {},
          signatureName: draft.signatureName ?? "",
          signatureImage: draft.signatureImage ?? "",
        },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [drafts, expandedTask]);

  useEffect(() => {
    if (!expandedTask) return;
    const taskId = expandedTask;
    const timer = window.setInterval(() => {
      const task = tasksRef.current.find((row) => row.id === taskId);
      if (!task || task.status === "COMPLETED") return;
      const draft = draftsRef.current[task.id] ?? EMPTY_DRAFT;
      upsertOfflineRadiologyDraft({
        taskId: task.id,
        draft: {
          findings: draft.findings,
          impression: draft.impression,
          notes: draft.notes,
          extraFields: draft.extraFields ?? {},
          signatureName: draft.signatureName ?? "",
          signatureImage: draft.signatureImage ?? "",
        },
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [expandedTask]);

  async function uploadSignature(taskId: string, file: File) {
    const readAsDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("SIGNATURE_READ_FAILED"));
      reader.readAsDataURL(file);
    });
    updateDraft(taskId, { signatureImage: readAsDataUrl });
  }

  if (loading) return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">Loading radiology tasks...</div>
  );

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[{ label: "Pending", value: counts.pending }, { label: "In Progress", value: counts.inProgress }, { label: "Completed", value: counts.completed }].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="ROUTINE">Routine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <button onClick={() => void loadTasks({ force: true })} className="ml-auto rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Refresh</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {/* Tasks table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No radiology tasks found.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Report</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Assigned</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((task) => {
                const isExpanded = expandedTask === task.id;
                return (
                  <>
                    <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${isExpanded ? "bg-blue-50/20" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{task.visit.patient.fullName}</p>
                        <p className="font-mono text-slate-400">{task.visit.patient.patientId} · {task.visit.patient.age}y · {task.visit.patient.sex}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[task.priority]}`}>{task.priority}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[task.status]}`}>{task.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{task.radiologyReport?.findings?.trim() ? "Drafted" : "Pending"}</td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(task.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {task.status === "PENDING" && (
                            <button disabled={busyTaskId === task.id} onClick={() => startTask(task.id)}
                              className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              Start
                            </button>
                          )}
                          {task.status !== "COMPLETED" && task.status !== "PENDING" && (
                            <button onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors">
                              {isExpanded ? "Close" : "Open Report"}
                            </button>
                          )}
                          {task.status === "COMPLETED" && <span className="text-green-600 font-medium">✓ Submitted</span>}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && task.status !== "COMPLETED" && (
                      <tr key={`${task.id}-expand`}>
                        <td colSpan={6} className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="space-y-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Radiology Report</p>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Findings *</label>
                                <textarea rows={3} value={drafts[task.id]?.findings ?? ""} onChange={(e) => updateDraft(task.id, { findings: e.target.value })}
                                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Impression *</label>
                                <textarea rows={3} value={drafts[task.id]?.impression ?? ""} onChange={(e) => updateDraft(task.id, { impression: e.target.value })}
                                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes (optional)</label>
                                <input value={drafts[task.id]?.notes ?? ""} onChange={(e) => updateDraft(task.id, { notes: e.target.value })}
                                  className="h-7 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div className="rounded border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-medium text-slate-500 mb-2">Extra Fields</p>
                                <div className="space-y-2">
                                  {Object.entries(
                                    Object.fromEntries(
                                      Object.entries(drafts[task.id]?.extraFields ?? {}).filter(
                                        ([key]) => key !== SIGNOFF_IMAGE_KEY && key !== SIGNOFF_NAME_KEY
                                      )
                                    )
                                  ).length === 0 ? (
                                    <p className="text-[11px] text-slate-400">No extra fields added.</p>
                                  ) : (
                                    Object.entries(
                                      Object.fromEntries(
                                        Object.entries(drafts[task.id]?.extraFields ?? {}).filter(
                                          ([key]) => key !== SIGNOFF_IMAGE_KEY && key !== SIGNOFF_NAME_KEY
                                        )
                                      )
                                    ).map(([fieldKey, fieldValue]) => (
                                      <div key={fieldKey} className="grid grid-cols-12 gap-2 items-center">
                                        <input
                                          value={fieldKey}
                                          readOnly
                                          className="col-span-4 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500"
                                        />
                                        <input
                                          value={fieldValue}
                                          onChange={(e) => setExtraFieldValue(task.id, fieldKey, e.target.value)}
                                          className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!window.confirm(`Remove extra field '${fieldKey}'?`)) return;
                                            removeExtraField(task.id, fieldKey);
                                          }}
                                          className="col-span-2 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="mt-2 grid grid-cols-12 gap-2">
                                  <input
                                    value={newExtraFieldLabel[task.id] ?? ""}
                                    onChange={(e) => setNewExtraFieldLabel((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Field name"
                                    className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <input
                                    value={newExtraFieldValue[task.id] ?? ""}
                                    onChange={(e) => setNewExtraFieldValue((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Value"
                                    className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const label = newExtraFieldLabel[task.id] ?? "";
                                      const value = newExtraFieldValue[task.id] ?? "";
                                      if (!label.trim()) return;
                                      addExtraField(task.id, label, value);
                                      setNewExtraFieldLabel((prev) => ({ ...prev, [task.id]: "" }));
                                      setNewExtraFieldValue((prev) => ({ ...prev, [task.id]: "" }));
                                    }}
                                    className="col-span-2 rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                                  >
                                    Add
                                  </button>
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => resetExtraFields(task.id)}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                                  >
                                    Reset Default
                                  </button>
                                </div>
                              </div>
                              <div className="rounded border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-medium text-slate-500 mb-2">Signature (for printed report)</p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={selectedSignatureByTask[task.id] ?? ""}
                                      onChange={(e) => {
                                        const presetId = e.target.value;
                                        setSelectedSignatureByTask((prev) => ({ ...prev, [task.id]: presetId }));
                                        if (presetId) applySignaturePreset(task.id, presetId);
                                      }}
                                      className="h-7 flex-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      <option value="">Choose saved signature...</option>
                                      {signatureLibrary.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                          {preset.name}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedSignatureByTask[task.id] ? (
                                      <button
                                        type="button"
                                        onClick={() => deleteSignaturePreset(selectedSignatureByTask[task.id])}
                                        className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        Delete Saved
                                      </button>
                                    ) : null}
                                  </div>
                                  <input
                                    value={drafts[task.id]?.signatureName ?? ""}
                                    onChange={(e) => updateDraft(task.id, { signatureName: e.target.value })}
                                    placeholder="Signer name"
                                    className="h-7 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      ref={(el) => {
                                        signatureInputRefs.current[task.id] = el;
                                      }}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        await uploadSignature(task.id, file);
                                        e.target.value = "";
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => signatureInputRefs.current[task.id]?.click()}
                                      className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                      Upload Signature
                                    </button>
                                    {drafts[task.id]?.signatureImage ? (
                                      <button
                                        type="button"
                                        onClick={() => updateDraft(task.id, { signatureImage: "" })}
                                        className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => saveCurrentSignatureToLibrary(task.id)}
                                      className="rounded border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 transition-colors"
                                    >
                                      Save Signature
                                    </button>
                                  </div>
                                  {drafts[task.id]?.signatureImage ? (
                                    <img
                                      src={drafts[task.id].signatureImage}
                                      alt="Signature preview"
                                      className="h-16 w-auto max-w-[220px] object-contain border border-slate-200 rounded bg-white p-1"
                                    />
                                  ) : (
                                    <p className="text-[11px] text-slate-400">No signature image selected.</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button disabled={busyTaskId === task.id} onClick={() => saveReport(task.id)}
                                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                                  Save Draft
                                </button>
                                <button disabled={busyTaskId === task.id || !reportReady(task.id)} onClick={() => submitTask(task.id)}
                                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                  {busyTaskId === task.id ? "Submitting..." : "Submit Report"}
                                </button>
                              </div>
                              {!reportReady(task.id) && (
                                <p className="text-[11px] text-slate-400">Findings and impression required before submission.</p>
                              )}
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

