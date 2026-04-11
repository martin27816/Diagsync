"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";

type ImagingFile = {
  id: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
};

type Report = {
  findings: string;
  impression: string;
  notes?: string | null;
  isSubmitted: boolean;
};

type Task = {
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
  imagingFiles: ImagingFile[];
  radiologyReport: Report | null;
};

type Draft = {
  findings: string;
  impression: string;
  notes: string;
};

function isImageFile(file: ImagingFile) {
  if (file.fileType?.startsWith("image/")) return true;
  const name = file.fileName.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"].some((ext) =>
    name.endsWith(ext)
  );
}

function priorityVariant(priority: Priority) {
  if (priority === "EMERGENCY") return "destructive";
  if (priority === "URGENT") return "warning";
  return "secondary";
}

export function RadiologyTaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ status: statusFilter, sort });
      const res = await fetch(`/api/radiology/tasks?${query.toString()}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load tasks");
        return;
      }

      const rows = json.data.tasks as Task[];
      setTasks(rows);
      const nextDrafts: Record<string, Draft> = {};
      for (const task of rows) {
        nextDrafts[task.id] = {
          findings: task.radiologyReport?.findings ?? "",
          impression: task.radiologyReport?.impression ?? "",
          notes: task.radiologyReport?.notes ?? "",
        };
      }
      setDrafts(nextDrafts);
    } catch {
      setError("Network error while loading radiology tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [statusFilter, sort]);

  const filtered = useMemo(
    () => tasks.filter((task) => (priorityFilter === "ALL" ? true : task.priority === priorityFilter)),
    [tasks, priorityFilter]
  );

  const grouped = useMemo(
    () => ({
      pending: filtered.filter((t) => t.status === "PENDING").length,
      inProgress: filtered.filter((t) => t.status === "IN_PROGRESS").length,
      completed: filtered.filter((t) => t.status === "COMPLETED").length,
    }),
    [filtered]
  );

  function updateDraft(taskId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? { findings: "", impression: "", notes: "" }), ...patch } }));
  }

  function reportReady(taskId: string) {
    const d = drafts[taskId];
    return Boolean(d?.findings?.trim()) && Boolean(d?.impression?.trim());
  }

  async function startTask(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/radiology/tasks/${taskId}/start`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to start task");
        return;
      }
      await loadTasks();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function saveReport(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      const d = drafts[taskId] ?? { findings: "", impression: "", notes: "" };
      const res = await fetch(`/api/radiology/tasks/${taskId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to save report");
        return;
      }
      await loadTasks();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function submitTask(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      const d = drafts[taskId] ?? { findings: "", impression: "", notes: "" };
      if (!d.findings.trim() || !d.impression.trim()) {
        setError("Findings and impression are required before submission.");
        return;
      }

      await fetch(`/api/radiology/tasks/${taskId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });

      const res = await fetch(`/api/radiology/tasks/${taskId}/submit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireImaging: true }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to submit report");
        return;
      }
      await loadTasks();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function uploadImaging(taskId: string, file: File) {
    setError("");
    setProgress((prev) => ({ ...prev, [taskId]: 0 }));

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/radiology/tasks/${taskId}/upload`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          setProgress((prev) => ({ ...prev, [taskId]: percent }));
        }
      };

      xhr.onload = async () => {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status < 200 || xhr.status >= 300 || !json.success) {
            setError(json.error ?? "Upload failed");
          } else {
            await loadTasks();
          }
        } catch {
          setError("Upload failed");
        } finally {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          resolve();
        }
      };

      xhr.onerror = () => {
        setError("Upload failed. Please retry.");
        setProgress((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        resolve();
      };

      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading radiology tasks...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold">{grouped.pending}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">In Progress</p>
          <p className="mt-1 text-2xl font-bold">{grouped.inProgress}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-bold">{grouped.completed}</p>
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
          No radiology tasks found.
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
                  <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                  <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "info" : "secondary"}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-3">
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">Imaging Files</p>
                      <p className="text-xs text-muted-foreground">{task.imagingFiles.length} uploaded</p>
                    </div>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[task.id] = el;
                      }}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.dcm,application/dicom,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await uploadImaging(task.id, file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRefs.current[task.id]?.click()}
                        disabled={busyTaskId === task.id || task.status === "COMPLETED"}
                      >
                        Upload Imaging File
                      </Button>
                      {progress[task.id] !== undefined && (
                        <span className="text-sm text-muted-foreground">Uploading... {progress[task.id]}%</span>
                      )}
                    </div>
                    {task.imagingFiles.length > 0 && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                          {task.imagingFiles.filter(isImageFile).map((f) => (
                            <a
                              key={f.id}
                              href={f.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="group overflow-hidden rounded-md border"
                              title={f.fileName}
                            >
                              <img
                                src={f.fileUrl}
                                alt={f.fileName}
                                className="h-24 w-full object-cover transition group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>

                        <div className="space-y-1">
                          {task.imagingFiles.map((f) => (
                            <a
                              key={f.id}
                              href={f.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm text-primary underline-offset-2 hover:underline"
                            >
                              {f.fileName} ({Math.round(f.fileSizeBytes / 1024)} KB)
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <p className="font-medium">Radiology Report</p>
                    <div>
                      <Label>Findings *</Label>
                      <textarea
                        rows={3}
                        value={drafts[task.id]?.findings ?? ""}
                        onChange={(e) => updateDraft(task.id, { findings: e.target.value })}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <Label>Impression *</Label>
                      <textarea
                        rows={3}
                        value={drafts[task.id]?.impression ?? ""}
                        onChange={(e) => updateDraft(task.id, { impression: e.target.value })}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={drafts[task.id]?.notes ?? ""}
                        onChange={(e) => updateDraft(task.id, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={busyTaskId === task.id || task.status === "COMPLETED"}
                    onClick={() => startTask(task.id)}
                  >
                    {busyTaskId === task.id ? "Working..." : "Start Task"}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={busyTaskId === task.id || task.status === "COMPLETED"}
                    onClick={() => saveReport(task.id)}
                  >
                    Save Draft Report
                  </Button>
                  <Button
                    className="w-full"
                    disabled={busyTaskId === task.id || task.status === "COMPLETED" || !reportReady(task.id)}
                    onClick={() => submitTask(task.id)}
                  >
                    Complete & Submit Report
                  </Button>
                  {!reportReady(task.id) && (
                    <p className="text-xs text-muted-foreground">
                      Findings and impression are required before submission.
                    </p>
                  )}
                  {task.imagingFiles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Upload at least one imaging file to pass submission checks.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
