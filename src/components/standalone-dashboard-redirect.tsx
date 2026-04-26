"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function StandaloneDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isStandaloneMode()) return;
    if (window.location.pathname.startsWith("/dashboard")) return;
    if (["/login", "/register"].some((p) => window.location.pathname.startsWith(p))) return;

    const booted = window.sessionStorage.getItem("diagsync_standalone_booted");
    if (booted === "1") return;

    window.sessionStorage.setItem("diagsync_standalone_booted", "1");
    router.replace("/dashboard");
  }, [router]);

  return null;
}
