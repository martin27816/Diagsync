"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function StandaloneDashboardRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (!isStandaloneMode()) return;
    if (pathname.startsWith("/dashboard")) return;
    if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/admin")) return;

    const bootedKey = "diagsync_standalone_booted";
    if (window.sessionStorage.getItem(bootedKey) === "1") return;
    window.sessionStorage.setItem(bootedKey, "1");
    window.location.replace("/dashboard");
  }, [pathname]);

  return null;
}

