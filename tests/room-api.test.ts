import { describe, expect, test, vi } from "vitest";

import { createInitialState } from "@/lib/variants";
import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

function createRoomApiD1(roomId: string) {
  const state = createInitialState("classic", "room-game");
  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (!sql.includes("from rooms r")) return null;
              return {
                room_id: roomId,
                game_id: state.id,
                variant_key: state.variantKey,
                status: "active",
                spectator_count: 2,
                rated: 1,
                chat_policy: "players",
                board_state: JSON.stringify(state)
              };
            },
            async all() {
              if (sql.includes("from rooms r")) {
                return {
                  results: [
                    {
                      room_id: roomId,
                      game_id: state.id,
                      variant_key: state.variantKey,
                      status: "active",
                      spectator_count: 2,
                      rated: 1,
                      chat_policy: "players",
                      board_state: JSON.stringify(state)
                    }
                  ]
                };
              }
              if (!sql.includes("from game_participants")) return { results: [] };
              return {
                results: [
                  { profile_id: "p1", participant_type: "user", seat: "white", display_name: "Player 1", connected: 1, rating_at_start: 1200 },
                  { profile_id: "p2", participant_type: "user", seat: "black", display_name: "Player 2", connected: 0, rating_at_start: 1200 }
                ]
              };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return db;
}

describe("room API", () => {
  test("returns persisted D1 room snapshots when D1 is configured", async () => {
    runtime.env = { ALLCHESS_D1: createRoomApiD1("room-1") };
    const { GET } = await import("@/app/api/rooms/[id]/route");

    const response = await GET(new Request("http://allchess.test/api/rooms/room-1"), { params: Promise.resolve({ id: "room-1" }) });

    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      snapshot: {
        roomId: "room-1",
        gameId: "room-game",
        variantKey: "classic",
        spectators: 2,
        rated: true,
        players: [
          { profileId: "p1", displayName: "Player 1", color: "white", connected: true },
          { profileId: "p2", displayName: "Player 2", color: "black", connected: false }
        ]
      }
    });
  });

  test("returns public room lists from D1", async () => {
    runtime.env = { ALLCHESS_D1: createRoomApiD1("room-1") };
    const { GET } = await import("@/app/api/rooms/route");

    const response = await GET(new Request("http://allchess.test/api/rooms?limit=5"));

    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      rooms: [
        {
          roomId: "room-1",
          gameId: "room-game",
          variantKey: "classic",
          spectators: 2
        }
      ]
    });
  });
});
