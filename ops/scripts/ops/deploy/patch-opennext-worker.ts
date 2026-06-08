import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const openNextDir = path.join(process.cwd(), ".open-next");
const workerPath = path.join(openNextDir, "worker.js");
const exportMarker = "export class GameRoomDO extends DurableObject";
const durableObjectExports = `
import { DurableObject } from "cloudflare:workers";

function allchessDoJson(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

function allchessRoomSnapshot(variantKey = "classic") {
  return {
    roomId: crypto.randomUUID(),
    gameId: crypto.randomUUID(),
    variantKey,
    status: "waiting",
    players: [],
    spectators: 0,
    clocks: {},
    state: null,
    moveVersion: 0,
    rated: false,
    chatPolicy: "players"
  };
}

function allchessRoomIdFromPath(pathname) {
  const match = pathname.match(/\\/rooms\\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function allchessRoomSocketRequest(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\\/api\\/rooms\\/([^/]+)\\/socket\\/?$/);
  if (!match) return null;
  if (request.headers.get("upgrade") !== "websocket") {
    return allchessDoJson({ error: "WebSocket upgrade required." }, { status: 426 });
  }
  if (!env?.GAME_ROOM_DO) {
    return allchessDoJson({ error: "Realtime room storage is not configured." }, { status: 501 });
  }
  const roomId = decodeURIComponent(match[1]);
  const durableId = env.GAME_ROOM_DO.idFromName(roomId);
  const stub = env.GAME_ROOM_DO.get(durableId);
  const internalUrl = new URL(\`/rooms/\${encodeURIComponent(roomId)}\`, "https://allchess.internal");
  internalUrl.search = url.search;
  return stub.fetch(internalUrl.toString(), { headers: request.headers });
}

function allchessRatingRange(body) {
  if (Array.isArray(body.ratingRange) && body.ratingRange.length === 2) return body.ratingRange;
  const rating = Number.isFinite(Number(body.rating)) ? Number(body.rating) : 1200;
  return [Math.max(100, rating - 200), rating + 200];
}

function allchessTicketsCompatible(left, right) {
  if (left.profileId === right.profileId) return false;
  if (left.variantKey !== right.variantKey) return false;
  if (left.timeControlKey !== right.timeControlKey) return false;
  if (left.rated !== right.rated) return false;
  return Math.max(left.ratingRange[0], right.ratingRange[0]) <= Math.min(left.ratingRange[1], right.ratingRange[1]);
}

function allchessMatch(ticket, opponent) {
  const pairId = [ticket.ticketId, opponent.ticketId].sort().map((id) => id.slice(0, 8)).join("-");
  return { type: "match_found", roomId: \`match-\${pairId}\`, ticketId: ticket.ticketId, opponentTicketId: opponent.ticketId };
}

export class GameRoomDO extends DurableObject {
  sockets = new Set();

  async fetch(request) {
    const url = new URL(request.url);
    const pathRoomId = allchessRoomIdFromPath(url.pathname);
    if (request.headers.get("upgrade") === "websocket") return this.handleSocket(url.searchParams.get("variantKey") ?? "classic", pathRoomId);
    const snapshot = await this.getSnapshot(url.searchParams.get("variantKey") ?? "classic", pathRoomId);
    if (request.method === "GET") return allchessDoJson(snapshot);
    if (request.method === "POST" && url.pathname.endsWith("/move")) {
      const body = await request.json().catch(() => ({}));
      if (!body?.move) return allchessDoJson({ type: "move_rejected", reason: "Missing move.", expectedMoveVersion: snapshot.moveVersion }, { status: 400 });
      if (body.expectedMoveVersion !== snapshot.moveVersion) return allchessDoJson({ type: "move_rejected", reason: "Stale move.", expectedMoveVersion: snapshot.moveVersion }, { status: 409 });
      const next = { ...snapshot, moveVersion: snapshot.moveVersion + 1, status: "active" };
      await this.ctx.storage.put("snapshot", next);
      return allchessDoJson({ type: "move_applied", snapshot: next, move: body.move });
    }
    return allchessDoJson({ error: "Unsupported room operation." }, { status: 404 });
  }

  async getSnapshot(variantKey, roomId) {
    const stored = await this.ctx.storage.get("snapshot");
    if (stored) return stored;
    const snapshot = allchessRoomSnapshot(variantKey);
    if (roomId) snapshot.roomId = roomId;
    await this.ctx.storage.put("snapshot", snapshot);
    return snapshot;
  }

  handleSocket(variantKey = "classic", roomId = null) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);
    void this.getSnapshot(variantKey, roomId).then((snapshot) => this.sendSocket(server, { type: "room_snapshot", snapshot }));
    server.addEventListener("message", (event) => {
      void this.handleSocketMessage(server, event.data, variantKey, roomId);
    });
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSocketMessage(server, data, variantKey, roomId) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      this.sendSocket(server, { type: "move_rejected", reason: "Malformed realtime message.", expectedMoveVersion: 0 });
      return;
    }
    if (message.type === "ping") {
      this.sendSocket(server, { type: "pong", sentAt: message.sentAt, serverTime: new Date().toISOString() });
      return;
    }
    if (message.type === "join_room") {
      const snapshot = await this.getSnapshot(variantKey, message.roomId ?? roomId);
      this.sendSocket(server, { type: "room_snapshot", snapshot });
      return;
    }
    if (message.type === "make_move") {
      const snapshot = await this.getSnapshot(variantKey, message.roomId ?? roomId);
      if (!message.move || message.expectedMoveVersion !== snapshot.moveVersion) {
        this.sendSocket(server, { type: "move_rejected", reason: "Stale or malformed move.", expectedMoveVersion: snapshot.moveVersion });
        return;
      }
      const next = { ...snapshot, moveVersion: snapshot.moveVersion + 1, status: "active" };
      await this.ctx.storage.put("snapshot", next);
      this.broadcastSocket({ type: "move_applied", snapshot: next, move: message.move });
    }
  }

  broadcastSocket(message) {
    for (const socket of this.sockets) this.sendSocket(socket, message);
  }

  sendSocket(socket, message) {
    try {
      if (socket.readyState === 1) socket.send(JSON.stringify(message));
    } catch {
      this.sockets.delete(socket);
    }
  }
}

export class MatchmakingDO extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      const body = await request.json().catch(() => ({}));
      const ticket = {
        ticketId: crypto.randomUUID(),
        profileId: body.profileId ?? "guest",
        variantKey: body.variantKey ?? "classic",
        timeControlKey: body.timeControlKey ?? "rapid",
        ratingRange: allchessRatingRange(body),
        rated: Boolean(body.rated),
        createdAt: new Date().toISOString()
      };
      const queued = await this.ctx.storage.list({ prefix: "ticket:" });
      for (const opponent of queued.values()) {
        if (allchessTicketsCompatible(ticket, opponent)) {
          await this.ctx.storage.delete(\`ticket:\${opponent.ticketId}\`);
          return allchessDoJson({ ticket, match: allchessMatch(ticket, opponent) });
        }
      }
      await this.ctx.storage.put(\`ticket:\${ticket.ticketId}\`, ticket);
      return allchessDoJson({ ticket });
    }
    if (request.method === "POST" && url.pathname.endsWith("/leave")) {
      const body = await request.json().catch(() => ({}));
      if (body.ticketId) await this.ctx.storage.delete(\`ticket:\${body.ticketId}\`);
      return allchessDoJson({ left: Boolean(body.ticketId) });
    }
    return allchessDoJson({ error: "Unsupported matchmaking operation." }, { status: 404 });
  }
}

export class PresenceDO extends DurableObject {
  async fetch(request) {
    if (request.method === "GET") {
      const stats = (await this.ctx.storage.get("stats")) ?? {
        playersOnline: 0,
        activeRooms: 0,
        activeGames: 0,
        spectators: 0,
        botGames: 0,
        source: "durable-object",
        byFamily: {}
      };
      return allchessDoJson(stats);
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const stats = { playersOnline: 0, activeRooms: 0, activeGames: 0, spectators: 0, botGames: 0, byFamily: {}, ...body, source: "durable-object" };
      await this.ctx.storage.put("stats", stats);
      return allchessDoJson(stats);
    }
    return allchessDoJson({ error: "Unsupported presence operation." }, { status: 404 });
  }
}

export class GameRoomDurableObject extends GameRoomDO {}
export class MatchmakingDurableObject extends MatchmakingDO {}
export class PresenceDurableObject extends PresenceDO {}
`;

