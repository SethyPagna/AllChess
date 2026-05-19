import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { GET } from "@/app/api/profiles/[profileId]/history/route";

function createProfileHistoryD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async all() {
              if (sql.includes("from profile_game_stats")) {
                return {
                  results: [
                    {
                      profile_id: "profile-1",
                      family_key: "chess-family",
                      variant_key: "classic",
                      time_control_key: "rapid",
                      mode: "bot",
                      games_played: 12,
                      wins: 8,
                      losses: 3,
                      draws: 1,
                      bot_games: 12,
                      online_games: 0,
                      local_games: 0,
                      rated_games: 6,
                      total_moves: 742,
                      best_rating: 1390,
                      updated_at: "2026-05-18T02:00:00.000Z"
                    }
                  ]
                };
              }
              if (sql.includes("from profile_game_results")) {
                return {
                  results: [
                    {
                      id: "result-1",
                      profile_id: "profile-1",
                      game_id: "game-1",
                      family_key: "chess-family",
                      variant_key: "classic",
                      time_control_key: "rapid",
                      mode: "bot",
                      opponent_profile_id: "bot-grandmaster",
                      opponent_type: "bot",
                      result: "win",
                      outcome_reason: "checkmate",
                      rated: 1,
                      rating_delta: 14,
                      moves_played: 63,
                      duration_ms: 540000,
                      completed_at: "2026-05-18T01:00:00.000Z",
                      created_at: "2026-05-18T00:30:00.000Z"
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

describe("profile history API", () => {
  test("returns empty real-data shape without D1", async () => {
    runtime.env = {};

    const response = await GET(new Request("http://allchess.test/api/profiles/profile-1/history"), {
      params: Promise.resolve({ profileId: "profile-1" })
    });

    await expect(response.json()).resolves.toEqual({
      source: "empty-live-data",
      profileId: "profile-1",
      stats: [],
      results: []
    });
  });

  test("returns D1 profile stats and recent results", async () => {
    const { db, calls } = createProfileHistoryD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/profiles/profile-1/history?limit=5"), {
      params: Promise.resolve({ profileId: "profile-1" })
    });
    const body = await response.json();

    expect(body).toMatchObject({
      source: "d1",
      profileId: "profile-1",
      stats: [{ variantKey: "classic", gamesPlayed: 12, wins: 8, bestRating: 1390 }],
      results: [{ gameId: "game-1", opponentType: "bot", result: "win", outcomeReason: "checkmate", rated: true }]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from profile_game_stats"), values: ["profile-1"] }),
        expect.objectContaining({ sql: expect.stringContaining("from profile_game_results"), values: ["profile-1", 5] })
      ])
    );
  });

  test("sanitizes route profile id and clamps unsafe limits", async () => {
    const { db, calls } = createProfileHistoryD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/profiles/profile%201/history?limit=9999"), {
      params: Promise.resolve({ profileId: "profile%201" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profileId: "profile 1" });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from profile_game_results"), values: ["profile 1", 100] })
      ])
    );

    const invalid = await GET(new Request("http://allchess.test/api/profiles/%E0%A4%A/history?limit=bad"), {
      params: Promise.resolve({ profileId: "%E0%A4%A" })
    });
    expect(invalid.status).toBe(404);
  });
});
