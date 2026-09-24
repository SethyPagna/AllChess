"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendAction, FriendRoomView } from "@/lib/realtime/friend-room";

export const friendTokenKey = (id: string) => `allchess-room-seat:${id}`;
const sessionTokens = new Map<string, string>();
export function saveFriendToken(id: string, token: string) { sessionTokens.set(id, token); try { localStorage.setItem(friendTokenKey(id), token); } catch { /* Session remains playable. */ } }
function getToken(id: string) { let token = sessionTokens.get(id); try { token ??= localStorage.getItem(friendTokenKey(id)) ?? undefined; } catch { /* Session fallback. */ } if (!token) token = crypto.randomUUID() + crypto.randomUUID(); saveFriendToken(id, token); return token; }

export function useFriendRoom(id: string | null, enabled: boolean, spectating: boolean, onSnapshot: (room: FriendRoomView) => void) {
  const [room, setRoom] = useState<FriendRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const callback = useRef(onSnapshot);
  const generation = useRef(0);
  const accepted = useRef<FriendRoomView | null>(null);
  const receive = useCallback((snapshot: FriendRoomView) => {
    if (accepted.current?.roomId === snapshot.roomId && accepted.current.revision > snapshot.revision) return;
    accepted.current = snapshot;
    setRoom(snapshot);
    callback.current(snapshot);
  }, []);
  useEffect(() => { callback.current = onSnapshot; }, [onSnapshot]);
  useEffect(() => {
    const run = ++generation.current;
    if (!id || !enabled) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const token = getToken(id);
    let joined = spectating;
    async function poll() {
      try {
        const response = await fetch(`/api/friends/rooms/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: joined ? "read" : "join", ...(spectating ? {} : { token }) }), signal: controller.signal });
        const data = await response.json() as { room?: FriendRoomView; error?: string };
        if (cancelled || run !== generation.current) return;
        if (!response.ok || !data.room) { setError(data.error ?? "Unable to connect."); }
        else { joined = true; receive(data.room); setError(null); }
      } catch { if (!cancelled) setError("Connection interrupted. Reconnecting…"); }
      finally { if (!cancelled) timer = setTimeout(poll, 1200); }
    }
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [id, enabled, spectating, receive]);
  async function send(action: Omit<Extract<FriendAction, { action: "move" }>, "token"> | { action: "resign" | "draw" } | { action: "chat"; text: string }) {
    if (!id || !enabled || spectating || pending.current) return false;
    pending.current = true; setBusy(true); const run = generation.current;
    try {
      const response = await fetch(`/api/friends/rooms/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...action, token: getToken(id) }) });
      const data = await response.json() as { room?: FriendRoomView; error?: string };
      if (run !== generation.current) return false;
      if (!response.ok || !data.room) { setError(data.error ?? "Could not send move."); return false; }
      else { receive(data.room); setError(null); return true; }
    } catch { if (run === generation.current) setError("Could not send. The board will refresh when reconnected."); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  return { room: room?.roomId === id ? room : null, error, busy, send };
}
