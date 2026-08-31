// =====================================================================
// public/service-worker.js
// App-shell caching for offline-first PWA behavior. Data sync (tasks,
// habits, etc.) is handled separately by lib/offline/syncEngine.ts via
// IndexedDB — this worker only caches the static shell so the app can
// boot with no network at all.
// =====================================================================

const CACHE_NAME = "life-optimizer-shell-v1";
const APP_SHELL = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

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

// Network-first for navigation requests (fresh content when online,
// falls back to cached shell / offline page when not). Cache-first for
// static assets (JS/CSS/fonts) since those are versioned by build hash.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(
          () =>
            caches.match(request).then((cached) => cached) ||
            caches.match("/offline.html")
        )
    );
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
  }
});

// Background Sync API: when supported, the browser calls this even if
// the app isn't open, letting the outbox flush without user interaction.
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-outbox") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "FLUSH_OUTBOX" }));
      })
    );
  }
});
