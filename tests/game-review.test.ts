import { describe, expect, test } from "vitest";

import { analyzeMoveList, summarizeReview } from "@/lib/game-review";

describe("game review", () => {
  test("classifies moves and summarizes review counts", () => {
    const moves = analyzeMoveList([
      { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, notation: "P6,4-4,4" },
      { from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, notation: "P1,4-3,4" },
      { from: { row: 7, col: 6 }, to: { row: 5, col: 5 }, notation: "N7,6-5,5" },
      { from: { row: 0, col: 3 }, to: { row: 4, col: 7 }, notation: "Q0,3x4,7" },
      { from: { row: 6, col: 0 }, to: { row: 5, col: 0 }, notation: "P6,0-5,0" },
      { from: { row: 1, col: 0 }, to: { row: 2, col: 0 }, notation: "P1,0-2,0" },
      { from: { row: 7, col: 1 }, to: { row: 5, col: 2 }, notation: "N7,1-5,2" }
    ]);

    expect(moves[0]).toMatchObject({ label: "Best", score: 96 });
    expect(moves.some((move) => move.label === "Excellent")).toBe(true);
    expect(moves.some((move) => move.label === "Blunder")).toBe(true);
    expect(moves[0].detail).toContain("Move 1");
    expect(summarizeReview(moves).best).toBeGreaterThan(0);
  });

  test("adds native context for variant reviews", () => {
    const moves = analyzeMoveList(
      [
        { from: { row: 8, col: 0 }, to: { row: 7, col: 0 }, notation: "T8,0-7,0" },
        { from: { row: 0, col: 0 }, to: { row: 1, col: 0 }, notation: "L0,0-1,0" }
      ],
      { variantKey: "jungle" }
    );

    expect(moves[0].detail).toContain("animal rank");
    expect(moves[0].bestLine).toContain("den-race");
  });
});
