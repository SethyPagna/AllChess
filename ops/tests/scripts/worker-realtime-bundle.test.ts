import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { FriendRoomView } from "@/lib/realtime/friend-room";
import type { MatchedRoomPlan } from "@/lib/realtime/quick-match";

const run = promisify(execFile);
const patchScript = path.join(process.cwd(), "ops/scripts/ops/deploy/patch-opennext-worker.ts");
const host = "11111111-1111-4111-8111-111111111111";
const guest = "22222222-2222-4222-8222-222222222222";
const spectator = "33333333-3333-4333-8333-333333333333";
const move = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
let fixture: string;
let worker: Miniflare;

beforeAll(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "allchess-opennext-test-"));
  const server = path.join(fixture, ".open-next/server-functions/default/.next/server");
  await mkdir(server, { recursive: true });
  await writeFile(path.join(server, "probe.js"), "export const probe = true;");
  const entry = path.join(fixture, ".open-next/worker.js");
  const adapterTemplate = path.join(process.cwd(), "node_modules/@opennextjs/cloudflare/dist/cli/templates/worker.js");
  await writeFile(entry, await readFile(adapterTemplate));
  const nextFixtures = {
    "cloudflare/images.js": "export const handleCdnCgiImageRequest = () => new Response(); export const handleImageRequest = () => new Response();",
    "cloudflare/init.js": "export const runWithCloudflareRequestContext = (request, env, ctx, run) => run();",
    "cloudflare/skew-protection.js": "export const maybeGetSkewProtectionResponse = () => null;",
    "middleware/handler.mjs": "export const handler = request => request;",
    ".build/durable-objects/queue.js": "export class DOQueueHandler {}",
    ".build/durable-objects/sharded-tag-cache.js": "export class DOShardedTagCache {}",
    ".build/durable-objects/bucket-cache-purge.js": "export class BucketCachePurge {}",
    "server-functions/default/handler.mjs": "export const handler = request => Response.json({ next: new URL(request.url).pathname });"
  };
  for (const [relative, source] of Object.entries(nextFixtures)) {
    const output = path.join(fixture, ".open-next", relative);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, source);
  }
  await run(process.execPath, [patchScript], { cwd: fixture });
  const bundled = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  worker = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-05-13",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      GAME_ROOM_DO: { className: "GameRoomDO", useSQLite: true },
      MATCHMAKING_DO: { className: "MatchmakingDO", useSQLite: true },
      PRESENCE_DO: { className: "PresenceDO", useSQLite: true }
    }
  });
  await worker.ready;
}, 30_000);

