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

  test("declares a rules adapter for every launch variant", () => {
    expect(Object.fromEntries(variantCatalog.map((variant) => [variant.key, variant.rulesAdapter]))).toEqual({
      classic: "chessops",
      chess960: "chessops",
      xiangqi: "xiangqiops",
      shogi: "shogiops",
      janggi: "allchess-janggi",
      makruk: "makruk-js",
      jungle: "allchess-jungle",
      antichess: "chessops",
      horde: "chessops",
      "king-of-the-hill": "chessops",
      "three-check": "chessops"
    });
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

  test("check-based games never allow capturing a royal piece", () => {
    let state = createInitialState("classic", "royal-capture");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[1][4].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };

    expect(getLegalMoves(state, { row: 1, col: 4 })).not.toContainEqual({ from: { row: 1, col: 4 }, to: { row: 0, col: 4 } });
    expect(() => applyMove(state, { from: { row: 1, col: 4 }, to: { row: 0, col: 4 } })).toThrow("errors.invalidMove");
  });

  test("detects checkmate before a king can be captured", () => {
    let state = createInitialState("classic", "checkmate");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });

    expect(next.status).toBe("completed");
    expect(next.result).toBe("white");
    expect(next.board[0][0].piece).toEqual(expect.objectContaining({ code: "k", owner: "black" }));
  });

  test("forbids moving into check", () => {
    let state = createInitialState("classic", "self-check");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    expect(getLegalMoves(state, { row: 7, col: 4 })).not.toContainEqual({ from: { row: 7, col: 4 }, to: { row: 6, col: 4 } });
  });

  test("king of the hill ends when a king reaches the center", () => {
    let state = createInitialState("king-of-the-hill", "hill");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 4, col: 2 }, to: { row: 4, col: 3 } });

    expect(next.status).toBe("completed");
    expect(next.result).toBe("white");
  });

  test("three-check ends on the third delivered check", () => {
    let state = createInitialState("three-check", "three-check");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      checks: { black: 2 },
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[1][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };

    const next = applyMove(state, { from: { row: 1, col: 1 }, to: { row: 0, col: 1 } });

    expect(next.checks.black).toBe(3);
    expect(next.status).toBe("completed");
    expect(next.result).toBe("white");
  });

  test("blocks non-rat pieces from entering Jungle Chess rivers", () => {
    const state = createInitialState("jungle", "jungle-test");
    const tigerMoves = getLegalMoves(state, { row: 0, col: 6 });

    expect(tigerMoves.some((move) => state.board[move.to.row][move.to.col].terrain === "river")).toBe(false);
  });
});
