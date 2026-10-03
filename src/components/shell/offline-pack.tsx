"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Offline navigation needs a document request, not an uncached RSC fetch. */

import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Check, WifiOff } from "lucide-react";

type PackStatus = { ready: boolean; downloading?: boolean; completed?: number; total?: number; error?: string };

export function createOfflinePackClient(workers: ServiceWorkerContainer, onStatus: (status: PackStatus) => void, onAvailable: () => void) {
  let disposed = false, downloading = false, statusGeneration = 0;
  let status: PackStatus = { ready: false };
  let statusPort: MessagePort | null = null, downloadPort: MessagePort | null = null;
  let downloadAbort: AbortController | null = null;
  const lifetime = new AbortController();
  const registration = workers.register("/sw.js", { updateViaCache: "none" });
  const publish = (next: PackStatus) => { if (!disposed) { status = next; onStatus(next); } };

  function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      if (signal.aborted) { reject(signal.reason); return; }
      signal.addEventListener("abort", abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  function activeWorker(current: ServiceWorkerRegistration, signal: AbortSignal): Promise<ServiceWorker> {
    return new Promise((resolve, reject) => {
      const watched = new Set<ServiceWorker>();
      let candidate: ServiceWorker | null = null;
      const finish = (worker?: ServiceWorker, error?: unknown) => {
        current.removeEventListener("updatefound", check);
        workers.removeEventListener("controllerchange", check);
        watched.forEach(item => item.removeEventListener("statechange", check));
        signal.removeEventListener("abort", abort);
        if (worker) resolve(worker); else reject(error);
      };
      const abort = () => finish(undefined, signal.reason);
      function check() {
        if (signal.aborted) { abort(); return; }
        candidate = current.installing ?? current.waiting ?? candidate ?? current.active;
        if (candidate && !watched.has(candidate)) {
          watched.add(candidate); candidate.addEventListener("statechange", check);
        }
        if (candidate?.state === "redundant") { finish(undefined, new Error("The app update could not finish. Reconnect and try again.")); return; }
        if (candidate?.state === "activated" && current.active === candidate) finish(candidate);
      }
      current.addEventListener("updatefound", check);
      workers.addEventListener("controllerchange", check);
      signal.addEventListener("abort", abort, { once: true });
      check();
    });
  }

  async function readStatus() {
    if (disposed || downloading) return;
    const generation = ++statusGeneration;
    try {
      const current = await abortable(registration, lifetime.signal);
      const worker = current.active ?? await activeWorker(current, lifetime.signal);
      if (disposed || downloading || generation !== statusGeneration) return;
      onAvailable();
      statusPort?.close();
      const channel = new MessageChannel(); statusPort = channel.port1;
      channel.port1.onmessage = event => {
        channel.port1.close();
        if (!disposed && !downloading && generation === statusGeneration) publish({ ...event.data, error: status.error });
      };
      worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    } catch { /* Registration is optional while online. */ }
  }

  async function download() {
    if (disposed || downloading) return;
    downloading = true; statusGeneration++; statusPort?.close(); statusPort = null;
    publish({ ...status, downloading: true, completed: 0, total: 0, error: undefined });
    const operation = new AbortController(); downloadAbort = operation;
    const timeout = setTimeout(() => operation.abort(new Error("The app update took too long. Reconnect and try again.")), 30_000);
    try {
      const current = await abortable(registration, operation.signal);
      await abortable(current.update(), operation.signal);
      let worker = await activeWorker(current, operation.signal);
      while (worker !== current.active || current.installing || current.waiting) worker = await activeWorker(current, operation.signal);
      if (operation.signal.aborted) throw operation.signal.reason;
      clearTimeout(timeout);
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel(); downloadPort = channel.port1;
        let settled = false;
        const finish = (error?: unknown) => {
          if (settled) return;
          settled = true; channel.port1.close();
          operation.signal.removeEventListener("abort", abort);
          if (error) reject(error); else resolve();
        };
        const abort = () => finish(operation.signal.reason);
        operation.signal.addEventListener("abort", abort, { once: true });
        channel.port1.onmessage = event => {
          if (settled || disposed || operation.signal.aborted) return;
          const next = event.data as PackStatus;
          publish(next);
          if (!next.downloading) finish();
        };
        channel.port1.onmessageerror = () => finish(new Error("Could not read the download status. Reconnect and try again."));
        try { worker.postMessage({ type: "DOWNLOAD_OFFLINE" }, [channel.port2]); }
        catch (error) { finish(error); }
      });
    } catch (error) {
      publish({ ...status, downloading: false, error: error instanceof Error ? error.message : "Could not save the play pack. Reconnect and try again." });
    } finally {
      clearTimeout(timeout); downloadPort?.close(); downloadPort = null;
      downloadAbort = null; downloading = false;
    }
  }

  workers.addEventListener("controllerchange", readStatus);
  void readStatus();
  return {
    download,
    dispose() {
      disposed = true; statusGeneration++;
      lifetime.abort(); downloadAbort?.abort();
      statusPort?.close(); downloadPort?.close();
      workers.removeEventListener("controllerchange", readStatus);
    }
  };
}

export function OfflinePack() {
  const [status, setStatus] = useState<PackStatus>({ ready: false });
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const clientRef = useRef<ReturnType<typeof createOfflinePackClient> | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const client = createOfflinePackClient(navigator.serviceWorker, setStatus, () => setAvailable(true));
    clientRef.current = client;
    return () => { client.dispose(); clientRef.current = null; };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      const panel = panelRef.current, toggle = toggleRef.current;
      if (!panel || !toggle) return;
      const rect = toggle.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 12));
      const top = rect.bottom + panel.offsetHeight + 20 < window.innerHeight ? rect.bottom + 8 : rect.top - panel.offsetHeight - 8;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(12, Math.min(top, window.innerHeight - panel.offsetHeight - 12))}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (event.target instanceof Node && !containerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!available) return null;
  return <div className="offline-pack" ref={containerRef}>
    <button ref={toggleRef} type="button" className="focus-ring action-secondary offline-pack-toggle" aria-expanded={open} aria-controls={panelId} aria-label="Offline play pack" onClick={() => setOpen(value => !value)}>
      {status.ready ? <Check size={17} /> : <WifiOff size={17} />}<span>{status.ready ? "Offline ready" : "Play offline"}</span>
    </button>
    {open ? createPortal(<div id={panelId} ref={panelRef} className="offline-pack-panel">
      <strong>Take your boards with you</strong>
      <p>Save local games, bots, and 3D sets on this device. Your browser may clear this download if storage runs low.</p>
      <div role="status" aria-live="polite">
        {status.downloading ? <><progress value={status.completed || 0} max={status.total || 1} /><span>Saving play pack… {status.total ? `${Math.round((status.completed || 0) / status.total * 100)}%` : ""}</span></> : null}
        {status.error ? <p>{status.error}</p> : null}
        {status.ready && !status.downloading && !status.error ? <p>Saved on this device. You can close the app and reopen it offline.</p> : null}
      </div>
      <div className="offline-pack-actions">
        {status.ready ? <a href="/offline" className="focus-ring action-primary">Open offline play</a> : null}
        <button type="button" className="focus-ring action-secondary" disabled={status.downloading} onClick={() => void clientRef.current?.download()}><Download size={15} />{status.ready ? "Update download" : "Download play pack"}</button>
      </div>
    </div>, document.body) : null}
  </div>;
}
