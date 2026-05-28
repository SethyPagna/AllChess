import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { GET } from "@/app/api/analysis/route";

function createAnalysisD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async first() {
              if (!sql.includes("from analysis_reports")) return null;
              return {
                id: "analysis-1",
                game_id: "game-1",
                requested_by: "player-1",
                provider: "openai",
                model: "gpt-test",
                summary: "White converted a central tactic.",
                report: JSON.stringify({ moments: [{ move: "Nf3", label: "excellent" }] }),
                created_at: "2026-05-18T00:00:00.000Z"
              };
            },
            async all() {
              if (!sql.includes("from moves")) return { results: [] };
              return {
                results: [
                  {
                    game_id: "game-1",
                    ply: 1,
                    move: JSON.stringify({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }),
                    notation: "e4",
                    board_state_after: JSON.stringify({ id: "game-1", ply: 1 }),
                    created_at: "2026-05-18T00:00:01.000Z"
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

describe("analysis API", () => {
  test("requires a game id", async () => {
    runtime.env = {};

    const response = await GET(new Request("http://allchess.test/api/analysis"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "gameId is required." });
  });

  test("returns empty real-data shape without D1", async () => {
    runtime.env = {};

    const response = await GET(new Request("http://allchess.test/api/analysis?gameId=game-1"));

    await expect(response.json()).resolves.toEqual({ source: "empty-live-data", gameId: "game-1", analysis: null, moves: [] });
  });

  test("returns saved D1 analysis and move snapshots", async () => {
    const { db, calls } = createAnalysisD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await GET(new Request("http://allchess.test/api/analysis?gameId=game-1&limit=5"));

    await expect(response.json()).resolves.toMatchObject({
      source: "d1",
      gameId: "game-1",
      analysis: {
        id: "analysis-1",
        provider: "openai",
        summary: "White converted a central tactic.",
        report: { moments: [{ move: "Nf3", label: "excellent" }] }
      },
      moves: [{ gameId: "game-1", ply: 1, notation: "e4" }]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from analysis_reports"), values: ["game-1"] }),
        expect.objectContaining({ sql: expect.stringContaining("from moves"), values: ["game-1", 5] })
      ])
    );
  });
});
