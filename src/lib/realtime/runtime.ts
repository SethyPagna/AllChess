import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import type { RoomSnapshot } from "@/lib/realtime/types";

export type RuntimeRoomList = {
  mode: "d1" | "demo";
  rooms: RoomSnapshot[];
};

export async function getRuntimeRoomList(limit = 20): Promise<RuntimeRoomList> {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return { mode: "demo", rooms: [] };
  }

  try {
    const rooms = await createD1GameRepository(env.ALLCHESS_D1).listRooms({ visibility: "public", limit });
    return { mode: "d1", rooms };
  } catch {
    return { mode: "demo", rooms: [] };
  }
}
