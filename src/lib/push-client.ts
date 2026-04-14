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

export function isPushSupported() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  return registration.pushManager.getSubscription();
}

export async function syncPushSubscriptionWithServer(
  subscription: PushSubscription
) {
  const subRes = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!subRes.ok) {
    return { ok: false as const, reason: "server_rejected_subscription" as const };
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

  const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
  const keyJson = await keyRes.json();
  const publicKey = keyJson?.data?.publicKey;
  if (!keyRes.ok || !publicKey) {
    return { ok: false as const, reason: "missing_public_key" as const };
  }

  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
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
