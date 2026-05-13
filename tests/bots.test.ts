import { describe, expect, test } from "vitest";

import { chooseBotMove, chooseBotMoveSafe, botDifficultyLevels } from "@/lib/bots";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

describe("bot difficulty ladder", () => {
  test("defines the requested six difficulty levels in increasing search budget", () => {
    expect(botDifficultyLevels.map((level) => level.key)).toEqual(["easy", "normal", "hard", "very-hard", "nightmare", "hell"]);
    expect(botDifficultyLevels.map((level) => level.label)).toEqual(["Easy", "Normal", "Hard", "Very Hard", "Nightmare", "Hell"]);

    const budgets = botDifficultyLevels.map((level) => level.depth * level.moveTimeMs);
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets);
  });

  test("always chooses a legal move for every launch variant", () => {
    const variants = ["classic", "chess960", "xiangqi", "shogi", "janggi", "makruk", "jungle", "antichess", "horde", "king-of-the-hill", "three-check"];

    for (const variantKey of variants) {
      const state = createInitialState(variantKey, `${variantKey}-bot`);
      const botMove = chooseBotMove(state, "normal");
      const legalMoves = state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));

      expect(legalMoves).toContainEqual(expect.objectContaining({ from: botMove.from, to: botMove.to }));
      expect(() => applyMove(state, botMove)).not.toThrow();
    }
  });

  test("hell difficulty prefers immediate checkmate over material", () => {
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

    const move = chooseBotMove(state, "hell");

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
    const hell = chooseBotMove(state, "hell");

    expect(easy).not.toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(hell.to).toEqual({ row: 1, col: 1 });
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
});
