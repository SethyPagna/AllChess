import { describe, expect, test } from "vitest";

import { chooseBotMove, botDifficultyLevels } from "@/lib/bots";
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

  test("hell difficulty prefers captures when a tactical capture is available", () => {
    let state = createInitialState("classic", "capture-test");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][4].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[4][7].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    const move = chooseBotMove(state, "hell");

    expect(move.to).toEqual({ row: 4, col: 7 });
  });
});
