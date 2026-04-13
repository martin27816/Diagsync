"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type NotificationItem = {
  id: string; type: string; title: string; message: string;
  isRead: boolean; entityId?: string | null; entityType?: string | null; createdAt: string;
};
type NotificationResponse = { items: NotificationItem[]; unreadCount: number; nextCursor: string | null };

function roleNotificationPath(role: string) {
  if (role === "RECEPTIONIST") return "/dashboard/receptionist/notifications";
  if (role === "LAB_SCIENTIST") return "/dashboard/lab-scientist/notifications";
  if (role === "RADIOGRAPHER") return "/dashboard/radiographer/notifications";
  if (role === "MD") return "/dashboard/md/notifications";
  return "/dashboard/hrm/notifications";
}

export function NotificationBell({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<NotificationResponse>({ items: [], unreadCount: 0, nextCursor: null });
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setLoading(true); setError("");
      const res = await fetch("/api/notifications?limit=10", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed"); return; }
      setData(json.data);
    } catch { setError("Failed to load"); }
    finally { setLoading(false); }
  }

  async function markOneRead(id: string) {
    const target = data.items.find((item) => item.id === id);
    if (!target || target.isRead) return;
    setData((prev) => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1), items: prev.items.map((item) => item.id === id ? { ...item, isRead: true } : item) }));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => null);
  }

  async function markAllRead() {
    setData((prev) => ({ ...prev, unreadCount: 0, items: prev.items.map((item) => ({ ...item, isRead: true })) }));
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => null);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const stream = new EventSource("/api/notifications/stream");
    stream.addEventListener("notification", () => { void load(); });
    stream.addEventListener("error", () => { stream.close(); });
    return () => stream.close();
  }, []);

  const unreadBadge = useMemo(() => {
    if (data.unreadCount <= 0) return null;
    return data.unreadCount > 99 ? "99+" : String(data.unreadCount);
  }, [data.unreadCount]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 transition-colors"
      >
        <Bell className="h-4 w-4 text-slate-500" />
        {unreadBadge && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1 py-px text-[9px] font-bold text-white leading-none">
            {unreadBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Notifications</span>
              {data.unreadCount > 0 && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{data.unreadCount} unread</span>
              )}
            </div>
            <button onClick={markAllRead} disabled={data.unreadCount === 0}
              className="text-[11px] text-blue-600 hover:underline disabled:text-slate-300">
              Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <p className="px-3 py-4 text-xs text-slate-400">Loading...</p>
            ) : error ? (
              <p className="px-3 py-4 text-xs text-red-500">{error}</p>
            ) : data.items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400">No notifications yet.</p>
            ) : (
              data.items.map((item) => (
                <button key={item.id} onClick={() => void markOneRead(item.id)}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-start gap-2">
                  {!item.isRead && <span className="mt-1.5 h-1.5 w-1.5 min-w-[6px] rounded-full bg-blue-500" />}
                  <div className={!item.isRead ? "" : "pl-3.5"}>
                    <p className={`text-xs ${item.isRead ? "text-slate-500" : "font-medium text-slate-800"}`}>{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.message}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">{formatDateTime(item.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-3 py-2">
            <Link href={roleNotificationPath(role)} className="text-xs text-blue-600 hover:underline">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}