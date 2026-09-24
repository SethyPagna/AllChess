"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Offline navigation needs a document request, not an uncached RSC fetch. */

import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Check, WifiOff } from "lucide-react";

type PackStatus = { ready: boolean; downloading?: boolean; completed?: number; total?: number; error?: string };

export function OfflinePack() {
  const [status, setStatus] = useState<PackStatus>({ ready: false });
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const readStatus = () => { void navigator.serviceWorker.ready.then(registration => {
      if (cancelled) return;
      setAvailable(true);
      portRef.current?.close();
      const channel = new MessageChannel(); portRef.current = channel.port1;
      channel.port1.onmessage = event => { if (!cancelled) setStatus(event.data); };
      registration.active?.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    }).catch(() => undefined); };
    void navigator.serviceWorker.register("/sw.js").then(readStatus).catch(() => undefined);
    navigator.serviceWorker.addEventListener("controllerchange", readStatus);
    return () => { cancelled = true; portRef.current?.close(); navigator.serviceWorker.removeEventListener("controllerchange", readStatus); };
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

  async function download() {
    setStatus(current => ({ ...current, downloading: true, completed: 0, total: 0, error: undefined }));
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("The app is still preparing. Try again.");
      portRef.current?.close();
      const channel = new MessageChannel(); portRef.current = channel.port1;
      channel.port1.onmessage = event => setStatus(event.data);
      registration.active.postMessage({ type: "DOWNLOAD_OFFLINE" }, [channel.port2]);
    } catch {
      setStatus(current => ({ ...current, downloading: false, error: "Could not save the play pack. Reconnect and try again." }));
    }
  }

  if (!available) return null;
  return <div className="offline-pack" ref={containerRef}>
    <button ref={toggleRef} type="button" className="focus-ring action-secondary offline-pack-toggle" aria-expanded={open} aria-controls={panelId} aria-label="Offline play pack" onClick={() => setOpen(value => !value)}>
      {status.ready ? <Check size={17} /> : <WifiOff size={17} />}<span>{status.ready ? "Offline ready" : "Play offline"}</span>
    </button>
    {open ? createPortal(<div id={panelId} ref={panelRef} className="offline-pack-panel">
      <strong>Take your boards with you</strong>
      <p>Save local games, bots, and 3D sets on this device. About 25 MB. Your browser may clear this download if storage runs low.</p>
      <div role="status" aria-live="polite">
        {status.downloading ? <><progress value={status.completed || 0} max={status.total || 1} /><span>Saving play pack… {status.total ? `${Math.round((status.completed || 0) / status.total * 100)}%` : ""}</span></> : null}
        {status.error ? <p>{status.error}</p> : null}
        {status.ready && !status.downloading ? <p>Saved on this device. You can close the app and reopen it offline.</p> : null}
      </div>
      <div className="offline-pack-actions">
        {status.ready ? <a href="/offline" className="focus-ring action-primary">Open offline play</a> : null}
        <button type="button" className="focus-ring action-secondary" disabled={status.downloading} onClick={() => void download()}><Download size={15} />{status.ready ? "Update download" : "Download play pack"}</button>
      </div>
    </div>, document.body) : null}
  </div>;
}
