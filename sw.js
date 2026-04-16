// DiagSync Service Worker
// Handles: PWA install, offline caching, and push notifications

const CACHE_NAME = "diagsync-v1";

// App shell — pages and assets to cache immediately on install
const APP_SHELL = [
  "/",
  "/login",
  "/register",
  "/offline",
];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch (Network-first, fallback to cache) ──────────────────────────────
self.addEventListener("fetch", (event) => {
  // Skip non-GET and API/auth requests — always go to network for those
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("/_next/webpack-hmr")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful page navigations
        if (response.ok && event.request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: try cache, then /offline page
        return caches.match(event.request).then(
          (cached) => cached || caches.match("/offline")
        );
      })
  );
});

// ─── Push Notifications (existing VAPID logic preserved) ───────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "DiagSync", body: event.data.text() };
  }

  const { title = "DiagSync", body = "", icon, data = {} } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});