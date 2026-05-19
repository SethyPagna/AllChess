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

    await expect(response.json()).resolves.toEqual({ source: "empty-live-data", results: [] });
  });

  test("returns recent saved D1 results", async () => {
    const { db, calls } = createRecentGamesD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/games?limit=5"));

    await expect(response.json()).resolves.toMatchObject({
      source: "d1",
      results: [expect.objectContaining({ gameId: "game-1", variantKey: "classic", result: "win" })]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from profile_game_results"), values: [5] })
      ])
    );
  });
});
