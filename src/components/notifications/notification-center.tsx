"use client";

import { useEffect, useState } from "react";
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

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load notifications");
        return;
      }
      setItems(json.data.items);
      setUnreadCount(json.data.unreadCount);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markOneRead(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current || current.isRead) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => null);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => null);
  }

  useEffect(() => {
    void load();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live updates for assignments, submissions, approvals, rejections, and delays.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={unreadCount > 0 ? "warning" : "secondary"}>
            {unreadCount} unread
          </Badge>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">Loading notifications...</div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => void markOneRead(item.id)}
                className="w-full px-4 py-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className={`text-sm ${item.isRead ? "text-muted-foreground" : "font-semibold"}`}>
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {!item.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
