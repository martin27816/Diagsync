"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/index";
import { formatDateTime } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityId?: string | null;
  entityType?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};

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
  const [data, setData] = useState<NotificationResponse>({
    items: [],
    unreadCount: 0,
    nextCursor: null,
  });
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/notifications?limit=10", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load notifications");
        return;
      }
      setData(json.data);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markOneRead(id: string) {
    const target = data.items.find((item) => item.id === id);
    if (!target || target.isRead) return;
    setData((prev) => ({
      ...prev,
      unreadCount: Math.max(0, prev.unreadCount - 1),
      items: prev.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    }));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => null);
  }

  async function markAllRead() {
    setData((prev) => ({
      ...prev,
      unreadCount: 0,
      items: prev.items.map((item) => ({ ...item, isRead: true })),
    }));
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => null);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const stream = new EventSource("/api/notifications/stream");
    stream.addEventListener("notification", () => {
      void load();
    });
    stream.addEventListener("error", () => {
      stream.close();
    });
    return () => stream.close();
  }, []);

  const unreadBadge = useMemo(() => {
    if (data.unreadCount <= 0) return null;
    return data.unreadCount > 99 ? "99+" : String(data.unreadCount);
  }, [data.unreadCount]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-full p-2 transition-colors hover:bg-accent"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadBadge ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadBadge}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-2">
              <Badge variant={data.unreadCount > 0 ? "warning" : "secondary"}>
                {data.unreadCount} unread
              </Badge>
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
                disabled={data.unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Loading...</div>
            ) : error ? (
              <div className="px-4 py-6 text-sm text-destructive">{error}</div>
            ) : data.items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              data.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void markOneRead(item.id)}
                  className="w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm ${item.isRead ? "text-muted-foreground" : "font-medium"}`}>
                      {item.title}
                    </p>
                    {!item.isRead ? (
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>

          <div className="border-t px-4 py-3">
            <Link href={roleNotificationPath(role)} className="text-sm text-primary hover:underline">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
