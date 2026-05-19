import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import AnalysisPage from "@/app/[locale]/analysis/[gameId]/page";

function createAnalysisPageD1() {
  const db = {
    prepare(sql: string) {
      return {
        bind() {
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
                report: JSON.stringify({ moments: [{ move: "e4", label: "excellent" }] }),
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
                  },
                  {
                    game_id: "game-1",
                    ply: 2,
                    move: JSON.stringify({ from: { row: 1, col: 4 }, to: { row: 3, col: 4 } }),
                    notation: "e5",
                    board_state_after: JSON.stringify({ id: "game-1", ply: 2 }),
                    created_at: "2026-05-18T00:00:02.000Z"
                  },
                  {
                    game_id: "game-1",
                    ply: 3,
                    move: JSON.stringify({ from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }),
                    notation: "Nf3",
                    board_state_after: JSON.stringify({ id: "game-1", ply: 3 }),
                    created_at: "2026-05-18T00:00:03.000Z"
                  }
                ]
              };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return db;
}

describe("analysis page review navigation", () => {
  test("renders saved moves as route-backed review links", async () => {
    runtime.env = { ALLCHESS_D1: createAnalysisPageD1() };

    const element = await AnalysisPage({
      params: Promise.resolve({ locale: "en", gameId: "game-1" }),
      searchParams: Promise.resolve({ ply: "2" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Saved review");
    expect(markup).toContain("Selected move");
    expect(markup).toContain("Ply 2 of 3");
    expect(markup).toContain("/en/analysis/game-1?ply=1");
    expect(markup).toContain("/en/analysis/game-1?ply=2");
    expect(markup).toContain("/en/analysis/game-1?ply=3");
    expect(markup).toContain("Previous");
    expect(markup).toContain("Play");
    expect(markup).toContain("Next");
    expect(markup).toContain("Last");
    expect(markup).toContain("/en/analysis/game-1?ply=3&amp;autoplay=1");
    expect(markup).not.toContain("Playback controls unlock after saved moves");
  });

  test("renders pause control while review autoplay is active", async () => {
    runtime.env = { ALLCHESS_D1: createAnalysisPageD1() };

    const element = await AnalysisPage({
      params: Promise.resolve({ locale: "en", gameId: "game-1" }),
      searchParams: Promise.resolve({ autoplay: "1", ply: "2" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Pause");
    expect(markup).toContain("/en/analysis/game-1?ply=2");
    expect(markup).toContain("/en/analysis/game-1?ply=3&amp;autoplay=1");
  });
});
