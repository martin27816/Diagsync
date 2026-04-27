"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/utils";
import { DeviceStaffSummary } from "@/lib/device-client";

interface RemoveStaffFromDeviceDialogProps {
  open: boolean;
  deviceKey: string;
  staff: DeviceStaffSummary[];
  currentStaffId: string;
  onClose: () => void;
  onRemoved: (staffId: string) => void;
}

export function RemoveStaffFromDeviceDialog({
  open,
  deviceKey,
  staff,
  currentStaffId,
  onClose,
  onRemoved,
}: RemoveStaffFromDeviceDialogProps) {
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  async function removeStaff(staffId: string) {
    setBusyStaffId(staffId);
    setError("");
    try {
      const res = await fetch("/api/device/remove-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceKey, staffId }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Failed to remove staff");
        return;
      }
      onRemoved(staffId);
    } catch {
      setError("Network error while removing staff.");
    } finally {
      setBusyStaffId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Remove Staff from Device</h3>
          <p className="mt-0.5 text-xs text-slate-500">Choose staff to remove from this device.</p>
        </div>

        {error ? (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        ) : null}

        {staff.length === 0 ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
            No saved staff to remove.
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {staff.map((item) => (
              <div
                key={item.staffId}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {item.name}
                    {item.staffId === currentStaffId ? (
                      <span className="ml-2 text-[11px] text-blue-600">(Current)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">{item.email}</p>
                  <p className="text-[11px] text-slate-400">{ROLE_LABELS[item.role]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeStaff(item.staffId)}
                  disabled={busyStaffId === item.staffId}
                  className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {busyStaffId === item.staffId ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
