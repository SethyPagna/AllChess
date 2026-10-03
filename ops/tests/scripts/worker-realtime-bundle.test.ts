import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const offlineShell = '<!doctype html><html lang="km"><head><title>Offline play</title></head><body><main>អុក · Kōnane · ♔</main>'
  + `<script>self.__next_f.push([1,${JSON.stringify(String.raw`first\nquoted "value" and slash\\ and unicode\u1780`)}])</script>`
  + `<script>self.__next_f.push([1,${JSON.stringify("second payload · ក្តារ") }])</script></body></html>`;
let fixture: string;
let worker: Miniflare;

function offlineManifest(shell: string) {
  const assets = [{ url: "/offline", bytes: Buffer.byteLength(shell), sha256: sha256(shell) }];
  return { version: sha256(JSON.stringify(assets)), assets };
}

async function writeOfflineFixture(shell = offlineShell) {
  await mkdir(path.join(fixture, ".next/server/app"), { recursive: true });
  await mkdir(path.join(fixture, "public"), { recursive: true });
  await writeFile(path.join(fixture, ".next/server/app/offline.html"), shell);
  await writeFile(path.join(fixture, "public/offline-pack.json"), JSON.stringify(offlineManifest(shell)));
}

async function loadGeneratedWorker() {
  const bundled = await build({ entryPoints: [path.join(fixture, ".open-next/worker.js")], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  const generated = new Miniflare({
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
  try { await generated.ready; return generated; }
  catch (error) { await generated.dispose(); throw error; }
}

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
  await writeOfflineFixture();
  await run(process.execPath, [patchScript], { cwd: fixture });
  worker = await loadGeneratedWorker();
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
  try {
    await writeFile(entry, legacy);
    await expect(run(process.execPath, [patchScript], { cwd: fixture })).rejects.toThrow("contains legacy realtime stubs");
    expect(await readFile(entry, "utf8")).toBe(legacy);
  } finally { await writeFile(entry, first); }
});

test.each(["/offline", "/offline?game=classic", "/offline?game=konane&locale=km&resume=saved%20game"])("the generated worker serves the exact verified UTF-8 shell at %s", async (route) => {
  const response = await worker.dispatchFetch(`https://allchess.test${route}`, { headers: { "accept-encoding": "identity" } });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/^text\/html\s*;\s*charset=utf-8$/i);
  const body = Buffer.from(await response.arrayBuffer());
  expect(body).toEqual(Buffer.from(offlineShell));
  expect(sha256(body)).toBe(offlineManifest(offlineShell).assets[0].sha256);
  expect(Number(response.headers.get("content-length"))).toBe(Buffer.byteLength(offlineShell));
});

test("the offline shell HEAD response retains its UTF-8 byte length without a body", async () => {
  const response = await worker.dispatchFetch("https://allchess.test/offline?game=classic", { method: "HEAD" });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/^text\/html\s*;\s*charset=utf-8$/i);
  expect(Number(response.headers.get("content-length"))).toBe(Buffer.byteLength(offlineShell));
  expect((await response.arrayBuffer()).byteLength).toBe(0);
});

test("the offline shell keeps exact decoded bytes with the transport's default compression", async () => {
  const response = await worker.dispatchFetch("https://allchess.test/offline");
  expect(response.status).toBe(200);
  const body = Buffer.from(await response.arrayBuffer());
  expect(body).toEqual(Buffer.from(offlineShell));
  expect(body.length).toBe(offlineManifest(offlineShell).assets[0].bytes);
  expect(sha256(body)).toBe(offlineManifest(offlineShell).assets[0].sha256);
});

test.each([
  { route: "/offline?_rsc=probe", method: "GET", headers: { RSC: "1" } },
  { route: "/offline", method: "POST", headers: {} },
  { route: "/en/play", method: "GET", headers: {} },
  { route: "/offline.html", method: "GET", headers: {} }
])("offline interception preserves Next handling for $method $route", async ({ route, method, headers }) => {
  const response = await worker.dispatchFetch(`https://allchess.test${route}`, { method, headers });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ next: new URL(route, "https://allchess.test").pathname });
});

