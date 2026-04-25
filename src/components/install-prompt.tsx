"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "diagsync_install_prompt_dismissed";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const dismissedState = window.localStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(dismissedState);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showIosHint = useMemo(() => isIosDevice() && !isStandaloneMode(), []);
  const canShowPrompt = !dismissed && !isStandaloneMode() && (Boolean(deferredPrompt) || showIosHint);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  if (!canShowPrompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-[5.25rem] z-40 rounded-xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-4 md:right-4 md:left-auto md:w-[340px]">
      <p className="text-sm font-semibold text-slate-800">Install DiagSync for faster access</p>
      <p className="mt-1 text-xs text-slate-500">
        {showIosHint
          ? "Open Dashboard first, then tap Share and Add to Home Screen."
          : "Get quick launch and app-like full-screen experience."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {showIosHint ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open Dashboard
          </Link>
        ) : null}
        {!showIosHint ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={!deferredPrompt || installing}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {installing ? "Installing..." : "Install"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
