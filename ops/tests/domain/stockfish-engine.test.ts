import { describe, expect, test } from "vitest";

import { buildStockfishCommands, getStockfishDifficultyConfig, moveToUci, shouldUseStockfish, uciToLegalMove } from "@/lib/bot/stockfish-engine";
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

  test("preserves western promotion suffixes from UCI best moves", () => {
    let state = createInitialState("classic", "uci-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const move = uciToLegalMove(state, "a7a8q");

    expect(move).toMatchObject({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 }, promotion: true });
    expect(move ? moveToUci(state, move) : null).toBe("a7a8q");
  });

  test("selects the promoted Shogi-family branch when a suffix is present", () => {
    let state = createInitialState("mini-shogi", "uci-shogi-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "sente"
    };
    state.board[1][1].piece = { id: "sente-silver", code: "s", owner: "sente", labelKey: "shogi.silver" };
    state.board[4][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "shogi.king" };
    state.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "shogi.king" };

    const keepMove = uciToLegalMove(state, "b4a5");
    const promoteMove = uciToLegalMove(state, "b4a5q");

    expect(keepMove).toMatchObject({ from: { row: 1, col: 1 }, to: { row: 0, col: 0 } });
    expect(keepMove?.promotion).not.toBe(true);
    expect(promoteMove).toMatchObject({ from: { row: 1, col: 1 }, to: { row: 0, col: 0 }, promotion: true });
  });

  test("maps difficulties to distinct UCI strength and time settings", () => {
    const easy = getStockfishDifficultyConfig("easy");
    const legend = getStockfishDifficultyConfig("legend");

    expect(easy.limitStrength).toBe(true);
    expect(easy.elo).toBe(1320);
    expect(easy.depth).toBeGreaterThanOrEqual(4);
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
    expect(commands).toContain("setoption name UCI_Elo value 1950");
    expect(commands).toContain("position startpos moves e2e4");
    expect(commands.at(-1)).toBe("go movetime 1200 depth 12");
  });

  test("caps Stockfish command time to the remaining live-play budget", () => {
    const state = createInitialState("classic", "uci-budget");
    const commands = buildStockfishCommands(state, "grandmaster", ["h2h3"], 480);

    expect(commands.at(-1)).toBe("go movetime 480 depth 15");
  });
});