test.each(["invalid-json", "missing-manifest", "missing-entry", "wrong-length", "wrong-sha", "missing-shell"])("offline generation rejects %s and preserves the prior Worker and module", async (fault) => {
  const entry = path.join(fixture, ".open-next/worker.js");
  const shellModulePath = path.join(fixture, ".open-next/offline-shell.js");
  const manifestPath = path.join(fixture, "public/offline-pack.json");
  const beforeEntry = await readFile(entry, "utf8");
  const beforeModule = existsSync(shellModulePath) ? await readFile(shellModulePath, "utf8") : null;
  try {
    const manifest = offlineManifest(offlineShell);
    if (fault === "invalid-json") await writeFile(manifestPath, "{");
    else if (fault === "missing-manifest") await rm(manifestPath);
    else if (fault === "missing-shell") await rm(path.join(fixture, ".next/server/app/offline.html"));
    else {
      if (fault === "missing-entry") manifest.assets = [];
      if (fault === "wrong-length") manifest.assets[0].bytes += 1;
      if (fault === "wrong-sha") manifest.assets[0].sha256 = sha256("different shell");
      manifest.version = sha256(JSON.stringify(manifest.assets));
      await writeFile(manifestPath, JSON.stringify(manifest));
    }
    await expect(run(process.execPath, [patchScript], { cwd: fixture })).rejects.toThrow();
    expect(await readFile(entry, "utf8")).toBe(beforeEntry);
    expect(beforeModule).not.toBeNull();
    expect(await readFile(shellModulePath, "utf8")).toBe(beforeModule);
  } finally {
    await writeOfflineFixture();
    await writeFile(entry, beforeEntry);
    if (beforeModule !== null) await writeFile(shellModulePath, beforeModule);
    else await rm(shellModulePath, { force: true });
  }
});

test("offline generation is repeatable and a new verified build refreshes the served shell", async () => {
  const entry = path.join(fixture, ".open-next/worker.js");
  const shellModulePath = path.join(fixture, ".open-next/offline-shell.js");
  const beforeEntry = await readFile(entry, "utf8");
  const beforeModule = existsSync(shellModulePath) ? await readFile(shellModulePath, "utf8") : null;
  let refreshed: Miniflare | undefined;
  try {
    await run(process.execPath, [patchScript], { cwd: fixture });
    expect(await readFile(entry, "utf8")).toBe(beforeEntry);
    expect(existsSync(shellModulePath)).toBe(true);
    expect(await readFile(shellModulePath, "utf8")).toBe(beforeModule);
    const changedShell = offlineShell.replace("អុក · Kōnane", "កំណែថ្មី · Shōgi");
    await writeOfflineFixture(changedShell);
    await run(process.execPath, [patchScript], { cwd: fixture });
    expect(await readFile(entry, "utf8")).toBe(beforeEntry);
    const changedModule = await readFile(shellModulePath, "utf8");
    expect(changedModule).not.toBe(beforeModule);
    refreshed = await loadGeneratedWorker();
    const response = await refreshed.dispatchFetch("https://allchess.test/offline?game=shogi", { headers: { "accept-encoding": "identity" } });
    expect(response.status).toBe(200);
    const body = Buffer.from(await response.arrayBuffer());
    expect(body).toEqual(Buffer.from(changedShell));
    expect(sha256(body)).toBe(offlineManifest(changedShell).assets[0].sha256);
    expect(Number(response.headers.get("content-length"))).toBe(Buffer.byteLength(changedShell));
    await run(process.execPath, [patchScript], { cwd: fixture });
    expect(await readFile(entry, "utf8")).toBe(beforeEntry);
    expect(await readFile(shellModulePath, "utf8")).toBe(changedModule);
  } finally {
    await refreshed?.dispose();
    await writeOfflineFixture();
    await writeFile(entry, beforeEntry);
    if (beforeModule !== null) await writeFile(shellModulePath, beforeModule);
    else await rm(shellModulePath, { force: true });
  }
});
