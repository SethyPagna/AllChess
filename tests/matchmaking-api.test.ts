import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { POST as joinQueue } from "@/app/api/matchmaking/join/route";
import { POST as leaveQueue } from "@/app/api/matchmaking/leave/route";

function createMatchmakingD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async run() {
              return { success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("matchmaking API", () => {
  test("persists queue tickets to D1 when Durable Object binding is unavailable", async () => {
    const { db, calls } = createMatchmakingD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await joinQueue(
      new Request("http://allchess.test/api/matchmaking/join", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-1", variantKey: "classic", timeControlKey: "rapid", rating: 1200, rated: true })
      })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      mode: "d1",
      ticket: {
        profileId: "profile-1",
        variantKey: "classic",
        timeControlKey: "rapid",
        ratingRange: [1000, 1400],
        rated: true
      }
    });
    const insert = calls.find((call) => call.sql.includes("insert into matchmaking_tickets"));
    expect(insert?.values.slice(1, 7)).toEqual(["profile-1", "classic", "rapid", 1000, 1400, 1]);
  });

  test("marks D1 queue tickets as cancelled when leaving the queue", async () => {
    const { db, calls } = createMatchmakingD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await leaveQueue(
      new Request("http://allchess.test/api/matchmaking/leave", {
        method: "POST",
        body: JSON.stringify({ ticketId: "ticket-1" })
      })
    );

    await expect(response.json()).resolves.toMatchObject({ mode: "d1", left: true, ticketId: "ticket-1" });
    const update = calls.find((call) => call.sql.includes("update matchmaking_tickets"));
    expect(update?.values).toEqual(["ticket-1"]);
  });
});
