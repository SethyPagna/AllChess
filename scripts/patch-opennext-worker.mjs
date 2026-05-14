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

export class GameRoomDO extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("upgrade") === "websocket") return this.handleSocket();
    const snapshot = await this.getSnapshot(url.searchParams.get("variantKey") ?? "classic");
    if (request.method === "GET") return allchessDoJson(snapshot);
    if (request.method === "POST" && url.pathname.endsWith("/move")) {
      const body = await request.json().catch(() => ({}));
      if (!body?.move) return allchessDoJson({ type: "move_rejected", reason: "Missing move.", expectedMoveVersion: snapshot.moveVersion }, { status: 400 });
      const next = { ...snapshot, moveVersion: snapshot.moveVersion + 1, status: "active" };
      await this.ctx.storage.put("snapshot", next);
      return allchessDoJson({ type: "move_applied", snapshot: next, move: body.move });
    }
    return allchessDoJson({ error: "Unsupported room operation." }, { status: 404 });
  }

  async getSnapshot(variantKey) {
    const stored = await this.ctx.storage.get("snapshot");
    if (stored) return stored;
    const snapshot = allchessRoomSnapshot(variantKey);
    await this.ctx.storage.put("snapshot", snapshot);
    return snapshot;
  }

  handleSocket() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    void this.getSnapshot("classic").then((snapshot) => server.send(JSON.stringify({ type: "room_snapshot", snapshot })));
    server.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "ping") server.send(JSON.stringify({ type: "pong", sentAt: message.sentAt, serverTime: new Date().toISOString() }));
    });
    return new Response(null, { status: 101, webSocket: client });
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
        ratingRange: body.ratingRange ?? [0, 3000],
        rated: Boolean(body.rated),
        createdAt: new Date().toISOString()
      };
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
`;

const worker = await readFile(workerPath, "utf8");
if (!worker.includes(exportMarker)) {
  await writeFile(workerPath, `${worker.trimEnd()}\n${durableObjectExports}\n`);
}

const defaultFunctionDir = path.join(openNextDir, "server-functions", "default");
await cp(path.join(defaultFunctionDir, ".next", "server"), path.join(defaultFunctionDir, "server"), {
  recursive: true,
  force: true
});

console.log("Patched OpenNext Worker exports and server chunk paths.");
