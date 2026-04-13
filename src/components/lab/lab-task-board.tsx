"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultInsightBox } from "@/components/results/result-insight-box";
import { buildResultInsights } from "@/lib/result-insights";
import { listOfflineLabDraftItems, removeOfflineLabDraft, upsertOfflineLabDraft } from "@/lib/offline-sync";
import { evaluateReferenceFlag, formatReferenceDisplay } from "@/lib/reference-ranges";
import { toCustomFieldKey } from "@/lib/custom-fields-core";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";
type SampleStatus = "PENDING" | "COLLECTED" | "RECEIVED" | "PROCESSING" | "DONE";

type ResultField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "NUMBER" | "TEXT" | "TEXTAREA" | "DROPDOWN" | "CHECKBOX";
  options?: string | null;
  unit?: string | null;
  normalMin?: number | null;
  normalMax?: number | null;
  normalText?: string | null;
  referenceNote?: string | null;
  isRequired: boolean;
};

type TestOrder = {
  id: string;
  status: string;
  test: { name: string; code: string; sampleType?: string | null; resultFields: ResultField[] };
  labResults: Array<{ id: string; resultData: Record<string, unknown>; notes?: string | null; isSubmitted: boolean; abnormalFlags?: Record<string, string> }>;
};

type LabTask = {
  id: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  visit: { visitNumber: string; patient: { fullName: string; patientId: string; age: number; sex: string } };
  sample?: { status: SampleStatus } | null;
  staff?: { id: string; fullName: string } | null;
  review?: { rejectionReason?: string | null; editedData?: unknown } | null;
  testOrders: TestOrder[];
};

type Draft = { values: Record<string, unknown>; notes: string };

function isSensitivityFieldKey(fieldKey: string) {
  return fieldKey.trim().toLowerCase() === "sensitivity";
}

const priorityStyle: Record<string, string> = {
  EMERGENCY: "bg-red-50 text-red-600",
  URGENT: "bg-amber-50 text-amber-700",
  ROUTINE: "bg-slate-100 text-slate-600",
};

const statusStyle: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
};

function getMinutesAgoLabel(dateText: string) {
  const deltaMs = Date.now() - new Date(dateText).getTime();
  const mins = Math.max(1, Math.floor(deltaMs / 60000));
  return `${mins} min${mins > 1 ? "s" : ""} ago`;
}

function getHighlightFields(task: LabTask) {
  if (!task.review?.editedData || typeof task.review.editedData !== "object") return [];
  const data = task.review.editedData as { highlightFields?: unknown };
  if (!Array.isArray(data.highlightFields)) return [];
  return data.highlightFields.filter((row): row is string => typeof row === "string");
}

type OrderResultCardProps = {
  task: LabTask;
  order: TestOrder;
  draft: Draft;
  highlightFields: string[];
  isReady: boolean;
  onPersist: (task: LabTask) => Promise<void>;
  onSetFieldValue: (testOrderId: string, fieldKey: string, value: unknown) => void;
  onSetNotes: (testOrderId: string, value: string) => void;
  onAddCustomField: (testOrderId: string, label: string, value: string) => void;
  onRemoveCustomField: (testOrderId: string, fieldKey: string) => void;
  onResetCustomFields: (testOrderId: string) => void;
};

