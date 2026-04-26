"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function AppLaunchSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Only run once after first mount with a valid pathname
    if (!pathname || initialized) return;
    setInitialized(true);

    const alreadySeen =
      window.sessionStorage.getItem("diagsync_launch_splash_seen") === "1";

    const shouldShow = isStandaloneMode() && !alreadySeen;

    if (!shouldShow) return; // stays invisible

    // Mark seen immediately so remounts don't re-show it
    window.sessionStorage.setItem("diagsync_launch_splash_seen", "1");
    setVisible(true);

    const startClose = window.setTimeout(() => setClosing(true), 1200);
    const remove = window.setTimeout(() => setVisible(false), 1700);

    return () => {
      window.clearTimeout(startClose);
      window.clearTimeout(remove);
    };
  }, [pathname, initialized]);

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