afterAll(async () => {
  await worker?.dispose();
  if (fixture && path.dirname(fixture) === tmpdir() && path.basename(fixture).startsWith("allchess-opennext-test-")) {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("the generated room object creates, joins and moves with seat authority", async () => {
  const rooms = await worker.getDurableObjectNamespace("GAME_ROOM_DO");
  const room = rooms.get(rooms.idFromName("friend-created"));
  const url = "https://allchess.internal/friends/created";
  const created = await room.fetch(url, post({ action: "create", token: host, variantKey: "classic", time: "classical", side: "first" }));
  expect(created.status).toBe(200);
  expect(await created.json()).toMatchObject({ room: { seat: "white", state: { status: "waiting" } } });
  const joined = await room.fetch(url, post({ action: "join", token: guest }));
  const { room: joinedRoom } = await joined.json() as { room: FriendRoomView };
  expect(joinedRoom).toMatchObject({ seat: "black", state: { status: "active" } });
  const action = { action: "move", token: host, gameId: joinedRoom.state.id, version: 0, move };
  expect((await room.fetch(url, post({ ...action, token: spectator }))).status).toBe(403);
  expect((await room.fetch(url, post({ ...action, token: guest }))).status).toBe(403);
  const moved = await room.fetch(url, post(action));
  expect(moved.status).toBe(200);
  expect(await moved.json()).toMatchObject({ room: { state: { ply: 1, turn: "black" } } });
  expect((await room.fetch(url, post(action))).status).toBe(409);
});

test("the generated matchmaking object provisions a playable room with reserved seats", async () => {
  const queues = await worker.getDurableObjectNamespace("MATCHMAKING_DO");
  const queue = queues.get(queues.idFromName("casual-v1:classic:rapid"));
  const input = { token: host, variantKey: "classic", timeControlKey: "rapid", rated: false };
  const first = await queue.fetch("https://allchess.internal/matchmaking/join", post(input));
  expect(await first.json()).toMatchObject({ ticket: { ticketId: expect.any(String) } });
  const second = await queue.fetch("https://allchess.internal/matchmaking/join", post({ ...input, token: guest }));
  const matched = await second.json() as { match: { roomId: string }; provision: MatchedRoomPlan };
  expect(matched.provision?.id).toBe(matched.match?.roomId);
  expect(matched.provision?.digests).toHaveLength(2);
  const rooms = await worker.getDurableObjectNamespace("GAME_ROOM_DO");
  const room = rooms.get(rooms.idFromName(`friend-${matched.provision.id}`));
  expect((await room.fetch("https://allchess.internal/matched-room", post(matched.provision))).status).toBe(200);
  const url = `https://allchess.internal/friends/${matched.provision.id}`;
  expect((await room.fetch(url, post({ action: "join", token: spectator }))).status).toBe(409);
  const joinedHost = await room.fetch(url, post({ action: "join", token: host }));
  const hostView = await joinedHost.json() as { room: FriendRoomView };
  const joinedGuest = await room.fetch(url, post({ action: "join", token: guest }));
  const guestView = await joinedGuest.json() as { room: FriendRoomView };
  expect(guestView.room.state.status).toBe("active");
  expect(guestView.room.seat).not.toBe(hostView.room.seat);
  const moved = await room.fetch(url, post({ action: "move", token: hostView.room.seat === "white" ? host : guest, gameId: guestView.room.state.id, version: 0, move }));
  expect(moved.status).toBe(200);
  expect((await room.fetch("https://allchess.internal/matched-room", post(matched.provision))).status).toBe(200);
  const read = await room.fetch(url, post({ action: "read" }));
  expect(await read.json()).toMatchObject({ room: { state: { ply: 1 } } });
});

test("the generated worker retains production legacy retirement and the socket bridge", async () => {
  const rooms = await worker.getDurableObjectNamespace("GAME_ROOM_DO");
  const room = rooms.get(rooms.idFromName("legacy"));
  const response = await room.fetch("https://allchess.internal/rooms/legacy/move", post({ move, expectedMoveVersion: 0 }));
  expect(response.status).toBe(410);
  expect((await worker.dispatchFetch("https://allchess.test/api/rooms/legacy/socket")).status).toBe(426);
  const upgrade = await worker.dispatchFetch("https://allchess.test/api/rooms/legacy/socket", { headers: { upgrade: "websocket" } });
  expect(upgrade.status).toBe(101);
  const socket = upgrade.webSocket!;
  const nextMessage = () => new Promise<unknown>(resolve => socket.addEventListener("message", event => resolve(JSON.parse(String(event.data))), { once: true }));
  const snapshot = nextMessage();
  socket.accept();
  expect(await snapshot).toMatchObject({ type: "room_snapshot", snapshot: { moveVersion: 0 } });
  const rejected = nextMessage();
  socket.send(JSON.stringify({ type: "make_move", roomId: "legacy", expectedMoveVersion: 0, move }));
  expect(await rejected).toMatchObject({ type: "move_rejected", reason: expect.stringContaining("retired"), expectedMoveVersion: 0 });
  socket.close();
});

test("the generated worker preserves Next handling, presence exports and repeatable patching", async () => {
  expect(await (await worker.dispatchFetch("https://allchess.test/en/play")).json()).toEqual({ next: "/en/play" });
  const presence = await worker.getDurableObjectNamespace("PRESENCE_DO");
  const response = await presence.get(presence.idFromName("global")).fetch("https://allchess.internal/presence");
  expect(await response.json()).toMatchObject({ source: "durable-object" });
  const entry = path.join(fixture, ".open-next/worker.js");
  const first = await readFile(entry, "utf8");
  await run(process.execPath, [patchScript], { cwd: fixture });
  expect(await readFile(entry, "utf8")).toBe(first);
  expect(await readFile(path.join(fixture, ".open-next/server-functions/default/server/probe.js"), "utf8")).toContain("probe = true");
  const legacy = "export class GameRoomDO extends DurableObject {}";
  await writeFile(entry, legacy);
  await expect(run(process.execPath, [patchScript], { cwd: fixture })).rejects.toThrow("contains legacy realtime stubs");
  expect(await readFile(entry, "utf8")).toBe(legacy);
});

