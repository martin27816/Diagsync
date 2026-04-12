"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { formatDateTime } from "@/lib/utils";

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
  isRequired: boolean;
};

type TestOrder = {
  id: string;
  status: string;
  test: { name: string; code: string; sampleType?: string | null; resultFields: ResultField[] };
  labResults: Array<{ id: string; resultData: Record<string, any>; notes?: string | null; isSubmitted: boolean }>;
};

type LabTask = {
  id: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
  visit: { visitNumber: string; patient: { fullName: string; patientId: string; age: number; sex: string } };
  sample?: { status: SampleStatus } | null;
  testOrders: TestOrder[];
};

type Draft = { values: Record<string, any>; notes: string };

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

export function LabTaskBoard() {
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

  async function loadTasks() {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ status: statusFilter, sort });
      const res = await fetch(`/api/lab/tasks?${query.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to load tasks"); return; }
      const rows = json.data.tasks as LabTask[];
      setTasks(rows);
      const nextDrafts: Record<string, Draft> = {};
      const nextSample: Record<string, SampleStatus> = {};
      for (const task of rows) {
        nextSample[task.id] = task.sample?.status ?? "PENDING";
        for (const order of task.testOrders) {
          const existing = order.labResults[0];
          nextDrafts[order.id] = { values: (existing?.resultData as Record<string, any>) ?? {}, notes: existing?.notes ?? "" };
        }
      }
      setDrafts(nextDrafts);
      setSampleStatusByTask(nextSample);
    } catch { setError("Network error while loading tasks"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadTasks(); }, [statusFilter, sort]);

  const filtered = useMemo(
    () => tasks.filter((t) => priorityFilter === "ALL" || t.priority === priorityFilter),
    [tasks, priorityFilter]
  );

  const counts = useMemo(() => ({
    pending: filtered.filter((t) => t.status === "PENDING").length,
    inProgress: filtered.filter((t) => t.status === "IN_PROGRESS").length,
    completed: filtered.filter((t) => t.status === "COMPLETED").length,
  }), [filtered]);

  function getSampleStatus(task: LabTask): SampleStatus {
    return sampleStatusByTask[task.id] ?? task.sample?.status ?? "PENDING";
  }

  function getActionLabel(task: LabTask) {
    if (task.status === "COMPLETED") return "Submitted";
    if (task.status === "PENDING") return "Start Task";
    const ss = getSampleStatus(task);
    if (ss === "PENDING") return "Mark Sample Collected";
    if (ss === "COLLECTED" || ss === "RECEIVED") return "Start Processing";
    return "Submit Result";
  }

  function isValueFilled(value: any) {
    if (typeof value === "boolean") return true;
    if (value === 0) return true;
    return value !== undefined && value !== null && `${value}`.trim() !== "";
  }

  function isOrderReady(order: TestOrder) {
    const draft = drafts[order.id] ?? { values: {}, notes: "" };
    const required = order.test.resultFields.filter((f) => f.isRequired);
    if (required.length === 0) return Object.values(draft.values).some(isValueFilled) || draft.notes.trim().length > 0;
    return required.every((f) => isValueFilled(draft.values[f.fieldKey]));
  }

  function showResultForm(task: LabTask) {
    const ss = getSampleStatus(task);
    return ss === "PROCESSING" || ss === "DONE" || task.status === "COMPLETED";
  }

  function updateDraft(testOrderId: string, updater: (prev: Draft) => Draft) {
    setDrafts((prev) => {
      const current = prev[testOrderId] ?? { values: {}, notes: "" };
      return { ...prev, [testOrderId]: updater(current) };
    });
  }

  async function onWorkflowClick(task: LabTask) {
    if (task.status === "COMPLETED") return;
    setSavingTaskId(task.id); setError("");
    try {
      if (task.status === "PENDING") {
        const json = await (await fetch(`/api/lab/tasks/${task.id}/start`, { method: "PATCH" })).json();
        if (!json.success) { setError(json.error ?? "Unable to start"); return; }
        await loadTasks(); return;
      }
      const ss = getSampleStatus(task);
      if (ss === "PENDING") {
        const json = await (await fetch(`/api/lab/tasks/${task.id}/sample`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COLLECTED" }) })).json();
        if (!json.success) { setError(json.error ?? "Error"); return; }
        await loadTasks(); return;
      }
      if (ss === "COLLECTED" || ss === "RECEIVED") {
        const json = await (await fetch(`/api/lab/tasks/${task.id}/sample`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PROCESSING" }) })).json();
        if (!json.success) { setError(json.error ?? "Error"); return; }
        await loadTasks(); return;
      }
      if (task.testOrders.some((o) => !isOrderReady(o))) { setError("Complete all required result fields before submitting."); return; }
      const json = await (await fetch(`/api/lab/tasks/${task.id}/results`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true, results: task.testOrders.map((o) => ({ testOrderId: o.id, resultData: drafts[o.id]?.values ?? {}, notes: drafts[o.id]?.notes ?? "" })) }),
      })).json();
      if (!json.success) { setError(json.error ?? "Submit failed"); return; }
      setExpandedTask(null);
      await loadTasks();
    } finally { setSavingTaskId(null); }
  }

  if (loading) return (
    <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
      Loading lab tasks...
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[
          { label: "Pending", value: counts.pending },
          { label: "In Progress", value: counts.inProgress },
          { label: "Completed", value: counts.completed },
        ].map((s) => (
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
        <button onClick={loadTasks} className="ml-auto rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {/* Tasks table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No tasks for current filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Sample</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Assigned</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((task) => (
                <>
                  <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${expandedTask === task.id ? "bg-blue-50/30" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{task.visit.patient.fullName}</p>
                      <p className="font-mono text-slate-400">{task.visit.patient.patientId} · {task.visit.patient.age}y · {task.visit.patient.sex}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {task.testOrders.map((o) => o.test.name).join(", ")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[task.priority]}`}>{task.priority}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[task.status]}`}>{task.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{getSampleStatus(task)}</td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(task.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        {task.status !== "COMPLETED" && (
                          <button
                            disabled={savingTaskId === task.id}
                            onClick={() => onWorkflowClick(task)}
                            className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {savingTaskId === task.id ? "Working..." : getActionLabel(task)}
                          </button>
                        )}
                        {showResultForm(task) && (
                          <button
                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {expandedTask === task.id ? "Close" : "Enter Results"}
                          </button>
                        )}
                        {task.status === "COMPLETED" && (
                          <span className="text-green-600 font-medium">✓ Submitted</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline result entry */}
                  {expandedTask === task.id && showResultForm(task) && (
                    <tr key={`${task.id}-form`}>
                      <td colSpan={7} className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                        <div className="space-y-4">
                          {task.testOrders.map((order) => (
                            <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">{order.test.name}</p>
                                  <p className="text-[11px] font-mono text-slate-400">{order.test.code}{order.test.sampleType ? ` · ${order.test.sampleType}` : ""}</p>
                                </div>
                                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${isOrderReady(order) ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>
                                  {isOrderReady(order) ? "Ready" : "Incomplete"}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                {order.test.resultFields.map((field) => {
                                  const value = drafts[order.id]?.values?.[field.fieldKey];
                                  const label = `${field.label}${field.isRequired ? " *" : ""}${field.unit ? ` (${field.unit})` : ""}`;

                                  if (field.fieldType === "TEXTAREA") return (
                                    <div key={field.id} className="col-span-2 md:col-span-3 lg:col-span-4">
                                      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
                                      <textarea rows={2} value={value ?? ""} onChange={(e) => updateDraft(order.id, (p) => ({ ...p, values: { ...p.values, [field.fieldKey]: e.target.value } }))}
                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                  );

                                  if (field.fieldType === "DROPDOWN") {
                                    const opts = (field.options ?? "").split(",").map((x) => x.trim()).filter(Boolean);
                                    return (
                                      <div key={field.id}>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
                                        <select value={value ?? ""} onChange={(e) => updateDraft(order.id, (p) => ({ ...p, values: { ...p.values, [field.fieldKey]: e.target.value } }))}
                                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                                          <option value="">Select...</option>
                                          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      </div>
                                    );
                                  }

                                  if (field.fieldType === "CHECKBOX") return (
                                    <div key={field.id} className="flex items-center gap-2 pt-4">
                                      <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateDraft(order.id, (p) => ({ ...p, values: { ...p.values, [field.fieldKey]: e.target.checked } }))}
                                        className="rounded border-slate-300" />
                                      <label className="text-[11px] font-medium text-slate-500">{field.label}</label>
                                    </div>
                                  );

                                  return (
                                    <div key={field.id}>
                                      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
                                      <input type={field.fieldType === "NUMBER" ? "number" : "text"} value={value ?? ""}
                                        onChange={(e) => updateDraft(order.id, (p) => ({ ...p, values: { ...p.values, [field.fieldKey]: e.target.value } }))}
                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="mt-3">
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes</label>
                                <textarea rows={1} value={drafts[order.id]?.notes ?? ""} onChange={(e) => updateDraft(order.id, (p) => ({ ...p, notes: e.target.value }))}
                                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>
                          ))}

                          {task.status !== "COMPLETED" && (
                            <button
                              disabled={savingTaskId === task.id}
                              onClick={() => onWorkflowClick(task)}
                              className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {savingTaskId === task.id ? "Submitting..." : "Submit Result"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 