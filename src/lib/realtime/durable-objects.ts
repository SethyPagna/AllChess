import { createMatchedRoom, hashSeatToken, quickMatchSchema, transitionQuickMatch, type MatchedRoomPlan, type QuickQueue } from "./quick-match";
import { DurableObject } from "cloudflare:workers";
import { friendActionSchema, transitionFriendRoom, settleMatchArrival, nextFriendRoomAlarm, type FriendRoom } from "./friend-room";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { applyAuthoritativeRoomMove, createDemoLiveStats, createRoomSnapshot } from "@/lib/realtime/rooms";
import type { ClientRealtimeMessage, LiveStats, RoomSnapshot, ServerRealtimeMessage } from "@/lib/realtime/types";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

export class GameRoomDO extends DurableObject {
  private snapshot: RoomSnapshot | null = null;
  private sockets = new Set<WebSocket>();

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    // Binding-only provisioning path; no public API forwards arbitrary operations here.
    if (url.pathname === "/matched-room" && request.method === "POST") {
      const plan = await request.json() as MatchedRoomPlan;
      await this.ctx.storage.transaction(async storage => {
        if (!await storage.get("friend-room")) {
          const room = createMatchedRoom(plan);
          await storage.put("friend-room", room);
          await storage.setAlarm(nextFriendRoomAlarm(room));
        }
      });
      return json({ ready: true });
    }
    if (url.pathname.startsWith("/friends/") && request.method === "POST") {
      const action = friendActionSchema.safeParse(await request.json().catch(() => null));
      if (!action.success) return json({ error: "Invalid room action." }, { status: 400 });
      const id = url.pathname.split("/").at(-1)!;
      return this.ctx.blockConcurrencyWhile(async () => {
        const stored = await this.ctx.storage.get<FriendRoom>("friend-room") ?? null;
        const result = await transitionFriendRoom(stored, id, action.data);
        if (result.stored) {
          await this.ctx.storage.put("friend-room", result.stored);
          await this.ctx.storage.setAlarm(nextFriendRoomAlarm(result.stored));
        }
        else await this.ctx.storage.delete("friend-room");
        return json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
      });
    }
    const pathRoomId = roomIdFromPath(url.pathname);
    if (request.headers.get("upgrade") === "websocket") return this.handleSocket(url.searchParams.get("variantKey") ?? "classic", pathRoomId ?? undefined);
    if (request.method === "GET") return json(await this.getSnapshot(url.searchParams.get("variantKey") ?? "classic", pathRoomId ?? undefined));
    if (request.method === "POST" && url.pathname.endsWith("/move")) {
      const body = (await request.json().catch(() => null)) as Extract<ClientRealtimeMessage, { type: "make_move" }> | null;
      const snapshot = await this.getSnapshot(undefined, body?.roomId ?? pathRoomId ?? undefined);
      if (!body?.move || body.expectedMoveVersion !== snapshot.moveVersion) {
        return json({ type: "move_rejected", reason: "Stale or malformed move.", expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage, { status: 409 });
      }
      const result = applyAuthoritativeRoomMove(snapshot, body.move);
      if (!result.ok) return json({ type: "move_rejected", reason: result.reason, expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage, { status: 400 });
      this.snapshot = result.snapshot;
      await this.ctx.storage.put("snapshot", this.snapshot);
      return json({ type: "move_applied", snapshot: this.snapshot, move: body.move } satisfies ServerRealtimeMessage);
    }
    return json({ error: "Unsupported room operation." }, { status: 404 });
  }

  async alarm() {
    await this.ctx.storage.transaction(async storage => {
      const room = await storage.get<FriendRoom>("friend-room");
      if (!room) return;
      const now = Date.now();
      if (now >= room.createdAt + 7 * 86400000) { await storage.delete("friend-room"); return; }
      if (settleMatchArrival(room, now)) {
        room.revision = (room.revision ?? 0) + 1;
        await storage.put("friend-room", room);
      }
      await storage.setAlarm(nextFriendRoomAlarm(room));
    });
  }

  private async getSnapshot(variantKey = "classic", roomId?: string) {
    if (this.snapshot) return this.snapshot;
    this.snapshot = ((await this.ctx.storage.get("snapshot")) as RoomSnapshot | undefined) ?? createRoomSnapshot({ roomId, variantKey });
    await this.ctx.storage.put("snapshot", this.snapshot);
    return this.snapshot;
  }

  private handleSocket(variantKey = "classic", roomId?: string) {
    const WebSocketPairCtor = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: WebSocket } }).WebSocketPair;
    if (!WebSocketPairCtor) return json({ error: "WebSocketPair is only available in the Cloudflare runtime." }, { status: 501 });
    const pair = new WebSocketPairCtor();
    const [client, rawServer] = Object.values(pair);
    const server = rawServer as WebSocket & { accept: () => void };
    server.accept();
    this.sockets.add(server);
    void this.getSnapshot(variantKey, roomId).then((snapshot) => this.sendSocketMessage(server, { type: "room_snapshot", snapshot } satisfies ServerRealtimeMessage));
    server.addEventListener("message", (event: MessageEvent) => {
      void this.handleSocketMessage(server, event.data, variantKey, roomId);
    });
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private async handleSocketMessage(server: WebSocket, data: unknown, variantKey: string, roomId?: string) {
    const message = parseClientMessage(data);
    if (!message) {
      this.sendSocketMessage(server, { type: "move_rejected", reason: "Malformed realtime message.", expectedMoveVersion: this.snapshot?.moveVersion ?? 0 } satisfies ServerRealtimeMessage);
      return;
    }

    if (message.type === "ping") {
      this.sendSocketMessage(server, { type: "pong", sentAt: message.sentAt, serverTime: new Date().toISOString() } satisfies ServerRealtimeMessage);
      return;
    }

    if (message.type === "join_room") {
      const snapshot = await this.getSnapshot(variantKey, message.roomId || roomId);
      this.sendSocketMessage(server, { type: "room_snapshot", snapshot } satisfies ServerRealtimeMessage);
      return;
    }

    if (message.type === "make_move") {
      const snapshot = await this.getSnapshot(variantKey, message.roomId || roomId);
      if (message.expectedMoveVersion !== snapshot.moveVersion) {
        this.sendSocketMessage(server, { type: "move_rejected", reason: "Stale move.", expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage);
        return;
      }
      const result = applyAuthoritativeRoomMove(snapshot, message.move);
      if (!result.ok) {
        this.sendSocketMessage(server, { type: "move_rejected", reason: result.reason, expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage);
        return;
      }
      this.snapshot = result.snapshot;
      await this.ctx.storage.put("snapshot", this.snapshot);
      this.broadcastSocketMessage({ type: "move_applied", snapshot: this.snapshot, move: message.move } satisfies ServerRealtimeMessage);
    }
  }

  private broadcastSocketMessage(message: ServerRealtimeMessage) {
    for (const socket of this.sockets) {
      this.sendSocketMessage(socket, message);
    }
  }

  private sendSocketMessage(socket: WebSocket, message: ServerRealtimeMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.sockets.delete(socket);
    }
  }
}

