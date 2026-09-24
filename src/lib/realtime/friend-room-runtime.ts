import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { fetchDurableJson } from "./durable-client";
import { transitionFriendRoom, type FriendAction, type FriendRoom } from "./friend-room";

// Development-only storage. Production always requires the existing room binding.
const dev = globalThis as typeof globalThis & { allchessFriendRooms?: Map<string, FriendRoom>; allchessFriendLocks?: Map<string, Promise<unknown>> };
export async function runFriendAction(id: string, action: FriendAction) {
  const env = await getCloudflareRuntimeEnv();
  if (env.GAME_ROOM_DO) {
    const response = await fetchDurableJson(env.GAME_ROOM_DO, `friend-${id}`, `/friends/${id}`, { method: "POST", body: JSON.stringify(action) });
    return Response.json(response!.data, { status: response!.status, headers: { "cache-control": "no-store" } });
  }
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return Response.json({ error: "Friend rooms are unavailable. Please try again later." }, { status: 503 });
  const rooms = dev.allchessFriendRooms ??= new Map();
  const locks = dev.allchessFriendLocks ??= new Map();
  const previous = locks.get(id) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    for (const [key, room] of rooms) if (Date.now() - room.createdAt > 7 * 86400000) rooms.delete(key);
    if (!rooms.has(id) && rooms.size >= 200) return Response.json({ error: "Local room limit reached." }, { status: 503 });
    const result = await transitionFriendRoom(rooms.get(id) ?? null, id, action);
    if (result.stored) rooms.set(id, result.stored); else rooms.delete(id);
    return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  });
  locks.set(id, task);
  try { return await task; } finally { if (locks.get(id) === task) locks.delete(id); }
}
