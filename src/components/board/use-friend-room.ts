"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendAction, FriendRoomView } from "@/lib/realtime/friend-room";

export const friendTokenKey = (id: string) => `allchess-room-seat:${id}`;
const sessionTokens = new Map<string, string>();
export function saveFriendToken(id: string, token: string) { sessionTokens.set(id, token); try { localStorage.setItem(friendTokenKey(id), token); } catch { /* Session remains playable. */ } }
function getToken(id: string) { let token = sessionTokens.get(id); try { token ??= localStorage.getItem(friendTokenKey(id)) ?? undefined; } catch { /* Session fallback. */ } if (!token) token = crypto.randomUUID() + crypto.randomUUID(); saveFriendToken(id, token); return token; }

type Connection = "connecting" | "connected" | "reconnecting" | "offline" | "unavailable";
type WithoutCredentials<T> = T extends { token: string } ? Omit<T, "token"> : never;
type SendAction = WithoutCredentials<Extract<FriendAction, { action: "move" | "resign" | "draw" | "chat" | "rematch" | "cancel-rematch" }>>;

export function useFriendRoom(id: string | null, enabled: boolean, spectating: boolean, onSnapshot: (room: FriendRoomView) => void) {
  const [room, setRoom] = useState<FriendRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [retry, setRetry] = useState(0);
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
    let cancelled = false, inFlight = false, terminal = false, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const token = getToken(id);
    let joined = spectating;
    queueMicrotask(() => { if (!cancelled) { setConnection(navigator.onLine ? "connecting" : "offline"); setError(null); } });
    async function poll() {
      if (cancelled || inFlight || terminal) return;
      clearTimeout(timer);
      if (!navigator.onLine) { setConnection("offline"); return; }
      inFlight = true;
      try {
        const response = await fetch(`/api/friends/rooms/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: joined ? "read" : "join", ...(spectating ? {} : { token }) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        const data = await response.json() as { room?: FriendRoomView; error?: string };
        if (cancelled || run !== generation.current) return;
        if (!response.ok || !data.room) {
          failures++;
          terminal = [400, 403, 404, 409, 410].includes(response.status);
          setConnection(terminal ? "unavailable" : "reconnecting");
          setError(data.error ?? "Unable to connect.");
        } else { joined = true; failures = 0; receive(data.room); setConnection("connected"); setError(null); }
      } catch {
        failures++;
        if (!cancelled && run === generation.current) setConnection(navigator.onLine ? "reconnecting" : "offline");
      } finally {
        inFlight = false;
        if (!cancelled && !terminal) timer = setTimeout(poll, Math.min(10000, 1200 * 2 ** Math.min(failures, 4)));
      }
    }
    const offline = () => setConnection("offline");
    const online = () => { setConnection("reconnecting"); void poll(); };
    const focus = () => { if (document.visibilityState === "visible") void poll(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", focus);
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); window.removeEventListener("offline", offline); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", focus); };
  }, [id, enabled, spectating, receive, retry]);
  async function send(action: SendAction) {
    const snapshot = accepted.current;
    if (!id || !enabled || spectating || pending.current || connection !== "connected" || snapshot?.roomId !== id) return false;
    pending.current = true; setBusy(true); const run = generation.current;
    try {
      const response = await fetch(`/api/friends/rooms/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...action, token: getToken(id) }), signal: AbortSignal.timeout(8000) });
      const data = await response.json() as { room?: FriendRoomView; error?: string };
      if (run !== generation.current) return false;
      if (!response.ok || !data.room) { setError(data.error ?? "Could not send. Your board will refresh."); return false; }
      receive(data.room); setError(null); return true;
    } catch {
      if (run === generation.current) { setConnection(navigator.onLine ? "reconnecting" : "offline"); setError("Send not confirmed. Reconnecting to check the board."); }
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  return { room: room?.roomId === id ? room : null, error, connection, busy, send, reconnect: () => setRetry(value => value + 1) };
}
