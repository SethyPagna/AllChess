import { describe, expect, test, vi } from "vitest";

import type { DurableObjectNamespace } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { GAME_ROOM_DO?: DurableObjectNamespace }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { GET as roomSocketGet } from "@/app/api/rooms/[id]/socket/route";

function createSocketDurableObject() {
  const calls: Array<{ url: string; upgrade: string | null }> = [];
  const namespace = {
    idFromName(name: string) {
      return name;
    },
    get() {
      return {
        async fetch(url: string, init?: RequestInit) {
          const headers = new Headers(init?.headers);
          calls.push({ url, upgrade: headers.get("upgrade") });
          return Response.json({ proxied: true });
        }
      };
    }
  } as unknown as DurableObjectNamespace;

  return { calls, namespace };
}

describe("room socket API", () => {
  test("requires a WebSocket upgrade request", async () => {
    runtime.env = {};

    const response = await roomSocketGet(new Request("http://allchess.test/api/rooms/room-1/socket"), { params: Promise.resolve({ id: "room-1" }) });

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toMatchObject({ error: "WebSocket upgrade required." });
  });

  test("proxies upgrade requests to the named room Durable Object", async () => {
    const { calls, namespace } = createSocketDurableObject();
    runtime.env = { GAME_ROOM_DO: namespace };

    const response = await roomSocketGet(new Request("http://allchess.test/api/rooms/room-1/socket?variantKey=classic", { headers: { upgrade: "websocket" } }), {
      params: Promise.resolve({ id: "room-1" })
    });

    await expect(response.json()).resolves.toMatchObject({ proxied: true });
    expect(calls).toEqual([
      {
        url: "https://allchess.internal/rooms/room-1?variantKey=classic",
        upgrade: "websocket"
      }
    ]);
  });
});
