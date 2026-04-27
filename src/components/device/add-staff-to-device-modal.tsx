"use client";

import { useEffect, useMemo, useState } from "react";
import { DeviceStaffSummary } from "@/lib/device-client";
import { PinInput } from "@/components/device/pin-input";

type AddStaffResponse = {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    staff: DeviceStaffSummary;
    requiresPinSetup: boolean;
    pinSetupToken: string | null;
  };
};

interface AddStaffToDeviceModalProps {
  open: boolean;
  deviceKey: string;
  onClose: () => void;
  onStaffAdded: (staff: DeviceStaffSummary) => void;
}

const inputCls =
  "h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function AddStaffToDeviceModal({ open, deviceKey, onClose, onStaffAdded }: AddStaffToDeviceModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifiedStaff, setVerifiedStaff] = useState<DeviceStaffSummary | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinSetupToken, setPinSetupToken] = useState<string | null>(null);
  const readyToSubmitPin = useMemo(() => pin.length === 4 && confirmPin.length === 4, [pin, confirmPin]);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setPassword("");
    setPin("");
    setConfirmPin("");
    setBusy(false);
    setError("");
    setMessage("");
    setVerifiedStaff(null);
    setNeedsPin(false);
    setPinSetupToken(null);
  }, [open]);

  if (!open) return null;

  async function verifyStaff() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/device/add-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceKey,
          email: email.trim(),
          password,
        }),
      });
      const json = (await res.json()) as AddStaffResponse;
      if (!json.success || !json.data) {
        setError(json.error ?? "Failed to verify staff");
        return;
      }
      setVerifiedStaff(json.data.staff);
      setNeedsPin(json.data.requiresPinSetup);
      setPinSetupToken(json.data.pinSetupToken);
      onStaffAdded(json.data.staff);
      if (json.data.requiresPinSetup) {
        setMessage("Staff verified. Create a 4-digit PIN.");
      } else {
        setMessage("Staff added to this device.");
      }
    } catch {
      setError("Network error while verifying staff.");
    } finally {
      setBusy(false);
    }
  }

  async function setPinForStaff() {
    if (!verifiedStaff || !pinSetupToken) return;
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/staff/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: verifiedStaff.staffId,
          pin,
          pinSetupToken,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!json.success) {
        setError(json.error ?? "Failed to set PIN");
        return;
      }
      setNeedsPin(false);
      setPinSetupToken(null);
      setMessage(json.message ?? "PIN created successfully");
    } catch {
      setError("Network error while setting PIN.");
    } finally {
      setBusy(false);
    }
  }

  const showVerifyForm = !verifiedStaff;
  const showPinForm = !!verifiedStaff && needsPin;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Staff to This Device</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Verify staff credentials, then create PIN if needed.
          </p>
        </div>

        {error ? (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        ) : null}
        {message ? (
          <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            {message}
          </div>
        ) : null}

        {showVerifyForm ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputCls}
                placeholder="staff@lab.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputCls}
                placeholder="Enter staff password"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !email.trim() || !password}
                onClick={() => void verifyStaff()}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Verifying..." : "Verify Staff"}
              </button>
            </div>
          </div>
        ) : null}

        {showPinForm ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Set a 4-digit PIN for <span className="font-semibold">{verifiedStaff.name}</span>.
            </p>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Enter PIN</p>
                <PinInput value={pin} onChange={setPin} autoFocus disabled={busy} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Confirm PIN</p>
                <PinInput value={confirmPin} onChange={setConfirmPin} disabled={busy} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy || !readyToSubmitPin}
                onClick={() => void setPinForStaff()}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Create PIN"}
              </button>
            </div>
          </div>
        ) : null}

        {verifiedStaff && !needsPin ? (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
