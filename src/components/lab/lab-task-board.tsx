"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  test: {
    name: string;
    code: string;
    sampleType?: string | null;
    resultFields: ResultField[];
  };
  labResults: Array<{
    id: string;
    resultData: Record<string, any>;
    notes?: string | null;
    isSubmitted: boolean;
  }>;
};

type LabTask = {
  id: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
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
  sample?: {
    status: SampleStatus;
    notes?: string | null;
  } | null;
  testOrders: TestOrder[];
};

type Draft = {
  values: Record<string, any>;
  notes: string;
};

function priorityBadge(priority: Priority) {
  if (priority === "EMERGENCY") return "destructive";
  if (priority === "URGENT") return "warning";
  return "secondary";
}

export function LabTaskBoard() {
  const [tasks, setTasks] = useState<LabTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sampleState, setSampleState] = useState<Record<string, { status: SampleStatus; notes: string }>>({});

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        status: statusFilter,
        sort,
      });
      const res = await fetch(`/api/lab/tasks?${query.toString()}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load tasks");
        return;
      }

      const rows = json.data.tasks as LabTask[];
      setTasks(rows);

      const nextDrafts: Record<string, Draft> = {};
      const nextSamples: Record<string, { status: SampleStatus; notes: string }> = {};

      for (const task of rows) {
        nextSamples[task.id] = {
          status: task.sample?.status ?? "PENDING",
          notes: task.sample?.notes ?? "",
        };
        for (const order of task.testOrders) {
          const existing = order.labResults[0];
          nextDrafts[order.id] = {
            values: (existing?.resultData as Record<string, any>) ?? {},
            notes: existing?.notes ?? "",
          };
        }
      }

      setDrafts(nextDrafts);
      setSampleState(nextSamples);
    } catch {
      setError("Network error while loading tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [statusFilter, sort]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => (priorityFilter === "ALL" ? true : task.priority === priorityFilter));
  }, [tasks, priorityFilter]);

  const grouped = useMemo(
    () => ({
      pending: filtered.filter((t) => t.status === "PENDING"),
      inProgress: filtered.filter((t) => t.status === "IN_PROGRESS"),
      completed: filtered.filter((t) => t.status === "COMPLETED"),
    }),
    [filtered]
  );

  function updateDraft(testOrderId: string, updater: (prev: Draft) => Draft) {
    setDrafts((prev) => {
      const current = prev[testOrderId] ?? { values: {}, notes: "" };
      return { ...prev, [testOrderId]: updater(current) };
    });
  }

  function isValueFilled(value: any) {
    if (typeof value === "boolean") return true;
    if (value === 0) return true;
    return value !== undefined && value !== null && `${value}`.trim() !== "";
  }

  function isOrderReady(order: TestOrder) {
    const draft = drafts[order.id] ?? { values: {}, notes: "" };
    const required = order.test.resultFields.filter((f) => f.isRequired);

    if (required.length === 0) {
      return Object.values(draft.values).some(isValueFilled) || draft.notes.trim().length > 0;
    }

    return required.every((field) => isValueFilled(draft.values[field.fieldKey]));
  }

  async function startTask(taskId: string) {
    setSavingTaskId(taskId);
    try {
      const res = await fetch(`/api/lab/tasks/${taskId}/start`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to start task");
        return;
      }
      await loadTasks();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function saveSample(taskId: string) {
    setSavingTaskId(taskId);
    setError("");
    try {
      const payload = sampleState[taskId] ?? { status: "PENDING", notes: "" };
      const res = await fetch(`/api/lab/tasks/${taskId}/sample`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to save sample status");
        return;
      }
      await loadTasks();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function saveResults(task: LabTask, submit = false) {
    setSavingTaskId(task.id);
    setError("");
    try {
      const payload = {
        submit,
        results: task.testOrders.map((order) => ({
          testOrderId: order.id,
          resultData: drafts[order.id]?.values ?? {},
          notes: drafts[order.id]?.notes ?? "",
        })),
      };

      if (submit) {
        const notReady = task.testOrders.some((order) => !isOrderReady(order));
        if (notReady) {
          setError("Please complete required result fields for all tests before submission.");
          return;
        }
      }

      const res = await fetch(`/api/lab/tasks/${task.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to save results");
        return;
      }

      await loadTasks();
    } finally {
      setSavingTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading lab tasks...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold">{grouped.pending.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">In Progress</p>
          <p className="mt-1 text-2xl font-bold">{grouped.inProgress.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-bold">{grouped.completed.length}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
          <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="ROUTINE">Routine</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger><SelectValue placeholder="Sort by time" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No lab tasks found for the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((task) => (
            <div key={task.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visit {task.visit.visitNumber}</p>
                  <h3 className="text-lg font-semibold">{task.visit.patient.fullName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {task.visit.patient.patientId} · {task.visit.patient.age}y · {task.visit.patient.sex}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assigned: {formatDateTime(task.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={priorityBadge(task.priority) as any}>{task.priority}</Badge>
                  <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "info" : "secondary"}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  {task.testOrders.map((order) => (
                    <div key={order.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.test.name}</p>
                          <p className="text-xs text-muted-foreground">{order.test.code}</p>
                        </div>
                        <Badge variant={isOrderReady(order) ? "success" : "warning"}>
                          {isOrderReady(order) ? "Ready" : "Incomplete"}
                        </Badge>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {order.test.resultFields.map((field) => {
                          const value = drafts[order.id]?.values?.[field.fieldKey];
                          if (field.fieldType === "TEXTAREA") {
                            return (
                              <div key={field.id} className="md:col-span-2">
                                <Label>{field.label}{field.isRequired ? " *" : ""}</Label>
                                <textarea
                                  rows={2}
                                  value={value ?? ""}
                                  onChange={(e) =>
                                    updateDraft(order.id, (prev) => ({
                                      ...prev,
                                      values: { ...prev.values, [field.fieldKey]: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                              </div>
                            );
                          }

                          if (field.fieldType === "DROPDOWN") {
                            const options = (field.options ?? "").split(",").map((x) => x.trim()).filter(Boolean);
                            return (
                              <div key={field.id}>
                                <Label>{field.label}{field.isRequired ? " *" : ""}</Label>
                                <Select
                                  value={value ?? ""}
                                  onValueChange={(v) =>
                                    updateDraft(order.id, (prev) => ({
                                      ...prev,
                                      values: { ...prev.values, [field.fieldKey]: v },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                                  <SelectContent>
                                    {options.map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }

                          if (field.fieldType === "CHECKBOX") {
                            return (
                              <label key={field.id} className="mt-2 flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(value)}
                                  onChange={(e) =>
                                    updateDraft(order.id, (prev) => ({
                                      ...prev,
                                      values: { ...prev.values, [field.fieldKey]: e.target.checked },
                                    }))
                                  }
                                />
                                {field.label}
                              </label>
                            );
                          }

                          return (
                            <div key={field.id}>
                              <Label>{field.label}{field.isRequired ? " *" : ""}</Label>
                              <Input
                                type={field.fieldType === "NUMBER" ? "number" : "text"}
                                value={value ?? ""}
                                onChange={(e) =>
                                  updateDraft(order.id, (prev) => ({
                                    ...prev,
                                    values: { ...prev.values, [field.fieldKey]: e.target.value },
                                  }))
                                }
                                placeholder={field.unit ? `Unit: ${field.unit}` : ""}
                                className="mt-1"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2">
                        <Label>Notes</Label>
                        <textarea
                          rows={2}
                          value={drafts[order.id]?.notes ?? ""}
                          onChange={(e) =>
                            updateDraft(order.id, (prev) => ({ ...prev, notes: e.target.value }))
                          }
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <div>
                    <Label>Sample Status</Label>
                    <Select
                      value={sampleState[task.id]?.status ?? "PENDING"}
                      onValueChange={(v) =>
                        setSampleState((prev) => ({
                          ...prev,
                          [task.id]: { ...(prev[task.id] ?? { notes: "" }), status: v as SampleStatus },
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="COLLECTED">Collected</SelectItem>
                        <SelectItem value="RECEIVED">Received</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Sample Notes</Label>
                    <textarea
                      rows={3}
                      value={sampleState[task.id]?.notes ?? ""}
                      onChange={(e) =>
                        setSampleState((prev) => ({
                          ...prev,
                          [task.id]: { ...(prev[task.id] ?? { status: "PENDING" }), notes: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={savingTaskId === task.id || task.status === "COMPLETED"}
                      onClick={() => startTask(task.id)}
                    >
                      {savingTaskId === task.id ? "Working..." : "Start Task"}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={savingTaskId === task.id || task.status === "COMPLETED"}
                      onClick={() => saveSample(task.id)}
                    >
                      Save Sample
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={savingTaskId === task.id || task.status === "COMPLETED"}
                      onClick={() => saveResults(task, false)}
                    >
                      Save Draft Results
                    </Button>
                    <Button
                      className="w-full"
                      disabled={savingTaskId === task.id || task.status === "COMPLETED"}
                      onClick={() => saveResults(task, true)}
                    >
                      Complete & Submit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
