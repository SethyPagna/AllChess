import { describe, expect, test } from "vitest";

import { getStockfishDifficultyConfig, moveToUci, shouldUseStockfish, uciToLegalMove } from "@/lib/stockfish-engine";
import { createInitialState } from "@/lib/variants";

describe("Stockfish engine adapter", () => {
  test("uses Stockfish only for supported western variants", () => {
    expect(shouldUseStockfish(createInitialState("classic"), "auto")).toBe(true);
    expect(shouldUseStockfish(createInitialState("chess960"), "auto")).toBe(true);
    expect(shouldUseStockfish(createInitialState("xiangqi"), "auto")).toBe(false);
    expect(shouldUseStockfish(createInitialState("classic"), "internal")).toBe(false);
  });

  test("maps moves to and from UCI coordinates", () => {
    const state = createInitialState("classic", "uci-map");
    const move = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };

    expect(moveToUci(state, move)).toBe("e2e4");
    expect(uciToLegalMove(state, "e2e4")).toMatchObject(move);
  });

  test("maps difficulties to distinct UCI strength and time settings", () => {
    const easy = getStockfishDifficultyConfig("easy");
    const hell = getStockfishDifficultyConfig("hell");

    expect(easy.limitStrength).toBe(true);
    expect(easy.elo).toBeLessThan(hell.elo);
    expect(easy.moveTimeMs).toBeLessThan(hell.moveTimeMs);
    expect(hell.limitStrength).toBe(false);
  });
});
