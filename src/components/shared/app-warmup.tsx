"use client";

import { useEffect } from "react";

export function AppWarmup() {
  useEffect(() => {
    let cancelled = false;

    const warm = async () => {
      if (cancelled || !navigator.onLine) return;
      try {
        await fetch("/api/warmup", { cache: "no-store", keepalive: true });
      } catch {
        // Best-effort warmup; do not surface errors.
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
        void warm();
      });
      return () => {
        cancelled = true;
        if ("cancelIdleCallback" in window) {
          (window as Window & { cancelIdleCallback: (handle: number) => void }).cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(() => {
      void warm();
    }, 250);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  return null;
}
