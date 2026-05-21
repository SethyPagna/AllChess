import { describe, expect, test } from "vitest";

import type { RuntimeProfileHistory } from "@/lib/profile/runtime";
import { summarizeProfileHistory } from "@/lib/profile/summary";

describe("profile summary", () => {
  test("keeps empty live data explicit", () => {
    expect(summarizeProfileHistory(createHistory())).toEqual({
      bestRating: null,
      gamesPlayed: 0,
      recentResult: null
    });
  });

  test("combines stats and formats the latest result", () => {
    expect(
      summarizeProfileHistory(
        createHistory({
          stats: [
            createStats({ variantKey: "classic", bestRating: 640, gamesPlayed: 3, wins: 1, losses: 2 }),
            createStats({ variantKey: "xiangqi", bestRating: 580, gamesPlayed: 2, losses: 1, draws: 1 })
          ],
          results: [
            {
              id: "result-1",
              gameId: "game-1",
              profileId: "player",
              familyKey: "chess",
              opponentProfileId: "opponent",
              opponentType: "user",
              variantKey: "classic",
              timeControlKey: "rapid",
              mode: "online",
              result: "win",
              outcomeReason: "checkmate",
              rated: true,
              ratingDelta: 12,
              movesPlayed: 42,
              durationMs: 600000,
              completedAt: "2026-05-21T00:00:00.000Z",
              createdAt: "2026-05-21T00:00:00.000Z"
            }
          ]
        })
      )
    ).toEqual({
      bestRating: 640,
      gamesPlayed: 5,
      recentResult: "Win"
    });
  });
});

function createHistory(overrides: Partial<RuntimeProfileHistory> = {}): RuntimeProfileHistory {
  return {
    source: "empty-live-data",
    profileId: "player",
    stats: [],
    results: [],
    ...overrides
  };
}

function createStats(overrides: Partial<RuntimeProfileHistory["stats"][number]> = {}): RuntimeProfileHistory["stats"][number] {
  return {
    profileId: "player",
    familyKey: "chess",
    variantKey: "classic",
    timeControlKey: "rapid",
    mode: "all",
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    botGames: 0,
    onlineGames: 0,
    localGames: 0,
    ratedGames: 0,
    totalMoves: 0,
    bestRating: null,
    updatedAt: "2026-05-21T00:00:00.000Z",
    ...overrides
  };
}
