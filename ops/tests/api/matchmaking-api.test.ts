import { describe, expect, test, vi } from "vitest";

import type { D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database; MATCHMAKING_DO?: DurableObjectNamespace }
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

function createMatchmakingDurableObject() {
  return {
    idFromName(name: string) {
      return name;
    },
    get() {
      return {
        async fetch() {
          return Response.json({
            ticket: {
              ticketId: "ticket-2",
              profileId: "profile-2",
              variantKey: "classic",
              timeControlKey: "rapid",
              ratingRange: [1150, 1550],
              rated: false,
              createdAt: "2026-06-08T00:00:00.000Z"
            },
            match: {
              type: "match_found",
              roomId: "match-room",
              ticketId: "ticket-2",
              opponentTicketId: "ticket-1"
            }
          });
        }
      };
    }
  } as unknown as DurableObjectNamespace;
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

  test("returns Durable Object match payloads when compatible players pair", async () => {
    runtime.env = { MATCHMAKING_DO: createMatchmakingDurableObject() };

    const response = await joinQueue(
      new Request("http://allchess.test/api/matchmaking/join", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-2", variantKey: "classic", timeControlKey: "rapid", rating: 1350 })
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      mode: "durable-object",
      ticket: {
        ticketId: "ticket-2"
      },
      match: {
        type: "match_found",
        roomId: "match-room",
        ticketId: "ticket-2",
        opponentTicketId: "ticket-1"
      }
    });
  });

  test("creates a D1 room and clears queued tickets when Durable Object players pair", async () => {
    const { db, calls } = createMatchmakingD1();
    runtime.env = { ALLCHESS_D1: db, MATCHMAKING_DO: createMatchmakingDurableObject() };

    const response = await joinQueue(
      new Request("http://allchess.test/api/matchmaking/join", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-2", variantKey: "classic", timeControlKey: "rapid", rating: 1350 })
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      mode: "durable-object",
      match: { roomId: "match-room", ticketId: "ticket-2", opponentTicketId: "ticket-1" },
      room: { id: "match-room", mode: "d1" }
    });
    const roomInsert = calls.find((call) => call.sql.includes("insert into rooms"));
    expect(roomInsert?.values[0]).toBe("match-room");
    expect(roomInsert?.values[9]).toBe("rapid");
    expect(roomInsert?.values[10]).toBe("unlisted");
    const cancelled = calls.filter((call) => call.sql.includes("update matchmaking_tickets")).map((call) => call.values[0]);
    expect(cancelled).toEqual(["ticket-1", "ticket-2"]);
  });
});
