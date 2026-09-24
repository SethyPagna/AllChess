/* Only the public offline page and app icons are cached. Never cache APIs,
   authenticated pages, room state, RSC responses, or account information. */
const CACHE = "allchess-offline-v1";
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/offline.html", "/icons/app-192.png"]))); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("allchess-offline-") && key !== CACHE).map(key => caches.delete(key))))); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
});
