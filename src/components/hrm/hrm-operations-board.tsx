"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type TaskRow = {
  taskId: string;
  department: string;
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedStaff: { id: string; fullName: string } | null;
  visit: { patient: { fullName: string; patientId: string } };
  testNames: string[];
  createdAt: string;
  updatedAt: string;
  delayed: boolean;
};

type StaffPerf = {
  id: string;
  fullName: string;
  role: string;
  assigned: number;
  active: number;
  completed: number;
  overloaded: boolean;
};

type StaffOption = {
  id: string;
  fullName: string;
  role: string;
  department: string;
};

export function HrmOperationsBoard({ staffOptions }: { staffOptions: StaffOption[] }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [staffPerf, setStaffPerf] = useState<StaffPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [reassign, setReassign] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ department, status, priority });
      const [taskRes, perfRes] = await Promise.all([
        fetch(`/api/hrm/tasks?${query.toString()}`),
        fetch("/api/hrm/staff-performance"),
      ]);
      const taskJson = await taskRes.json();
      const perfJson = await perfRes.json();

      if (!taskJson.success) {
        setError(taskJson.error ?? "Failed to load tasks");
        return;
      }
      if (!perfJson.success) {
        setError(perfJson.error ?? "Failed to load staff performance");
        return;
      }

      setTasks(taskJson.data);
      setStaffPerf(perfJson.data);
    } catch {
      setError("Network error while loading operations data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [department, status, priority]);

  const delayedCount = useMemo(() => tasks.filter((t) => t.delayed).length, [tasks]);

  async function onReassign(task: TaskRow) {
    const newStaffId = reassign[task.taskId];
    if (!newStaffId) {
      setError("Select a staff member to reassign.");
      return;
    }
    setBusyTaskId(task.taskId);
    setError("");
    try {
      const res = await fetch(`/api/hrm/tasks/${task.taskId}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStaffId,
          reason: reason[task.taskId] ?? "",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Reassignment failed");
        return;
      }
      await loadData();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function onOverride(taskId: string, action: "RELEASE_TO_PENDING" | "FORCE_COMPLETE") {
    setBusyTaskId(taskId);
    setError("");
    try {
      const res = await fetch(`/api/hrm/tasks/${taskId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason[taskId] ?? "" }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Override failed");
        return;
      }
      await loadData();
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Departments</SelectItem>
            <SelectItem value="LABORATORY">Laboratory</SelectItem>
            <SelectItem value="RADIOLOGY">Radiology</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="ROUTINE">Routine</SelectItem>
          </SelectContent>
        </Select>

        <div className="rounded-md border bg-card px-3 py-2 text-sm">
          Delayed tasks: <span className="font-semibold">{delayedCount}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Patient</th>
              <th className="px-4 py-3 text-left font-semibold">Department</th>
              <th className="px-4 py-3 text-left font-semibold">Tests</th>
              <th className="px-4 py-3 text-left font-semibold">Assigned Staff</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Priority</th>
              <th className="px-4 py-3 text-left font-semibold">Created</th>
              <th className="px-4 py-3 text-left font-semibold">Updated</th>
              <th className="px-4 py-3 text-left font-semibold">Control</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={9}>Loading tasks...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={9}>No tasks found.</td></tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.taskId} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{task.visit.patient.fullName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{task.visit.patient.patientId}</p>
                  </td>
                  <td className="px-4 py-3">{task.department}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {task.testNames.map((name, idx) => (
                        <p key={`${task.taskId}-${idx}`}>{name}</p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{task.assignedStaff?.fullName ?? "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "info" : task.status === "CANCELLED" ? "destructive" : "secondary"}>
                      {task.status}
                    </Badge>
                    {task.delayed && <Badge variant="warning" className="ml-2">Delayed</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={task.priority === "EMERGENCY" ? "destructive" : task.priority === "URGENT" ? "warning" : "secondary"}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(task.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(task.updatedAt)}</td>
                  <td className="px-4 py-3 min-w-[260px] space-y-2">
                    <Select
                      value={reassign[task.taskId] ?? ""}
                      onValueChange={(v) => setReassign((p) => ({ ...p, [task.taskId]: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select staff to reassign" /></SelectTrigger>
                      <SelectContent>
                        {staffOptions
                          .filter((s) => s.department === task.department)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.fullName} ({s.role})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <textarea
                      rows={2}
                      placeholder="Reason (optional)"
                      value={reason[task.taskId] ?? ""}
                      onChange={(e) => setReason((p) => ({ ...p, [task.taskId]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button
                        size="sm"
                        disabled={busyTaskId === task.taskId}
                        onClick={() => onReassign(task)}
                      >
                        Reassign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyTaskId === task.taskId}
                        onClick={() => onOverride(task.taskId, "RELEASE_TO_PENDING")}
                      >
                        Release
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyTaskId === task.taskId}
                        onClick={() => onOverride(task.taskId, "FORCE_COMPLETE")}
                      >
                        Force Complete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <div className="px-4 py-3 border-b font-semibold">Staff Monitoring</div>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Staff</th>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              <th className="px-4 py-3 text-left font-semibold">Assigned</th>
              <th className="px-4 py-3 text-left font-semibold">Active</th>
              <th className="px-4 py-3 text-left font-semibold">Completed</th>
              <th className="px-4 py-3 text-left font-semibold">Workload</th>
            </tr>
          </thead>
          <tbody>
            {staffPerf.length === 0 ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={6}>No staff performance data.</td></tr>
            ) : (
              staffPerf.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.fullName}</td>
                  <td className="px-4 py-3">{s.role}</td>
                  <td className="px-4 py-3">{s.assigned}</td>
                  <td className="px-4 py-3">{s.active}</td>
                  <td className="px-4 py-3">{s.completed}</td>
                  <td className="px-4 py-3">
                    {s.overloaded ? (
                      <Badge variant="warning">Overloaded</Badge>
                    ) : (
                      <Badge variant="success">Normal</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

