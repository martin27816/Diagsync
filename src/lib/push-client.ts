function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const FETCH_TIMEOUT_MS = 12_000;
const SW_TIMEOUT_MS = 10_000;
const SUBSCRIBE_TIMEOUT_MS = 10_000;

export function isPushSupported() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMessage: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutErrorMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getRegistration() {
  return withTimeout(
    navigator.serviceWorker.register("/sw.js", { scope: "/" }),
    SW_TIMEOUT_MS,
    "service_worker_timeout"
  );
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  return registration.pushManager.getSubscription();
}

export async function syncPushSubscriptionWithServer(
  subscription: PushSubscription
) {
  let subRes: Response;
  let errorMessage = "";
  try {
    subRes = await fetchWithTimeout("/api/push/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  } catch {
    return { ok: false as const, reason: "network_timeout" as const };
  }
  const payload = await subRes.json().catch(() => null);
  errorMessage = typeof payload?.error === "string" ? payload.error : "";
  if (subRes.status === 401) {
    return {
      ok: false as const,
      reason: "unauthorized" as const,
      detail: errorMessage || "Session expired. Please sign in again.",
    };
  }
  if (subRes.status === 503) {
    return {
      ok: false as const,
      reason: "storage_not_ready" as const,
      detail: errorMessage || "Push storage not ready on server.",
    };
  }
  if (!subRes.ok) {
    return {
      ok: false as const,
      reason: "server_rejected_subscription" as const,
      detail: errorMessage || `Server rejected subscription (${subRes.status}).`,
    };
  }
  return { ok: true as const };
}

export async function subscribeToDevicePush() {
  if (!isPushSupported()) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false as const, reason: "permission_denied" as const };
  }

  let keyRes: Response;
  try {
    keyRes = await fetchWithTimeout(
      "/api/push/public-key",
      { cache: "no-store" },
      FETCH_TIMEOUT_MS
    );
  } catch {
    return { ok: false as const, reason: "network_timeout" as const };
  }

  const keyJson = await keyRes.json().catch(() => null);
  const publicKey = keyJson?.data?.publicKey;
  if (!keyRes.ok || !publicKey) {
    return { ok: false as const, reason: "missing_public_key" as const };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await getRegistration();
  } catch (error) {
    if (error instanceof Error && error.message === "service_worker_timeout") {
      return { ok: false as const, reason: "service_worker_timeout" as const };
    }
    return { ok: false as const, reason: "service_worker_register_failed" as const };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }),
        SUBSCRIBE_TIMEOUT_MS,
        "subscribe_timeout"
      );
    } catch (error) {
      // Chromium-family browsers (including Opera) can keep a stale key-bound
      // subscription and throw until we explicitly recreate it.
      try {
        const stale = await registration.pushManager.getSubscription();
        if (stale) {
          await stale.unsubscribe().catch(() => null);
          subscription = await withTimeout(
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            }),
            SUBSCRIBE_TIMEOUT_MS,
            "subscribe_timeout"
          );
        }
      } catch {
        // Fall through to generic error mapping below.
      }
      if (subscription) {
        const retrySync = await syncPushSubscriptionWithServer(subscription);
        if (!retrySync.ok) return retrySync;
        return { ok: true as const };
      }
      if (error instanceof Error && error.message === "subscribe_timeout") {
        return { ok: false as const, reason: "subscribe_timeout" as const };
      }
      return { ok: false as const, reason: "subscribe_failed" as const };
    }
  }

  const sync = await syncPushSubscriptionWithServer(subscription);
  if (!sync.ok) return sync;

  return { ok: true as const };
}

export async function unsubscribeFromDevicePush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint;
  if (subscription) {
    await subscription.unsubscribe().catch(() => null);
  }
  if (endpoint) {
    await fetch("/api/push/subscription", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => null);
  }
}
