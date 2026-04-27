"use client";

import { Role } from "@prisma/client";

export const DEVICE_CONTEXT_KEY = "diagsync_device_context";

export type DeviceStaffSummary = {
  staffId: string;
  name: string;
  email: string;
  role: Role;
};

export type DeviceContext = {
  deviceKey: string;
  organizationId: string;
  staff: DeviceStaffSummary[];
  lastActiveStaffId?: string;
};

function safeParse(input: string | null): DeviceContext | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as DeviceContext;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.deviceKey !== "string" || typeof parsed.organizationId !== "string") return null;
    if (!Array.isArray(parsed.staff)) return null;
    return {
      deviceKey: parsed.deviceKey,
      organizationId: parsed.organizationId,
      staff: parsed.staff.filter(
        (item) =>
          item &&
          typeof item.staffId === "string" &&
          typeof item.name === "string" &&
          typeof item.email === "string" &&
          typeof item.role === "string"
      ),
      lastActiveStaffId:
        typeof parsed.lastActiveStaffId === "string" ? parsed.lastActiveStaffId : undefined,
    };
  } catch {
    return null;
  }
}

function randomKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceContext() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(DEVICE_CONTEXT_KEY));
}

export function saveDeviceContext(context: DeviceContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEVICE_CONTEXT_KEY, JSON.stringify(context));
}

export function clearDeviceContext() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEVICE_CONTEXT_KEY);
}

export function ensureDeviceContext(organizationId: string) {
  const existing = getDeviceContext();
  if (!existing || existing.organizationId !== organizationId) {
    const next: DeviceContext = {
      deviceKey: randomKey(),
      organizationId,
      staff: [],
    };
    saveDeviceContext(next);
    return next;
  }
  return existing;
}

export function setDeviceStaff(organizationId: string, staff: DeviceStaffSummary[]) {
  const current = ensureDeviceContext(organizationId);
  saveDeviceContext({
    ...current,
    staff,
    lastActiveStaffId: current.lastActiveStaffId,
  });
}

export function markLastActiveStaff(organizationId: string, staffId: string) {
  const current = ensureDeviceContext(organizationId);
  saveDeviceContext({
    ...current,
    lastActiveStaffId: staffId,
  });
}