const OrderResultCard = memo(function OrderResultCard({
  task,
  order,
  draft,
  highlightFields,
  isReady,
  onPersist,
  onSetFieldValue,
  onSetNotes,
  onAddCustomField,
  onRemoveCustomField,
  onResetCustomFields,
}: OrderResultCardProps) {
  const insightMessages = useMemo(() => buildResultInsights(draft.values ?? {}), [draft.values]);
  const highlightKey = useMemo(() => new Set(highlightFields), [highlightFields]);
  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState("");
  const defaultFieldKeys = useMemo(() => new Set(order.test.resultFields.map((field) => field.fieldKey)), [order.test.resultFields]);
  const customEntries = useMemo(
    () =>
      Object.entries(draft.values ?? {}).filter(([key]) => !defaultFieldKeys.has(key)),
    [defaultFieldKeys, draft.values]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">{order.test.name}</p>
          <p className="text-[11px] font-mono text-slate-400">{order.test.code}{order.test.sampleType ? ` - ${order.test.sampleType}` : ""}</p>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${isReady ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>
          {isReady ? "Ready" : "Incomplete"}
        </span>
      </div>

      <ResultInsightBox messages={insightMessages} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 mt-3">
        {order.test.resultFields.map((field) => {
          const value = draft.values?.[field.fieldKey];
          const label = `${field.label}${field.isRequired ? " *" : ""}${field.unit ? ` (${field.unit})` : ""}`;
          const highlight = highlightKey.has(field.fieldKey);
          const referenceText = formatReferenceDisplay(field);
          const flag = evaluateReferenceFlag(field, value);

          if (field.fieldType === "TEXTAREA") return (
            <div key={field.id} className="col-span-2 md:col-span-3 lg:col-span-4">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
              {referenceText ? <p className="mb-1 text-[10px] text-slate-400">{referenceText}</p> : null}
              <textarea
                rows={2}
                value={typeof value === "string" ? value : ""}
                onBlur={() => void onPersist(task).catch(() => undefined)}
                onChange={(e) => onSetFieldValue(order.id, field.fieldKey, e.target.value)}
                className={`w-full rounded border px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 ${highlight ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
              />
            </div>
          );

          if (field.fieldType === "DROPDOWN") {
            const options = (field.options ?? "").split(",").map((row) => row.trim()).filter(Boolean);
            return (
              <div key={field.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-medium text-slate-500">{label}</label>
                  {flag ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        flag === "NORMAL"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {flag}
                    </span>
                  ) : null}
                </div>
                {referenceText ? <p className="mb-1 text-[10px] text-slate-400">{referenceText}</p> : null}
                <select
                  value={typeof value === "string" ? value : ""}
                  onBlur={() => void onPersist(task).catch(() => undefined)}
                  onChange={(e) => onSetFieldValue(order.id, field.fieldKey, e.target.value)}
                  className={`w-full rounded border px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 ${highlight ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
                >
                  <option value="">Select...</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            );
          }

          if (field.fieldType === "CHECKBOX") return (
            <div key={field.id} className={`flex items-center gap-2 pt-4 rounded ${highlight ? "bg-amber-50 px-2" : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onBlur={() => void onPersist(task).catch(() => undefined)}
                onChange={(e) => onSetFieldValue(order.id, field.fieldKey, e.target.checked)}
                className="rounded border-slate-300"
              />
              <label className="text-[11px] font-medium text-slate-500">{field.label}</label>
            </div>
          );

          return (
            <div key={field.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-[11px] font-medium text-slate-500">{label}</label>
                {flag ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      flag === "NORMAL"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {flag}
                  </span>
                ) : null}
              </div>
              {referenceText ? <p className="mb-1 text-[10px] text-slate-400">{referenceText}</p> : null}
              <input
                type={field.fieldType === "NUMBER" ? "number" : "text"}
                value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                onBlur={() => void onPersist(task).catch(() => undefined)}
                onChange={(e) => onSetFieldValue(order.id, field.fieldKey, e.target.value)}
                className={`w-full rounded border px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 ${highlight ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          rows={1}
          value={draft.notes ?? ""}
          onBlur={() => void onPersist(task).catch(() => undefined)}
          onChange={(e) => onSetNotes(order.id, e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-3 rounded border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-medium text-slate-500">Extra Fields</p>
          <button
            type="button"
            onClick={() => onResetCustomFields(order.id)}
            className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            Reset Default
          </button>
        </div>
        <div className="space-y-2">
          {customEntries.length === 0 ? (
            <p className="text-[11px] text-slate-400">No extra fields added.</p>
          ) : (
            customEntries.map(([fieldKey, fieldValue]) => (
              <div key={fieldKey} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={fieldKey}
                  readOnly
                  className="col-span-4 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500"
                />
                <input
                  value={typeof fieldValue === "string" || typeof fieldValue === "number" ? String(fieldValue) : ""}
                  onBlur={() => void onPersist(task).catch(() => undefined)}
                  onChange={(e) => onSetFieldValue(order.id, fieldKey, e.target.value)}
                  className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Remove extra field '${fieldKey}'?`)) return;
                    onRemoveCustomField(order.id, fieldKey);
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
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Field name (e.g. colony_count)"
            className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Value"
            className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              if (!customLabel.trim()) return;
              const nextKey = toCustomFieldKey(customLabel);
              const hasDuplicate = customEntries.some(([key]) => key === nextKey);
              if (!nextKey) {
                setCustomError("Field name is invalid.");
                return;
              }
              if (hasDuplicate) {
                setCustomError(`Field '${nextKey}' already exists.`);
                return;
              }
              onAddCustomField(order.id, customLabel, customValue);
              setCustomLabel("");
              setCustomValue("");
              setCustomError("");
            }}
            className="col-span-2 rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
          >
            Add
          </button>
        </div>
        {customError ? <p className="mt-1 text-[11px] text-red-600">{customError}</p> : null}
      </div>
    </div>
  );
});

export function LabTaskBoard() {
  const TASK_CACHE_TTL_MS = 20_000;
  const [tasks, setTasks] = useState<LabTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sampleStatusByTask, setSampleStatusByTask] = useState<Record<string, SampleStatus>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const draftsRef = useRef<Record<string, Draft>>({});
  const tasksRef = useRef<LabTask[]>([]);
  const loadTasksSeqRef = useRef(0);
  const taskCacheRef = useRef<Map<string, { at: number; tasks: LabTask[] }>>(new Map());
  function invalidateTaskCache() {
    taskCacheRef.current.clear();
  }

  const applyLoadedRows = useCallback((rows: LabTask[]) => {
    setTasks(rows);

    setDrafts((prev) => {
      const next = { ...prev };
      for (const task of rows) {
        for (const order of task.testOrders) {
          if (!next[order.id]) {
            const existing = order.labResults[0];
            next[order.id] = {
              values: (existing?.resultData as Record<string, unknown>) ?? {},
              notes: existing?.notes ?? "",
            };
          }
        }
      }
      draftsRef.current = next;
      return next;
    });
    setSampleStatusByTask((prev) => {
      const next = { ...prev };
      for (const task of rows) {
        if (!next[task.id]) {
          next[task.id] = task.sample?.status ?? "PENDING";
        }
      }
      return next;
    });
  }, []);

  const loadTasks = useCallback(async (opts?: { signal?: AbortSignal; force?: boolean }) => {
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
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ status: statusFilter, sort });
      const res = await fetch(`/api/lab/tasks?${query.toString()}`, { signal: opts?.signal });
      const json = (await res.json()) as { success: boolean; error?: string; data?: { tasks: LabTask[] } };
      if (requestId !== loadTasksSeqRef.current || opts?.signal?.aborted) return;
      if (!json.success || !json.data) {
        setError(json.error ?? "Failed to load tasks");
        return;
      }
      const rows = json.data.tasks;
      taskCacheRef.current.set(cacheKey, { at: Date.now(), tasks: rows });
      applyLoadedRows(rows);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error while loading tasks");
    } finally {
      if (requestId !== loadTasksSeqRef.current || opts?.signal?.aborted) return;
      setLoading(false);
    }
  }, [TASK_CACHE_TTL_MS, applyLoadedRows, sort, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTasks({ signal: controller.signal });
    return () => controller.abort();
  }, [loadTasks]);

  useEffect(() => {
    const syncStatus = () => setIsOnline(navigator.onLine);
    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
    };
  }, []);

  const syncOfflineDrafts = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = listOfflineLabDraftItems();
    for (const item of pending) {
      try {
        const res = await fetch(`/api/lab/tasks/${item.taskId}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submit: false, results: item.results }),
        });
        const json = (await res.json()) as { success: boolean };
        if (json.success) removeOfflineLabDraft(item.id);
      } catch {
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    void syncOfflineDrafts();
  }, [isOnline, syncOfflineDrafts]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const filtered = useMemo(() => {
    const base = statusFilter === "ALL" ? tasks.filter((task) => task.status !== "COMPLETED") : tasks;
    return base.filter((task) => priorityFilter === "ALL" || task.priority === priorityFilter);
  }, [tasks, priorityFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      pending: filtered.filter((task) => task.status === "PENDING").length,
      inProgress: filtered.filter((task) => task.status === "IN_PROGRESS").length,
      completed: filtered.filter((task) => task.status === "COMPLETED").length,
    }),
    [filtered]
  );

  function getSampleStatus(task: LabTask): SampleStatus {
    return sampleStatusByTask[task.id] ?? task.sample?.status ?? "PENDING";
  }

  function getActionLabel(task: LabTask) {
    if (task.status === "COMPLETED") return "Submitted";
    if (task.status === "PENDING") return "Start Task";
    const sampleStatus = getSampleStatus(task);
    if (sampleStatus === "PENDING") return "Mark Sample Collected";
    if (sampleStatus === "COLLECTED" || sampleStatus === "RECEIVED") return "Start Processing";
    return "Submit Result";
  }

  function getNextStep(task: LabTask) {
    if (task.status === "PENDING") return "Next: Open case and begin task";
    const sampleStatus = getSampleStatus(task);
    if (sampleStatus === "PENDING") return "Next: Collect sample";
    if (sampleStatus === "COLLECTED" || sampleStatus === "RECEIVED") return "Next: Start processing";
    if (sampleStatus === "PROCESSING") return "Next: Enter test result";
    return "Next: Submit for MD review";
  }

  function isValueFilled(value: unknown) {
    if (typeof value === "boolean") return true;
    if (value === 0) return true;
    return value !== undefined && value !== null && `${value}`.trim() !== "";
  }

  function findTaskForOrder(testOrderId: string) {
    return tasksRef.current.find((task) => task.testOrders.some((order) => order.id === testOrderId));
  }

  function getSharedSensitivity(task: LabTask, draftsSnapshot: Record<string, Draft> = draftsRef.current) {
    for (const order of task.testOrders) {
      if (!order.test.resultFields.some((field) => isSensitivityFieldKey(field.fieldKey))) continue;
      const value = draftsSnapshot[order.id]?.values?.sensitivity;
      if (isValueFilled(value)) return value;
    }
    return undefined;
  }

  function isOrderReady(task: LabTask, order: TestOrder) {
    const draft = drafts[order.id] ?? { values: {}, notes: "" };
    const required = order.test.resultFields.filter((field) => field.isRequired);
    if (required.length === 0) {
      return Object.values(draft.values).some(isValueFilled) || draft.notes.trim().length > 0;
    }
    const sharedSensitivity = getSharedSensitivity(task);
    return required.every((field) => {
      const localValue = draft.values[field.fieldKey];
      if (isValueFilled(localValue)) return true;
      if (isSensitivityFieldKey(field.fieldKey)) return isValueFilled(sharedSensitivity);
      return false;
    });
  }

  function showResultForm(task: LabTask) {
    const sampleStatus = getSampleStatus(task);
    return sampleStatus === "PROCESSING" || sampleStatus === "DONE" || task.status === "COMPLETED";
  }

  function updateDraft(testOrderId: string, updater: (prev: Draft) => Draft) {
    setDrafts((prev) => {
      const current = prev[testOrderId] ?? { values: {}, notes: "" };
      const next = { ...prev, [testOrderId]: updater(current) };
      draftsRef.current = next;
      return next;
    });
  }

  const setDraftFieldValue = useCallback((testOrderId: string, fieldKey: string, value: unknown) => {
    const task = findTaskForOrder(testOrderId);
    const shouldSyncSensitivity = Boolean(task && isSensitivityFieldKey(fieldKey));
    const sensitivityOrderIds = shouldSyncSensitivity
      ? task!.testOrders
          .filter((order) => order.test.resultFields.some((field) => isSensitivityFieldKey(field.fieldKey)))
          .map((order) => order.id)
      : [];

    setDrafts((prev) => {
      const next = { ...prev };
      const targetOrderIds = sensitivityOrderIds.length > 0 ? sensitivityOrderIds : [testOrderId];
      for (const orderId of targetOrderIds) {
        const current = next[orderId] ?? { values: {}, notes: "" };
        next[orderId] = { ...current, values: { ...current.values, [fieldKey]: value } };
      }
      draftsRef.current = next;
      return next;
    });
  }, []);

  const setDraftNotesValue = useCallback((testOrderId: string, value: string) => {
    updateDraft(testOrderId, (prev) => ({ ...prev, notes: value }));
  }, []);

  const addCustomField = useCallback((testOrderId: string, label: string, value: string) => {
    const baseKey = toCustomFieldKey(label);
    if (!baseKey) return;
    updateDraft(testOrderId, (prev) => {
      const nextValues = { ...prev.values };
      if (Object.prototype.hasOwnProperty.call(nextValues, baseKey)) {
        return prev;
      }
      nextValues[baseKey] = value;
      return { ...prev, values: nextValues };
    });
  }, []);

  const removeCustomField = useCallback((testOrderId: string, fieldKey: string) => {
    updateDraft(testOrderId, (prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev.values, fieldKey)) return prev;
      const nextValues = { ...prev.values };
      delete nextValues[fieldKey];
      return { ...prev, values: nextValues };
    });
  }, []);

  const resetCustomFields = useCallback((testOrderId: string) => {
    const task = findTaskForOrder(testOrderId);
    const order = task?.testOrders.find((row) => row.id === testOrderId);
    if (!order) return;
    const defaultKeys = new Set(order.test.resultFields.map((field) => field.fieldKey));
    updateDraft(testOrderId, (prev) => {
      const nextValues = Object.fromEntries(
        Object.entries(prev.values).filter(([key]) => defaultKeys.has(key))
      );
      return { ...prev, values: nextValues };
    });
  }, []);

  function collectTaskDraftResults(task: LabTask, draftsSnapshot: Record<string, Draft> = draftsRef.current) {
    const sharedSensitivity = getSharedSensitivity(task, draftsSnapshot);
    return task.testOrders.map((order) => ({
      testOrderId: order.id,
      resultData:
        order.test.resultFields.some((field) => isSensitivityFieldKey(field.fieldKey)) &&
        isValueFilled(sharedSensitivity) &&
        !isValueFilled((draftsSnapshot[order.id]?.values ?? {}).sensitivity)
          ? { ...(draftsSnapshot[order.id]?.values ?? {}), sensitivity: sharedSensitivity }
          : draftsSnapshot[order.id]?.values ?? {},
      notes: draftsSnapshot[order.id]?.notes ?? "",
    }));
  }

  async function persistDraft(task: LabTask, draftsSnapshot: Record<string, Draft> = draftsRef.current) {
    const results = collectTaskDraftResults(task, draftsSnapshot);
    upsertOfflineLabDraft({ taskId: task.id, results });
    if (!navigator.onLine) return;

    const res = await fetch(`/api/lab/tasks/${task.id}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submit: false, results }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      throw new Error(json.error ?? "Auto-save failed");
    }
    const pending = listOfflineLabDraftItems().find((item) => item.taskId === task.id);
    if (pending) removeOfflineLabDraft(pending.id);
  }

  useEffect(() => {
    if (!expandedTask) return;
    const taskId = expandedTask;

    const timer = window.setInterval(() => {
      const task = tasksRef.current.find((row) => row.id === taskId);
      if (!task || !showResultForm(task) || task.status === "COMPLETED") return;
      void persistDraft(task, draftsRef.current).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [expandedTask]);

  async function onWorkflowClick(task: LabTask) {
    if (task.status === "COMPLETED") return;
    setSavingTaskId(task.id);
    setError("");
    invalidateTaskCache();
    try {
      if (task.status === "PENDING") {
        setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, status: "IN_PROGRESS" } : row)));
        const res = await fetch(`/api/lab/tasks/${task.id}/start`, { method: "PATCH" });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          setError(json.error ?? "Unable to start");
          await loadTasks();
        }
        return;
      }

      const sampleStatus = getSampleStatus(task);
      if (sampleStatus === "PENDING") {
        setSampleStatusByTask((prev) => ({ ...prev, [task.id]: "COLLECTED" }));
        const res = await fetch(`/api/lab/tasks/${task.id}/sample`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COLLECTED" }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          setError(json.error ?? "Error updating sample");
          await loadTasks();
        }
        return;
      }

      if (sampleStatus === "COLLECTED" || sampleStatus === "RECEIVED") {
        setSampleStatusByTask((prev) => ({ ...prev, [task.id]: "PROCESSING" }));
        const res = await fetch(`/api/lab/tasks/${task.id}/sample`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PROCESSING" }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          setError(json.error ?? "Error updating sample");
          await loadTasks();
        }
        return;
      }

      if (task.testOrders.some((order) => !isOrderReady(task, order))) {
        setError("Complete all required result fields before submitting.");
        return;
      }

      if (!navigator.onLine) {
        await persistDraft(task);
        setError("You are offline. Draft is saved locally and will sync automatically.");
        return;
      }

      setTasks((prev) => prev.filter((row) => row.id !== task.id));
      const res = await fetch(`/api/lab/tasks/${task.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true, results: collectTaskDraftResults(task) }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Submit failed");
        await loadTasks();
        return;
      }
      const pending = listOfflineLabDraftItems().find((item) => item.taskId === task.id);
      if (pending) removeOfflineLabDraft(pending.id);
      setExpandedTask(null);
    } catch {
      setError("Action failed. Please retry.");
      await loadTasks();
    } finally {
      setSavingTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[
          { label: "Pending", value: counts.pending },
          { label: "In Progress", value: counts.inProgress },
          { label: "Completed", value: counts.completed },
        ].map((item) => (
          <div key={item.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | TaskStatus)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Active queue</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "ALL" | Priority)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="ROUTINE">Routine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as "newest" | "oldest")}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <button onClick={() => void loadTasks({ force: true })} className="ml-auto rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
          Refresh
        </button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No assigned tests. You're all caught up.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Sample</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Updated</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((task) => {
                const highlightFields = getHighlightFields(task);
                return (
                  <Fragment key={task.id}>
                    <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${expandedTask === task.id ? "bg-blue-50/30" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{task.visit.patient.fullName}</p>
                        <p className="font-mono text-slate-400">{task.visit.patient.patientId} - {task.visit.patient.age}y - {task.visit.patient.sex}</p>
                        <p className="text-[11px] text-slate-400">Last updated {getMinutesAgoLabel(task.updatedAt)} by {task.staff?.fullName ?? "assigned staff"}</p>
                        <p className="text-[11px] text-blue-600">{getNextStep(task)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{task.testOrders.map((order) => order.test.name).join(", ")}</td>
                      <td className="px-4 py-2.5"><span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[task.priority]}`}>{task.priority}</span></td>
                      <td className="px-4 py-2.5"><span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[task.status]}`}>{task.status.replace("_", " ")}</span></td>
                      <td className="px-4 py-2.5 text-slate-500">{getSampleStatus(task)}</td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(task.updatedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {task.status !== "COMPLETED" ? (
                            <button
                              disabled={savingTaskId === task.id}
                              onClick={() => void onWorkflowClick(task)}
                              className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {savingTaskId === task.id ? "Working..." : getActionLabel(task)}
                            </button>
                          ) : null}
                          {showResultForm(task) ? (
                            <button
                              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              {expandedTask === task.id ? "Close" : "Enter Results"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    {expandedTask === task.id && showResultForm(task) ? (
                      <tr key={`${task.id}-form`}>
                        <td colSpan={7} className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="space-y-4">
                            {task.review?.rejectionReason ? (
                              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                Edit requested by MD: {task.review.rejectionReason}
                              </div>
                            ) : null}
                            {task.testOrders.map((order) => (
                              <OrderResultCard
                                key={order.id}
                                task={task}
                                order={order}
                                draft={drafts[order.id] ?? { values: {}, notes: "" }}
                                highlightFields={highlightFields}
                                isReady={isOrderReady(task, order)}
                                onPersist={persistDraft}
                                onSetFieldValue={setDraftFieldValue}
                                onSetNotes={setDraftNotesValue}
                                onAddCustomField={addCustomField}
                                onRemoveCustomField={removeCustomField}
                                onResetCustomFields={resetCustomFields}
                              />
                            ))}

                            {task.status !== "COMPLETED" ? (
                              <button
                                disabled={savingTaskId === task.id}
                                onClick={() => void onWorkflowClick(task)}
                                className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {savingTaskId === task.id ? "Submitting..." : "Submit Result"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
