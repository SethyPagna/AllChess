import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CloudflareEnv } from "@/lib/cloudflare/env";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
const runtime = vi.hoisted(() => ({ env: {} as CloudflareEnv }));
vi.mock("@/lib/cloudflare/runtime", () => ({ getCloudflareRuntimeEnv: async () => runtime.env }));
import { POST as join } from "@/app/api/matchmaking/join/route";
import { POST as leave } from "@/app/api/matchmaking/leave/route";
import { runFriendAction } from "@/lib/realtime/friend-room-runtime";
import { hashSeatToken } from "@/lib/realtime/quick-match";
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const input = { token: a, variantKey: "makruk", timeControlKey: "freestyle" };
const request = (body: unknown, origin?: string) => new Request("http://allchess.test/api/matchmaking/join", { method: "POST", body: JSON.stringify(body), headers: origin ? { origin } : {} });
beforeEach(() => {
  runtime.env = {};
  const local = globalThis as typeof globalThis & { allchessQuickQueues?: Map<string, unknown>; allchessFriendRooms?: Map<string, unknown> };
  local.allchessQuickQueues?.clear(); local.allchessFriendRooms?.clear();
});
afterEach(() => vi.unstubAllEnvs());
describe("Quick Match API", () => {
  test("two concurrent searches share a real reserved room, and retries do not reset moves", async () => {
    const responses = await Promise.all([join(request(input)), join(request({ ...input, token: b }))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const first = await (await join(request(input))).json();
    const second = await (await join(request({ ...input, token: b }))).json();
    expect(first.match.roomId).toBe(second.match.roomId); expect(first.provision).toBeUndefined();
    const id = first.match.roomId;
    const one = await (await runFriendAction(id, { action: "join", token: a })).json();
    const two = await (await runFriendAction(id, { action: "join", token: b })).json();
    expect(one.room.state.status).toBe("waiting"); expect(two.room.state.status).toBe("active");
    const white = one.room.seat === "white" ? a : b;
    const moved = await (await runFriendAction(id, { action: "move", token: white, gameId: two.room.state.id, version: 0, move: { from: { row: 5, col: 0 }, to: { row: 4, col: 0 } } })).json();
    expect(moved.room.state.ply).toBe(1);
    await join(request(input));
    const recovered = await (await runFriendAction(id, { action: "read", token: a })).json();
    expect(recovered.room.state.ply).toBe(1);
    expect(await (await leave(request(input))).json()).toMatchObject({ match: { roomId: id } });
  });
  test("separates games and clocks and confirms cancellation", async () => {
    await join(request(input));
    expect(await (await join(request({ ...input, token: b, timeControlKey: "blitz" }))).json()).toHaveProperty("ticket");
    expect(await (await join(request({ ...input, token: b, variantKey: "classic" }))).json()).toHaveProperty("ticket");
    expect(await (await leave(request(input))).json()).toEqual({ left: true });
    expect((await join(request(input))).status).toBe(410);
  });
  test("rejects invalid credentials, unsupported rules, foreign origins and unverified ratings", async () => {
    for (const body of [{}, { ...input, token: "guess" }, { ...input, rated: true }, { ...input, variantKey: "ouk-chaktrang" }]) expect((await join(request(body))).status).toBe(400);
    expect((await join(request(input, "https://foreign.test"))).status).toBe(403);
  });
  test("production never returns a demo ticket when durable bindings are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await join(request(input))).status).toBe(503);
  });
  test("provisions committed durable matches before exposing a room and strips seat digests", async () => {
    const names: string[] = [], paths: string[] = [];
    let ready = false;
    const plan = { id: "match-durable", variantKey: "makruk", time: "freestyle", createdAt: Date.now(), digests: [await hashSeatToken(a), await hashSeatToken(b)] };
    const namespace = (room: boolean) => ({ idFromName: (name: string) => { names.push(name); return name; }, get: () => ({ fetch: async (url: string) => {
      paths.push(new URL(url).pathname);
      return room ? Response.json({ ready }, { status: ready ? 200 : 503 }) : Response.json({ match: { roomId: plan.id }, provision: plan });
    } }) }) as unknown as DurableObjectNamespace;
    runtime.env = { MATCHMAKING_DO: namespace(false), GAME_ROOM_DO: namespace(true) };
    expect((await join(request(input))).status).toBe(503);
    ready = true;
    const result = await join(request(input));
    expect(await result.json()).toEqual({ match: { roomId: plan.id } });
    expect(names).toContain("casual-v1:makruk:freestyle"); expect(names).toContain("friend-match-durable");
    expect(paths).toContain("/matched-room"); expect(result.headers.get("cache-control")).toBe("no-store");
  });
});
