// Network-first, never-stale service worker.
// It exists only so the app is installable and always loads the newest deploy:
// - install → skipWaiting so a new SW takes over immediately
// - activate → claim open clients right away
// - fetch   → always go to the network; only fall back to cache when offline
// There is deliberately no precache of the app shell, so an old version can
// never get trapped on the device.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
