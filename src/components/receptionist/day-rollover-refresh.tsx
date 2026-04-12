"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DayRolloverRefresh() {
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());

    const timer = window.setTimeout(() => {
      router.refresh();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
