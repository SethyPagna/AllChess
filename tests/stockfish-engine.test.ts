import { describe, expect, test } from "vitest";

import { buildStockfishCommands, getStockfishDifficultyConfig, moveToUci, shouldUseStockfish, uciToLegalMove } from "@/lib/stockfish-engine";
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
    const legend = getStockfishDifficultyConfig("legend");

    expect(easy.limitStrength).toBe(true);
    expect(easy.elo).toBe(1320);
    expect(easy.elo).toBeLessThan(legend.elo);
    expect(easy.moveTimeMs).toBeLessThan(legend.moveTimeMs);
    expect(legend.elo).toBe(3190);
    expect(legend.moveTimeMs).toBeLessThanOrEqual(2400);
    expect(legend.limitStrength).toBe(false);
  });

  test("builds UCI commands with strength limiting and position moves", () => {
    const state = createInitialState("classic", "uci-commands");
    const commands = buildStockfishCommands(state, "hard", ["e2e4"]);

    expect(commands).toContain("uci");
    expect(commands).toContain("setoption name UCI_LimitStrength value true");
    expect(commands).toContain("setoption name UCI_Elo value 1900");
    expect(commands).toContain("position startpos moves e2e4");
    expect(commands.at(-1)).toBe("go movetime 500 depth 7");
  });
});
