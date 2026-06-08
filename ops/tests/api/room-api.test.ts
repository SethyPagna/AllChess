import { describe, expect, test, vi } from "vitest";

import { createInitialState } from "@/lib/variants";
import type { D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database; GAME_ROOM_DO?: DurableObjectNamespace }
}));
const roomApiTestTimeoutMs = 15_000;

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
            },
            async run() {
              return {};
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return db;
}

function createRoomMoveDurableObject() {
  return {
    idFromName(name: string) {
      return name;
    },
    get(name: string) {
      return {
        async fetch(url: string, init?: RequestInit) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { expectedMoveVersion?: number; move?: unknown };
          if (body.expectedMoveVersion !== 0) {
            return Response.json({ type: "move_rejected", reason: "Stale move.", expectedMoveVersion: 0 }, { status: 409 });
          }
          return Response.json({
            type: "move_applied",
            snapshot: { roomId: name, moveVersion: 1 },
            move: body.move,
            href: url
          });
        }
      };
    }
  } as unknown as DurableObjectNamespace;
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
  }, roomApiTestTimeoutMs);

  test("returns public room lists from D1", async () => {
    runtime.env = { ALLCHESS_D1: createRoomApiD1("room-1") };
    const { GET } = await import("@/app/api/rooms/route");

    const response = await GET(new Request("http://allchess.test/api/rooms?limit=5&q=classic&status=active&sort=spectators"));

    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      filters: {
        limit: 5,
        query: "classic",
        sort: "spectators",
        status: "active"
      },
      rooms: [
        {
          roomId: "room-1",
          gameId: "room-game",
          variantKey: "classic",
          spectators: 2
        }
      ]
    });
  }, roomApiTestTimeoutMs);

  test("applies legal room moves against persisted D1 room state", async () => {
    runtime.env = { ALLCHESS_D1: createRoomApiD1("room-1") };
    const { POST } = await import("@/app/api/rooms/[id]/move/route");

    const response = await POST(
      new Request("http://allchess.test/api/rooms/room-1/move", {
        method: "POST",
        body: JSON.stringify({ expectedMoveVersion: 0, move: { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } } })
      }),
      { params: Promise.resolve({ id: "room-1" }) }
    );

    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      type: "move_applied",
      snapshot: {
        roomId: "room-1",
        moveVersion: 1,
        state: {
          ply: 1
        }
      }
    });
  }, roomApiTestTimeoutMs);

  test("rejects stale D1 room move transmissions", async () => {
    runtime.env = { ALLCHESS_D1: createRoomApiD1("room-1") };
    const { POST } = await import("@/app/api/rooms/[id]/move/route");

    const response = await POST(
      new Request("http://allchess.test/api/rooms/room-1/move", {
        method: "POST",
        body: JSON.stringify({ expectedMoveVersion: 3, move: { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } } })
      }),
      { params: Promise.resolve({ id: "room-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      type: "move_rejected",
      expectedMoveVersion: 0
    });
  }, roomApiTestTimeoutMs);

  test("uses durable room coordination when no D1 room snapshot exists", async () => {
    runtime.env = { GAME_ROOM_DO: createRoomMoveDurableObject() };
    const { POST } = await import("@/app/api/rooms/[id]/move/route");

    const response = await POST(
      new Request("http://allchess.test/api/rooms/live-room/move", {
        method: "POST",
        body: JSON.stringify({ expectedMoveVersion: 0, move: { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } } })
      }),
      { params: Promise.resolve({ id: "live-room" }) }
    );

    await expect(response.json()).resolves.toMatchObject({
      mode: "durable-object",
      type: "move_applied",
      snapshot: {
        roomId: "live-room",
        moveVersion: 1
      }
    });
  }, roomApiTestTimeoutMs);
});
