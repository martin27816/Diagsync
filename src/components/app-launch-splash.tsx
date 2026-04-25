"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function AppLaunchSplash() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!pathname) {
      setVisible(false);
      setReady(true);
      return;
    }

    const shouldShow =
      isStandaloneMode() &&
      pathname.startsWith("/dashboard") &&
      window.sessionStorage.getItem("diagsync_launch_splash_seen") !== "1";

    if (!shouldShow) {
      setVisible(false);
      setReady(true);
      return;
    }

    setReady(true);
    window.sessionStorage.setItem("diagsync_launch_splash_seen", "1");
    const startClose = window.setTimeout(() => setClosing(true), 900);
    const remove = window.setTimeout(() => setVisible(false), 1300);
    return () => {
      window.clearTimeout(startClose);
      window.clearTimeout(remove);
    };
  }, [pathname]);

  if (!ready || !visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-100 transition-opacity duration-500 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="splash-logo-wrap">
          <Image src="/diagsync-logo.png" alt="DiagSync" width={260} height={260} priority className="h-auto w-[180px] sm:w-[220px]" />
        </div>
        <p className="mt-3 text-sm font-semibold tracking-wide text-slate-600">Loading workspace...</p>
      </div>
    </div>
  );
}
