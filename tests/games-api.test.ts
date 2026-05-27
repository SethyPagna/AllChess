import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { GET } from "@/app/api/games/route";

function createRecentGamesD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async all() {
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
                  },
                  {
                    id: "result-2",
                    profile_id: "profile-2",
                    game_id: "game-2",
                    family_key: "chess-family",
                    variant_key: "xiangqi",
                    time_control_key: "blitz",
                    mode: "online",
                    opponent_profile_id: "profile-3",
                    opponent_type: "user",
                    result: "loss",
                    outcome_reason: "timeout",
                    rated: 0,
                    rating_delta: null,
                    moves_played: 31,
                    duration_ms: 210000,
                    completed_at: "2026-05-18T02:00:00.000Z",
                    created_at: "2026-05-18T01:30:00.000Z"
                  }
                ]
              };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("games API", () => {
  test("returns empty real-data shape without D1", async () => {
    runtime.env = {};

    const response = await GET(new Request("http://allchess.test/api/games"));

    await expect(response.json()).resolves.toEqual({ source: "empty-live-data", results: [], totalResults: 0, filters: { query: "", result: "all" } });
  });

  test("returns recent saved D1 results", async () => {
    const { db, calls } = createRecentGamesD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/games?limit=5"));

    await expect(response.json()).resolves.toMatchObject({
      source: "d1",
      totalResults: 2,
      results: [
        expect.objectContaining({ gameId: "game-1", variantKey: "classic", result: "win" }),
        expect.objectContaining({ gameId: "game-2", variantKey: "xiangqi", result: "loss" })
      ]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from profile_game_results"), values: [100] })
      ])
    );
  });

  test("filters recent saved results by query and result", async () => {
    const { db } = createRecentGamesD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/games?limit=5&q=xiangqi&result=loss"));

    await expect(response.json()).resolves.toMatchObject({
      source: "d1",
      filters: { query: "xiangqi", result: "loss" },
      results: [expect.objectContaining({ gameId: "game-2", variantKey: "xiangqi", result: "loss" })]
    });
  });
});
