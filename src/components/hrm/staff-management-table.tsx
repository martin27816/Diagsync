"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { DEPARTMENT_LABELS, ROLE_LABELS, formatDate } from "@/lib/utils";

type StaffRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: keyof typeof ROLE_LABELS;
  department: keyof typeof DEPARTMENT_LABELS;
  status: string;
  availabilityStatus: string;
  defaultShift: string;
  dateJoined: string;
};

type Props = {
  staff: StaffRow[];
};

const inputCls =
  "h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function StaffManagementTable({ staff }: Props) {
  const [rows, setRows] = useState(staff);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [passwordDialogStaffId, setPasswordDialogStaffId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const selectedStaff = useMemo(
    () => rows.find((row) => row.id === passwordDialogStaffId) ?? null,
    [passwordDialogStaffId, rows]
  );

  async function deleteStaff(staffId: string, fullName: string) {
    if (!window.confirm(`Delete/deactivate ${fullName}?`)) return;
    setError("");
    setMessage("");
    setBusyId(staffId);
    try {
      const res = await fetch(`/api/staff/${staffId}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!json.success) {
        setError(json.error ?? "Failed to delete staff.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== staffId));
      setMessage(`${fullName} deleted successfully.`);
    } catch {
      setError("Network error while deleting staff.");
    } finally {
      setBusyId(null);
    }
  }

  function openPasswordDialog(staffId: string) {
    setPasswordDialogStaffId(staffId);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
    setMessage("");
  }

  async function changePassword() {
    if (!selectedStaff) return;
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setMessage("");
    setBusyId(selectedStaff.id);
    try {
      const res = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!json.success) {
        setError(json.error ?? "Failed to update password.");
        return;
      }
      setMessage(`Password updated for ${selectedStaff.fullName}.`);
      setPasswordDialogStaffId(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch {
      setError("Network error while changing password.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{message}</div> : null}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">No staff yet.</p>
            <Link
              href="/dashboard/hrm/staff/new"
              className="mt-2 inline-flex text-xs text-blue-600 hover:underline"
            >
              Add first staff member →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Department</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Shift</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Availability</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Joined</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.fullName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.email}</td>
                    <td className="px-4 py-2.5 text-slate-500">{ROLE_LABELS[s.role]}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {DEPARTMENT_LABELS[s.department] ?? s.department}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{s.defaultShift}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          s.status === "ACTIVE"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          s.availabilityStatus === "AVAILABLE"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.availabilityStatus === "AVAILABLE" ? "Available" : "Away"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatDate(s.dateJoined)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/hrm/staff/${s.id}`} className="text-blue-600 hover:underline">
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => openPasswordDialog(s.id)}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteStaff(s.id, s.fullName)}
                          disabled={busyId === s.id}
                          className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {busyId === s.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Change Staff Password</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedStaff.fullName}</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">New Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputCls} pr-9`}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 inline-flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Confirm Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pr-9`}
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 inline-flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPasswordDialogStaffId(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === selectedStaff.id}
                onClick={() => void changePassword()}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busyId === selectedStaff.id ? "Saving..." : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
