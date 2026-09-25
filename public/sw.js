/* Cache only a public play shell and a build-generated asset allowlist.
   Never cache account pages, APIs, room state, credentials, or RSC responses. */
const FALLBACK = "allchess-offline-v2";
const META = "allchess-pack-meta-v1";
const PREFIX = "allchess-play-pack-";
const POINTER = "/__allchess_offline_pack__";
let downloadJob = null;
const subscribers = new Set();

self.addEventListener("install", event => {
  event.waitUntil(caches.open(FALLBACK).then(cache => cache.addAll(["/offline.html", "/icons/app-192.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("allchess-offline-") && key !== FALLBACK).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function savedPack() {
  const response = await (await caches.open(META)).match(POINTER);
  if (!response) return null;
  const pack = await response.json();
  if (!await caches.has(pack.cache)) return null;
  const entries = await (await caches.open(pack.cache)).keys();
  const paths = new Set(entries.map(request => new URL(request.url).pathname));
  return pack.assets.every(path => paths.has(path)) ? pack : null;
}

function allowedAsset(path) {
  if (typeof path !== "string" || !path.startsWith("/")) return false;
  try {
    const url = new URL(path, self.location.origin);
    const decoded = decodeURIComponent(path);
    if (url.origin !== self.location.origin || url.pathname !== path || decoded.includes(String.fromCharCode(92)) || decoded.split("/").some(part => part === "." || part === "..")) return false;
  } catch { return false; }
  return path === "/offline" || /^\/_next\/static\/[a-zA-Z0-9_./%~-]+\.(js|css|woff2?)$/.test(path)
    || ["/assets/khmer/collection.glb", "/assets/classic/collection.glb", "/assets/shogi/collection.glb", "/assets/xiangqi/collection.glb", "/assets/janggi/collection.glb", "/assets/makruk/collection.glb", "/engines/stockfish/stockfish-18-lite-single.js", "/engines/stockfish/stockfish-18-lite-single.wasm", "/icons/app-192.png", "/icons/app-512.png", "/icons/maskable-512.png", "/icon.svg"].includes(path);
}

async function fetchWithTimeout(request, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try { return await fetch(request, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function downloadPack() {
  const previous = await savedPack().catch(() => null);
  let staging = null;
  const broadcast = status => subscribers.forEach(port => port.postMessage(status));
  try {
    const response = await fetchWithTimeout("/offline-pack.json", { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error("The download is not available yet. Reconnect and try again.");
    const manifest = await response.json();
    if (!/^[a-f0-9]{64}$/.test(manifest.version) || !Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 1000
      || !manifest.assets.some(asset => asset.url === "/offline") || manifest.assets.some(asset => !allowedAsset(asset.url) || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0)
      || new Set(manifest.assets.map(asset => asset.url)).size !== manifest.assets.length) throw new Error("The play pack could not be verified. Try again after the app updates.");
    const total = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    if (total > 80 * 1024 * 1024) throw new Error("The play pack is too large. Please try again after the app updates.");
    const name = PREFIX + manifest.version;
    if (previous?.cache === name) { broadcast({ ready: true }); return; }
    staging = name;
    await caches.delete(name);
    const cache = await caches.open(name);
    let completed = 0, index = 0;
    broadcast({ ready: Boolean(previous), downloading: true, completed, total });
    async function worker() {
      while (index < manifest.assets.length) {
        const asset = manifest.assets[index++];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
          const result = await fetch(asset.url, { cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal });
          if (!result.ok || result.type === "opaque") throw new Error("The download was interrupted. Reconnect and try again.");
          const bytes = await result.clone().arrayBuffer();
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
          if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error("The app changed during download. Please try again.");
          await cache.put(asset.url, result);
        } finally { clearTimeout(timeout); }
        completed += asset.bytes;
        broadcast({ ready: Boolean(previous), downloading: true, completed, total });
      }
    }
    const results = await Promise.allSettled([worker(), worker(), worker()]);
    const failed = results.find(result => result.status === "rejected");
    if (failed) throw failed.reason;
    await (await caches.open(META)).put(POINTER, new Response(JSON.stringify({ cache: name, assets: manifest.assets.map(asset => asset.url) }), { headers: { "content-type": "application/json" } }));
    staging = null;
    // Keep one previous version for already-open boards during an update.
    await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== name && key !== previous?.cache).map(key => caches.delete(key)));
    broadcast({ ready: true });
  } catch (error) {
    if (staging) await caches.delete(staging);
    broadcast({ ready: Boolean(previous), error: error instanceof Error ? error.message : "Could not save the play pack. Check your connection and free storage, then try again." });
  }
}

self.addEventListener("message", event => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === "OFFLINE_STATUS") event.waitUntil(savedPack().then(pack => port.postMessage({ ready: Boolean(pack) })).catch(() => port.postMessage({ ready: false })));
  if (event.data?.type === "DOWNLOAD_OFFLINE") {
    subscribers.add(port);
    if (!downloadJob) downloadJob = downloadPack().finally(() => { downloadJob = null; subscribers.forEach(subscriber => subscriber.close()); subscribers.clear(); });
    event.waitUntil(downloadJob);
  }
});

self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetchWithTimeout(request).catch(async () => {
      const pack = await savedPack().catch(() => null);
      if (pack) {
        if (url.pathname === "/offline") return (await (await caches.open(pack.cache)).match("/offline")) || Response.error();
        const parts = url.pathname.match(/^\/([^/]+)\/play\/([^/]+)$/);
        const destination = new URL("/offline", url.origin);
        if (parts) { destination.searchParams.set("locale", parts[1]); destination.searchParams.set("game", parts[2]); }
        for (const key of ["time", "bot", "resume"]) if (url.searchParams.has(key)) destination.searchParams.set(key, url.searchParams.get(key));
        if (url.searchParams.get("mode") === "bot") destination.searchParams.set("mode", "bot");
        return Response.redirect(destination.href, 302);
      }
      return (await (await caches.open(FALLBACK)).match("/offline.html")) || Response.error();
    }));
  } else if (allowedAsset(url.pathname) && url.pathname !== "/offline") {
    event.respondWith(fetch(request).then(response => { if (!response.ok) throw new Error("Asset unavailable"); return response; }).catch(async () => {
      const pack = await savedPack().catch(() => null);
      if (pack) {
        const response = await (await caches.open(pack.cache)).match(url.pathname);
        if (response) return response;
      }
      // Hashed chunks from an already-open previous shell remain usable.
      if (url.pathname.startsWith("/_next/static/")) for (const name of (await caches.keys()).filter(key => key.startsWith(PREFIX))) {
        const response = await (await caches.open(name)).match(url.pathname);
        if (response) return response;
      }
      return (await (await caches.open(FALLBACK)).match(url.pathname)) || Response.error();
    }));
  }
});
