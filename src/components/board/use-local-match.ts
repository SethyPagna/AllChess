"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalMatchSnapshot } from "@/lib/game/local-match";
import { LocalMatchConflict, writeLocalMatch } from "@/lib/game/local-match-store";

export function useLocalMatch(snapshot: LocalMatchSnapshot | null) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [error, setError] = useState("");
  const latest = useRef<LocalMatchSnapshot | null>(null), pending = useRef<LocalMatchSnapshot | null>(null);
  const revisions = useRef(new Map<string, number>()), blocked = useRef(new Set<string>());
  const busy = useRef(false), mounted = useRef(true), checkpoint = useRef("");
  const pump = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (pending.current) {
      const next = pending.current; pending.current = null;
      if (blocked.current.has(next.state.id)) continue;
      if (mounted.current) setStatus("saving");
      try {
        const revision = await writeLocalMatch(next, revisions.current.get(next.state.id) ?? 0);
        revisions.current.set(next.state.id, revision);
        if (mounted.current) { setStatus("saved"); setError(""); }
      } catch (cause) {
        const conflict = cause instanceof LocalMatchConflict;
        // Do not keep retrying or overwrite another tab's progress.
        blocked.current.add(next.state.id);
        if (mounted.current) {
          setStatus(conflict ? "conflict" : "error");
          setError(conflict ? cause.message : "Saving is unavailable. Check this device’s free storage and try again. Your open board is still playable.");
        }
      }
    }
    busy.current = false;
  }, []);
  const enqueue = useCallback((value: LocalMatchSnapshot) => { pending.current = value; void pump(); }, [pump]);
  const flush = useCallback(() => { if (latest.current) enqueue(latest.current); }, [enqueue]);
  const adopt = useCallback((id: string, revision: number) => {
    revisions.current.set(id, revision); blocked.current.delete(id); checkpoint.current = "";
    setStatus("saved"); setError("");
  }, []);
  const retry = useCallback((value = latest.current) => {
    if (value) { blocked.current.delete(value.state.id); enqueue(value); }
  }, [enqueue]);

  useEffect(() => {
    latest.current = snapshot;
    if (!snapshot) { checkpoint.current = ""; return; }
    // Clock ticks are checkpointed separately; moves, claims, undo/redo and
    // settings changes are written immediately, with the newest full timeline.
    const signature = JSON.stringify([snapshot.state.id, snapshot.state.ply, snapshot.state.status, snapshot.state.result, snapshot.state.variantState, snapshot.history.length, snapshot.future.length, snapshot.settings]);
    if (signature !== checkpoint.current) { checkpoint.current = signature; enqueue(snapshot); }
  }, [snapshot, enqueue]);
  useEffect(() => {
    mounted.current = true;
    const interval = window.setInterval(flush, 5000);
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", hidden);
    return () => { flush(); mounted.current = false; clearInterval(interval); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden); };
  }, [flush]);
  return { status, error, flush, adopt, retry, enqueue };
}
