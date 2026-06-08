import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { applyAuthoritativeRoomMove, areMatchmakingTicketsCompatible, createDemoLiveStats, createMatchmakingMatch, createMatchmakingTicket, createRoomSnapshot } from "@/lib/realtime/rooms";
import type { ClientRealtimeMessage, LiveStats, MatchmakingTicket, RoomSnapshot, ServerRealtimeMessage } from "@/lib/realtime/types";

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
      if (socket.readyState === 1) socket.send(JSON.stringify(message));
    } catch {
      this.sockets.delete(socket);
    }
  }
}

function roomIdFromPath(pathname: string) {
  const match = pathname.match(/\/rooms\/([^/]+)/);
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
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      const body = (await request.json().catch(() => ({}))) as Partial<MatchmakingTicket>;
      const ticket = createMatchmakingTicket(body);
      const opponent = await this.findOpponent(ticket);
      if (opponent) {
        await this.ctx.storage.delete(`ticket:${opponent.ticketId}`);
        return json({ ticket, match: createMatchmakingMatch(ticket, opponent) });
      }
      await this.ctx.storage.put(`ticket:${ticket.ticketId}`, ticket);
      return json({ ticket });
    }
    if (request.method === "POST" && url.pathname.endsWith("/leave")) {
      const body = (await request.json().catch(() => ({}))) as { ticketId?: string };
      if (body.ticketId) await this.ctx.storage.delete(`ticket:${body.ticketId}`);
      return json({ left: Boolean(body.ticketId) });
    }
    return json({ error: "Unsupported matchmaking operation." }, { status: 404 });
  }

  private async findOpponent(ticket: MatchmakingTicket) {
    const queuedTickets = await this.ctx.storage.list<MatchmakingTicket>({ prefix: "ticket:" });
    for (const opponent of queuedTickets.values()) {
      if (areMatchmakingTicketsCompatible(ticket, opponent)) return opponent;
    }
    return null;
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
