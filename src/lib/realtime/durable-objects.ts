import type { DurableObjectState } from "@cloudflare/workers-types";

import { applyAuthoritativeRoomMove, createDemoLiveStats, createMatchmakingTicket, createRoomSnapshot } from "@/lib/realtime/rooms";
import type { ClientRealtimeMessage, LiveStats, MatchmakingTicket, RoomSnapshot, ServerRealtimeMessage } from "@/lib/realtime/types";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

export class GameRoomDO {
  private snapshot: RoomSnapshot | null = null;

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.headers.get("upgrade") === "websocket") return this.handleSocket();
    if (request.method === "GET") return json(await this.getSnapshot(url.searchParams.get("variantKey") ?? "classic"));
    if (request.method === "POST" && url.pathname.endsWith("/move")) {
      const body = (await request.json().catch(() => null)) as Extract<ClientRealtimeMessage, { type: "make_move" }> | null;
      const snapshot = await this.getSnapshot();
      if (!body?.move || body.expectedMoveVersion !== snapshot.moveVersion) {
        return json({ type: "move_rejected", reason: "Stale or malformed move.", expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage, { status: 409 });
      }
      const result = applyAuthoritativeRoomMove(snapshot, body.move);
      if (!result.ok) return json({ type: "move_rejected", reason: result.reason, expectedMoveVersion: snapshot.moveVersion } satisfies ServerRealtimeMessage, { status: 400 });
      this.snapshot = result.snapshot;
      await this.state.storage.put("snapshot", this.snapshot);
      return json({ type: "move_applied", snapshot: this.snapshot, move: body.move } satisfies ServerRealtimeMessage);
    }
    return json({ error: "Unsupported room operation." }, { status: 404 });
  }

  private async getSnapshot(variantKey = "classic") {
    if (this.snapshot) return this.snapshot;
    this.snapshot = ((await this.state.storage.get("snapshot")) as RoomSnapshot | undefined) ?? createRoomSnapshot({ variantKey });
    await this.state.storage.put("snapshot", this.snapshot);
    return this.snapshot;
  }

  private handleSocket() {
    const WebSocketPairCtor = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: WebSocket } }).WebSocketPair;
    if (!WebSocketPairCtor) return json({ error: "WebSocketPair is only available in the Cloudflare runtime." }, { status: 501 });
    const pair = new WebSocketPairCtor();
    const [client, rawServer] = Object.values(pair);
    const server = rawServer as WebSocket & { accept: () => void };
    server.accept();
    void this.getSnapshot().then((snapshot) => server.send(JSON.stringify({ type: "room_snapshot", snapshot } satisfies ServerRealtimeMessage)));
    server.addEventListener("message", (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as ClientRealtimeMessage;
      if (message.type === "ping") server.send(JSON.stringify({ type: "pong", sentAt: message.sentAt, serverTime: new Date().toISOString() } satisfies ServerRealtimeMessage));
    });
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }
}

export class MatchmakingDO {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      const body = (await request.json().catch(() => ({}))) as Partial<MatchmakingTicket>;
      const ticket = createMatchmakingTicket(body);
      await this.state.storage.put(`ticket:${ticket.ticketId}`, ticket);
      return json({ ticket });
    }
    if (request.method === "POST" && url.pathname.endsWith("/leave")) {
      const body = (await request.json().catch(() => ({}))) as { ticketId?: string };
      if (body.ticketId) await this.state.storage.delete(`ticket:${body.ticketId}`);
      return json({ left: Boolean(body.ticketId) });
    }
    return json({ error: "Unsupported matchmaking operation." }, { status: 404 });
  }
}

export class PresenceDO {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request) {
    if (request.method === "GET") {
      const stats = ((await this.state.storage.get("stats")) as LiveStats | undefined) ?? createDemoLiveStats({ source: "durable-object" });
      return json(stats);
    }
    if (request.method === "POST") {
      const stats = createDemoLiveStats({ ...((await request.json().catch(() => ({}))) as Partial<LiveStats>), source: "durable-object" });
      await this.state.storage.put("stats", stats);
      return json(stats);
    }
    return json({ error: "Unsupported presence operation." }, { status: 404 });
  }
}
