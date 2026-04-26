"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SPLASH_KEY = "diagsync_launch_splash_seen";

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
  const [imageReady, setImageReady] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!pathname || shownRef.current) return;
    if (!isStandaloneMode()) return;
    if (!pathname.startsWith("/dashboard")) return;
    if (window.sessionStorage.getItem(SPLASH_KEY) === "1") return;

    shownRef.current = true;
    window.sessionStorage.setItem(SPLASH_KEY, "1");
    setVisible(true);
  }, [pathname]);

  useEffect(() => {
    if (!visible || !imageReady) return;

    const startClose = window.setTimeout(() => setClosing(true), 900);
    const hide = window.setTimeout(() => setVisible(false), 1400);

    return () => {
      window.clearTimeout(startClose);
      window.clearTimeout(hide);
    };
  }, [visible, imageReady]);

  useEffect(() => {
    if (!visible) return;
    const failSafe = window.setTimeout(() => {
      setClosing(true);
      window.setTimeout(() => setVisible(false), 350);
    }, 10000);
    return () => window.clearTimeout(failSafe);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-slate-100 transition-opacity duration-500 ${
        closing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Image
          src="/splash-screen.png"
          alt="DiagSync"
          width={900}
          height={540}
          priority
          className="h-auto w-[min(82vw,380px)] animate-[pulse_1.8s_ease-in-out_infinite]"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
        <p className="text-sm font-semibold tracking-wide text-slate-500">Loading workspace...</p>
      </div>
    </div>
  );
}
