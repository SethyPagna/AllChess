import { afterEach, describe, expect, test, vi } from "vitest";
import type { D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";

import { createInitialState } from "@/lib/variants";

const runtime = vi.hoisted(() => ({ env: {} as { ALLCHESS_D1?: D1Database; GAME_ROOM_DO?: DurableObjectNamespace } }));
vi.mock("@/lib/cloudflare/runtime", () => ({ getCloudflareRuntimeEnv: async () => runtime.env }));
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(readonly ctx: unknown, readonly env: unknown) {}
  }
}));

const e2e4 = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };
const post = (path: string, body: unknown) => new Request(`http://allchess.test${path}`, { method: "POST", body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A D1 stand-in holding one public room; it records every statement it is asked to prepare. */
function roomD1() {
  const state = createInitialState("classic", "room-game");
  const row = { room_id: "room-1", game_id: state.id, variant_key: "classic", status: "active", spectator_count: 0, rated: 0, chat_policy: "players", board_state: JSON.stringify(state) };
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      const bound = {
        first: async () => (sql.includes("from rooms r") ? row : sql.includes("select board_state from games") ? { board_state: row.board_state } : null),
        all: async () => ({ results: sql.includes("from rooms r") ? [row] : [] }),
        run: async () => ({ success: true })
      };
      return { ...bound, bind: () => bound };
    }
  } as unknown as D1Database;
  return { db, statements, writes: () => statements.filter(sql => /^\s*(insert|update|delete)/i.test(sql)) };
}

function roomNamespace() {
  const calls: string[] = [];
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async (url: string) => { calls.push(url); return Response.json({ type: "move_applied" }); } })
  } as unknown as DurableObjectNamespace;
  return { namespace, calls };
}

function doStorage() {
  const values = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
    delete: async (key: string) => values.delete(key),
    setAlarm: async () => undefined
  };
  return { ctx: { storage, blockConcurrencyWhile: <T>(run: () => Promise<T>) => run() }, values };
}

type SocketHandler = { handleSocketMessage(server: { send(data: string): void }, data: unknown, variantKey: string, roomId?: string): Promise<void> };
type RoomObject = { fetch(request: Request): Promise<Response> } & SocketHandler;

afterEach(() => {
  vi.unstubAllEnvs();
  runtime.env = {};
});

describe("legacy room and game writes in production", () => {
  test("room and game creation and moves are retired before touching D1 or the room object", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const d1 = roomD1(), durable = roomNamespace();
    runtime.env = { ALLCHESS_D1: d1.db, GAME_ROOM_DO: durable.namespace };
    const rooms = await import("@/app/api/rooms/route");
    const roomMove = await import("@/app/api/rooms/[id]/move/route");
    const games = await import("@/app/api/games/route");
    const gameMove = await import("@/app/api/games/[id]/move/route");

    const responses = [
      await rooms.POST(post("/api/rooms", { variantKey: "classic" })),
      await roomMove.POST(post("/api/rooms/room-1/move", { expectedMoveVersion: 0, move: e2e4 }), params("room-1")),
      await roomMove.POST(post("/api/rooms/live-room/move", { expectedMoveVersion: 0, move: e2e4 }), params("live-room")),
      await games.POST(post("/api/games", { variantKey: "classic" })),
      await gameMove.POST(post("/api/games/room-game/move", { expectedPly: 0, move: e2e4 }), params("room-game"))
    ];
    for (const response of responses) {
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toEqual({ error: expect.stringContaining("friend room") });
    }
    expect(d1.statements).toEqual([]);
    expect(durable.calls).toEqual([]);
  });

  test("room reads keep working so the Watch list still renders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const d1 = roomD1();
    runtime.env = { ALLCHESS_D1: d1.db };
    const rooms = await import("@/app/api/rooms/route");
    const room = await import("@/app/api/rooms/[id]/route");

    const list = await rooms.GET(new Request("http://allchess.test/api/rooms?limit=5"));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ mode: "d1", rooms: [{ roomId: "room-1", moveVersion: 0 }] });
    const snapshot = await room.GET(new Request("http://allchess.test/api/rooms/room-1"), params("room-1"));
    expect(snapshot.status).toBe(200);
    await expect(snapshot.json()).resolves.toMatchObject({ mode: "d1", snapshot: { roomId: "room-1", state: { ply: 0 } } });
    expect(d1.writes()).toEqual([]);
  });

  test("local development can still drive the legacy move route", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const d1 = roomD1();
    runtime.env = { ALLCHESS_D1: d1.db };
    const roomMove = await import("@/app/api/rooms/[id]/move/route");

    const response = await roomMove.POST(post("/api/rooms/room-1/move", { expectedMoveVersion: 0, move: e2e4 }), params("room-1"));
    await expect(response.json()).resolves.toMatchObject({ type: "move_applied", snapshot: { moveVersion: 1 } });
  });
});

describe("GameRoomDO legacy moves in production", () => {
  const makeMove = { type: "make_move", roomId: "room-1", move: e2e4, expectedMoveVersion: 0 };

  test("the source room object rejects HTTP and socket moves", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { ctx, values } = doStorage();
    const { GameRoomDO } = await import("@/lib/realtime/durable-objects");
    const room = new GameRoomDO(ctx as never, {}) as unknown as RoomObject;

    const response = await room.fetch(new Request("https://allchess.internal/rooms/room-1/move", { method: "POST", body: JSON.stringify(makeMove) }));
    expect(response.status).toBe(410);
    const sent: string[] = [];
    await room.handleSocketMessage({ send: data => { sent.push(data); } }, JSON.stringify(makeMove), "classic", "room-1");
    expect(sent.map(data => JSON.parse(data))).toEqual([expect.objectContaining({ type: "move_rejected", reason: expect.stringContaining("friend room") })]);
    expect((values.get("snapshot") as { moveVersion?: number } | undefined)?.moveVersion ?? 0).toBe(0);
  });

  test("the source room object still applies moves in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { ctx } = doStorage();
    const { GameRoomDO } = await import("@/lib/realtime/durable-objects");
    const room = new GameRoomDO(ctx as never, {});

    const response = await room.fetch(new Request("https://allchess.internal/rooms/room-1/move", { method: "POST", body: JSON.stringify(makeMove) }));
    await expect(response.json()).resolves.toMatchObject({ type: "move_applied", snapshot: { moveVersion: 1 } });
  });
});
