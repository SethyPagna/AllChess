import { createD1GameRepository, type RoomListInput, type RoomListSort, type RoomListStatusFilter } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createDemoLiveStats } from "@/lib/realtime/rooms";
import type { LiveStats, RoomSnapshot } from "@/lib/realtime/types";

export type RuntimeRoomList = {
  mode: "d1" | "demo";
  rooms: RoomSnapshot[];
  filters: { limit: number; query: string; sort: RoomListSort; status: RoomListStatusFilter };
};

export function normalizeRoomListInput(input: number | RoomListInput = {}): RoomListInput {
  if (typeof input === "number") {
    return { limit: normalizeRoomLimit(input) };
  }

  return {
    ...input,
    limit: normalizeRoomLimit(input.limit),
    query: normalizeRoomQuery(input.query),
    sort: input.sort === "spectators" ? "spectators" : "recent",
    status: input.status === "active" || input.status === "waiting" ? input.status : "all"
  };
}

export async function getRuntimeRoomList(input: number | RoomListInput = {}): Promise<RuntimeRoomList> {
  const filters = normalizeRoomListInput(input);
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return { mode: "demo", rooms: [], filters: roomListResponseFilters(filters) };
  }

  try {
    const rooms = await createD1GameRepository(env.ALLCHESS_D1).listRooms({ ...filters, visibility: "public" });
    return { mode: "d1", rooms, filters: roomListResponseFilters(filters) };
  } catch {
    return { mode: "demo", rooms: [], filters: roomListResponseFilters(filters) };
  }
}

export async function getRuntimeLiveStats(): Promise<LiveStats> {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return createDemoLiveStats();
  }

  try {
    return await createD1GameRepository(env.ALLCHESS_D1).getLiveStats();
  } catch {
    return createDemoLiveStats();
  }
}

function normalizeRoomLimit(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(value, 50)) : 20;
}

function normalizeRoomQuery(value: string | undefined) {
  return (value ?? "").trim().slice(0, 80);
}

function roomListResponseFilters(input: RoomListInput) {
  return {
    limit: input.limit ?? 20,
    query: input.query ?? "",
    sort: input.sort ?? "recent",
    status: input.status ?? "all"
  };
}
