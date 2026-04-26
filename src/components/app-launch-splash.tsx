"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

const SPLASH_KEY = "diagsync_launch_splash_seen";

export function AppLaunchSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const shownRef = useRef(false);
  const firstPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (typeof window === "undefined") return;
    if (!isStandaloneMode()) return;

    if (firstPathnameRef.current === null) {
      firstPathnameRef.current = pathname;
    }

    const alreadySeen = window.sessionStorage.getItem(SPLASH_KEY) === "1";
    if (alreadySeen) return;

    if (!shownRef.current) {
      shownRef.current = true;
      window.sessionStorage.setItem(SPLASH_KEY, "1");
      setVisible(true);
      return;
    }

    if (pathname !== firstPathnameRef.current && visible) {
      setClosing(true);
      const t = window.setTimeout(() => setVisible(false), 500);
      return () => window.clearTimeout(t);
    }
  }, [pathname, visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-100 transition-opacity duration-500 ${
        closing ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="splash-logo-wrap">
          <Image
            src="/diagsync-logo.png"
            alt="DiagSync"
            width={260}
            height={260}
            priority
            className="h-auto w-[180px] sm:w-[220px]"
          />
        </div>
        <p className="mt-3 text-sm font-semibold tracking-wide text-slate-600">
          Loading workspace...
        </p>
      </div>
    </div>
  );
}