const worker = await readFile(workerPath, "utf8");
let patchedWorker = worker;
if (!patchedWorker.includes(exportMarker)) {
  const defaultExportIndex = worker.indexOf("export default {");
  if (defaultExportIndex === -1) {
    throw new Error("Could not find OpenNext default worker export to patch Durable Objects.");
  }
  patchedWorker = `${worker.slice(0, defaultExportIndex)}${durableObjectExports}\n${worker.slice(defaultExportIndex).trimStart()}`;
}
const entryPointMarker = "            const url = new URL(request.url);";
if (!patchedWorker.includes("const allchessRealtimeResponse = allchessRoomSocketRequest(request, env);")) {
  if (!patchedWorker.includes(entryPointMarker)) {
    throw new Error("Could not find OpenNext fetch entry point to patch realtime sockets.");
  }
  patchedWorker = patchedWorker.replace(
    entryPointMarker,
    `            const url = new URL(request.url);
            const allchessRealtimeResponse = allchessRoomSocketRequest(request, env);
            if (allchessRealtimeResponse) {
                return allchessRealtimeResponse;
            }`
  );
}
await writeFile(workerPath, patchedWorker);

const defaultFunctionDir = path.join(openNextDir, "server-functions", "default");
await cp(path.join(defaultFunctionDir, ".next", "server"), path.join(defaultFunctionDir, "server"), {
  recursive: true,
  force: true
});

console.log("Patched OpenNext Worker exports and server chunk paths.");