function roomIdFromPath(pathname: string) {
  const match = pathname.match(/(?:\/api)?\/rooms\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseClientMessage(data: unknown): ClientRealtimeMessage | null {
  try {
    return JSON.parse(String(data)) as ClientRealtimeMessage;
  } catch {
    return null;
  }
}

export class MatchmakingDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) { super(ctx, env); }

  async fetch(request: Request) {
    const action = new URL(request.url).pathname.split("/").at(-1);
    if (request.method !== "POST" || (action !== "join" && action !== "leave")) return json({ error: "Unsupported queue action." }, { status: 404 });
    const parsed = quickMatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Invalid search. Please start again." }, { status: 400 });
    const digest = await hashSeatToken(parsed.data.token);
    const result = await this.ctx.storage.transaction(async storage => {
      const transition = transitionQuickMatch(await storage.get<QuickQueue>("quick-queue"), parsed.data, digest, action);
      await storage.put("quick-queue", transition.queue);
      await storage.setAlarm(Date.now() + 11 * 60000);
      return transition;
    });
    // The server adapter provisions the committed pairing outside this transaction.
    return json({ ...result.body, provision: result.provision }, { status: result.status });
  }

  async alarm() {
    await this.ctx.storage.transaction(async storage => {
      const queue = await storage.get<QuickQueue>("quick-queue");
      if (queue) await storage.put("quick-queue", { entries: queue.entries.filter(entry => entry.expiresAt > Date.now()) });
    });
  }
}

export class PresenceDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    if (request.method === "GET") {
      const stats = ((await this.ctx.storage.get("stats")) as LiveStats | undefined) ?? createDemoLiveStats({ source: "durable-object" });
      return json(stats);
    }
    if (request.method === "POST") {
      const stats = createDemoLiveStats({ ...((await request.json().catch(() => ({}))) as Partial<LiveStats>), source: "durable-object" });
      await this.ctx.storage.put("stats", stats);
      return json(stats);
    }
    return json({ error: "Unsupported presence operation." }, { status: 404 });
  }
}
