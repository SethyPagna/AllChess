import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { GET } from "@/app/api/leaderboards/route";

function createLeaderboardD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async all() {
              if (sql.includes("from leaderboards")) {
                return {
                  results: [
                    {
                      id: "classic-rapid",
                      scope_id: "global",
                      game_id: "classic",
                      family_key: "chess-family",
                      rated_only: 1,
                      period: "all-time",
                      computed_at: "2026-05-18T00:00:00.000Z"
                    }
                  ]
                };
              }
              if (sql.includes("from leaderboard_entries")) {
                return {
                  results: [
                    {
                      rank: 1,
                      profile_id: "profile-1",
                      display_name: "Sharp Player",
                      rating: 1801,
                      games_played: 88,
                      win_rate: 0.64,
                      streak: 5,
                      metadata: JSON.stringify({ country: "HK" }),
                      computed_at: "2026-05-18T00:00:00.000Z"
                    }
                  ]
                };
              }
              return { results: [] };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("leaderboards API", () => {
  test("returns empty live data when no D1 binding is configured", async () => {
    runtime.env = {};

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      source: "empty-live-data",
      leaderboards: []
    });
  });

  test("returns normalized D1 leaderboard rows when configured", async () => {
    const { db, calls } = createLeaderboardD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      source: "d1",
      leaderboards: [
        {
          id: "classic-rapid",
          scopeId: "global",
          entries: [
            {
              rank: 1,
              displayName: "Sharp Player",
              rating: 1801,
              metadata: { country: "HK" }
            }
          ]
        }
      ]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from leaderboards") }),
        expect.objectContaining({ sql: expect.stringContaining("from leaderboard_entries"), values: ["classic-rapid"] })
      ])
    );
  });
});
