import { describe, expect, test } from "vitest";

import { cancelBotMove, chooseBotMove, chooseBotMoveSafe, botDifficultyLevels, requestBotMove } from "@/lib/bots";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

describe("bot difficulty ladder", () => {
  test("defines the requested six difficulty levels in increasing search budget", () => {
    expect(botDifficultyLevels.map((level) => level.key)).toEqual(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]);
    expect(botDifficultyLevels.map((level) => level.label)).toEqual(["Easy", "Normal", "Hard", "Very Hard", "Grandmaster", "Legend"]);

    const budgets = botDifficultyLevels.map((level) => level.depth * level.moveTimeMs);
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets);
    expect(botDifficultyLevels.map((level) => level.beamWidth)).toEqual([4, 8, 14, 20, 32, 44]);
    expect(botDifficultyLevels.map((level) => level.quiescenceDepth)).toEqual([0, 0, 1, 1, 2, 4]);
    expect(botDifficultyLevels.map((level) => level.riskTolerance)).toEqual([0.85, 0.65, 0.45, 0.28, 0.12, 0.03]);
  });

  test("always chooses a legal move for every launch variant", () => {
    const variants = ["classic", "chess960", "xiangqi", "shogi", "janggi", "makruk", "jungle", "antichess", "horde", "king-of-the-hill", "three-check"];

    for (const variantKey of variants) {
      const state = createInitialState(variantKey, `${variantKey}-bot`);
      const botMove = chooseBotMove(state, "normal", { maxSearchTimeMs: 40 });
      const legalMoves = state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));

      expect(legalMoves).toContainEqual(expect.objectContaining({ from: botMove.from, to: botMove.to }));
      expect(() => applyMove(state, botMove)).not.toThrow();
    }
  }, 15_000);

  test("legend difficulty prefers immediate checkmate over material", () => {
    let state = createInitialState("classic", "mate-test");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[7][7].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    const move = chooseBotMove(state, "legend");

    expect(move).toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(applyMove(state, move)).toMatchObject({ status: "completed", result: "white" });
  });

  test("difficulty changes strategy instead of only relabeling the same move", () => {
    let state = createInitialState("classic", "difficulty-test");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const easy = chooseBotMove(state, "easy");
    const legend = chooseBotMove(state, "legend");

    expect(easy).not.toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(legend.to).toEqual({ row: 1, col: 1 });
  });

  test("legend difficulty values promotion as a decisive strategic gain", () => {
    let state = createInitialState("classic", "bot-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    expect(chooseBotMove(state, "legend")).toMatchObject({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 } });
  });

  test("safe bot move returns a completed state instead of throwing when no legal moves exist", () => {
    const state = createInitialState("classic", "no-moves");
    const blocked = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      status: "active" as const,
      turn: "white" as const
    };

    expect(chooseBotMoveSafe(blocked, "normal")).toEqual({ move: null, reason: "no-legal-moves" });
  });

  test("async bot request reports a validated legal move with search metadata", async () => {
    const state = createInitialState("classic", "async-bot");

    const result = await requestBotMove(state, "hard", { engine: "internal", maxSearchTimeMs: 60 });

    expect(result.status).toBe("ok");
    expect(result.move).toBeTruthy();
    expect(result.engine).toBe("internal");
    expect(result.validatedLegal).toBe(true);
    expect(result.depthReached).toBeGreaterThanOrEqual(1);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.nodesSearched).toBeGreaterThan(0);
    expect(result.evaluation).toEqual(expect.any(Number));
  });

  test("cancelled async bot request never applies a stale move", async () => {
    const state = createInitialState("classic", "cancel-bot");
    const pending = requestBotMove(state, "legend", { requestId: "cancel-me", delayMs: 25, maxSearchTimeMs: 80 });

    cancelBotMove("cancel-me");

    await expect(pending).resolves.toMatchObject({
      status: "cancelled",
      move: null,
      tier: "legend",
      engine: "internal",
      legal: false,
      validatedLegal: false
    });
  });

  test("internal search avoids an obviously hanging queen when a safe mate is available", () => {
    let state = createInitialState("classic", "queen-hanging");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    expect(chooseBotMove(state, "legend", { engine: "internal" })).toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
  });

  test("async bot result exposes public benchmark fields", async () => {
    const state = createInitialState("classic", "public-bot-result");

    const result = await requestBotMove(state, "grandmaster", { engine: "internal", maxSearchTimeMs: 70 });

    expect(result).toMatchObject({
      status: "ok",
      tier: "grandmaster",
      legal: true,
      benchmarkVersion: "allchess-bench-v1"
    });
    expect(result.depth).toBe(result.depthReached);
    expect(result.nodes).toBe(result.nodesSearched);
    expect(result.pv).toEqual(result.principalVariation);
    expect(result.confidence).toBeGreaterThanOrEqual(0.82);
  });
});
