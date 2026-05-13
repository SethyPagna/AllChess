import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, getVariant, variantCatalog } from "@/lib/variants";

describe("variant catalog", () => {
  test("contains the planned global launch variants", () => {
    expect(variantCatalog.map((variant) => variant.key)).toEqual([
      "classic",
      "chess960",
      "xiangqi",
      "shogi",
      "janggi",
      "makruk",
      "jungle",
      "antichess",
      "horde",
      "king-of-the-hill",
      "three-check"
    ]);
  });

  test("resolves aliases to their canonical variant", () => {
    expect(getVariant("chinese-chess").key).toBe("xiangqi");
  });
});

describe("variant engine", () => {
  test("creates a playable classic board with white to move", () => {
    const state = createInitialState("classic", "test-game");

    expect(state.board).toHaveLength(8);
    expect(state.board[0]).toHaveLength(8);
    expect(state.turn).toBe("white");
    expect(state.board[6][0].piece?.code).toBe("p");
  });

  test("applies a legal pawn move and records notation", () => {
    const state = createInitialState("classic", "test-game");
    const moves = getLegalMoves(state, { row: 6, col: 0 });

    expect(moves).toContainEqual({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } });

    const next = applyMove(state, moves[0]);

    expect(next.ply).toBe(1);
    expect(next.board[5][0].piece?.code).toBe("p");
    expect(next.moves[0].notation).toBe("P6,0-5,0");
  });

  test("allows classic pawns to move two squares from their starting rank", () => {
    const state = createInitialState("classic", "pawn-double");
    const moves = getLegalMoves(state, { row: 6, col: 4 });

    expect(moves).toContainEqual({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });
  });

  test("tracks captures and completed status after a royal capture", () => {
    let state = createInitialState("classic", "royal-capture");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[1][4].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };

    const next = applyMove(state, { from: { row: 1, col: 4 }, to: { row: 0, col: 4 } });

    expect(next.status).toBe("completed");
    expect(next.result).toBe("white");
    expect(next.captured).toContainEqual(expect.objectContaining({ code: "k", owner: "black" }));
  });

  test("blocks non-rat pieces from entering Jungle Chess rivers", () => {
    const state = createInitialState("jungle", "jungle-test");
    const tigerMoves = getLegalMoves(state, { row: 0, col: 6 });

    expect(tigerMoves.some((move) => state.board[move.to.row][move.to.col].terrain === "river")).toBe(false);
  });
});
