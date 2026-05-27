import { describe, expect, test } from "vitest";

import { fetchDurableJson } from "@/lib/realtime/durable-client";

describe("durable object client", () => {
  test("returns null when a binding is unavailable", async () => {
    await expect(fetchDurableJson(undefined, "global", "/matchmaking/join")).resolves.toBeNull();
  });

  test("routes JSON requests through a durable object namespace", async () => {
    const calls: string[] = [];
    const namespace = {
      idFromName(name: string) {
        calls.push(`id:${name}`);
        return "id-global";
      },
      get(id: string) {
        calls.push(`get:${id}`);
        return {
          async fetch(url: string, init?: RequestInit) {
            calls.push(`${init?.method ?? "GET"}:${url}`);
            return Response.json({ ok: true });
          }
        };
      }
    };

    const result = await fetchDurableJson<{ ok: boolean }>(namespace as never, "global", "/matchmaking/join", { method: "POST", body: "{}" });

    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } });
    expect(calls).toEqual(["id:global", "get:id-global", "POST:https://allchess.internal/matchmaking/join"]);
  });
});
