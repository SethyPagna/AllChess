import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, getVariant, variantCatalog } from "@/lib/variants";
import { ruleSources } from "@/lib/variants/rule-sources";

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

  test("keeps credible rule sources for implemented rule families", () => {
    expect(ruleSources.classic[0].url).toContain("fide");
    expect(ruleSources.xiangqi[0].name).toContain("World Xiangqi Federation");
    expect(ruleSources.shogi[0].name).toContain("Japan Shogi Association");
    expect(ruleSources.jungle[0].scope).toContain("den");
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

  test("promotes a western pawn immediately on the back rank", () => {
    let state = createInitialState("classic", "promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 1, col: 0 }, to: { row: 0, col: 0 }, promotion: true });

    expect(next.board[0][0].piece).toMatchObject({ code: "q", owner: "white", promoted: true });
  });

  test("allows legal kingside castling and moves the rook", () => {
    let state = createInitialState("classic", "castle");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[7][7].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    expect(getLegalMoves(state, { row: 7, col: 4 })).toContainEqual({ from: { row: 7, col: 4 }, to: { row: 7, col: 6 } });

    const next = applyMove(state, { from: { row: 7, col: 4 }, to: { row: 7, col: 6 } });

    expect(next.board[7][6].piece).toMatchObject({ code: "k", owner: "white" });
    expect(next.board[7][5].piece).toMatchObject({ code: "r", owner: "white" });
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

  test("draws classic chess when only the two kings remain", () => {
    let state = createInitialState("classic", "bare-kings");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 7, col: 4 }, to: { row: 6, col: 4 } });

    expect(next).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
  });

  test("draws classic chess after fifty full moves without capture or pawn movement", () => {
    let state = createInitialState("classic", "fifty-move");
    state = {
      ...state,
      halfmoveClock: 99,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[7][0].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[0][0].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    const next = applyMove(state, { from: { row: 7, col: 0 }, to: { row: 6, col: 0 } });

    expect(next).toMatchObject({ status: "completed", result: "draw", outcomeReason: "fifty-move", halfmoveClock: 100 });
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

  test("antichess enforces mandatory captures across the whole side", () => {
    let state = createInitialState("antichess", "antichess-capture");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][3].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[3][4].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    expect(getLegalMoves(state, { row: 4, col: 3 })).toEqual([{ from: { row: 4, col: 3 }, to: { row: 3, col: 4 } }]);
    expect(getLegalMoves(state, { row: 7, col: 4 })).toEqual([]);
    expect(() => applyMove(state, { from: { row: 4, col: 3 }, to: { row: 3, col: 3 } })).toThrow("errors.invalidMove");
  });

  test("antichess treats the king as a non-royal capturable piece", () => {
    let state = createInitialState("antichess", "antichess-king-capture");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][4].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[0][0].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" };

    const capture = { from: { row: 1, col: 4 }, to: { row: 0, col: 4 } };
    expect(getLegalMoves(state, capture.from)).toContainEqual(capture);
    expect(applyMove(state, capture).status).toBe("active");
  });

  test("antichess wins by losing all pieces or having no legal move", () => {
    let lostAllPieces = createInitialState("antichess", "antichess-no-pieces");
    lostAllPieces = {
      ...lostAllPieces,
      board: lostAllPieces.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    lostAllPieces.board[1][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    lostAllPieces.board[0][0].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" };

    expect(applyMove(lostAllPieces, { from: { row: 1, col: 1 }, to: { row: 0, col: 0 } })).toMatchObject({
      status: "completed",
      result: "black",
      outcomeReason: "lost-all-pieces"
    });

    let noLegalMove = createInitialState("antichess", "antichess-no-legal-move");
    noLegalMove = {
      ...noLegalMove,
      board: noLegalMove.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    noLegalMove.board[0][0].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    noLegalMove.board[7][7].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" };

    expect(applyMove(noLegalMove, { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } })).toMatchObject({
      status: "completed",
      result: "black",
      outcomeReason: "no-legal-moves"
    });
  });

  test("horde lets black win by eliminating the pawn army without marking the variant complete", () => {
    let state = createInitialState("horde", "horde-elimination");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "black"
    };
    state.board[0][0].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[1][0].piece = { id: "last-horde-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };

    expect(applyMove(state, { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } })).toMatchObject({
      status: "completed",
      result: "black",
      outcomeReason: "objective"
    });
  });

  test("xiangqi general and advisors stay inside the palace", () => {
    let state = createInitialState("xiangqi", "palace");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-general", code: "g", owner: "black", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "file-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 9, col: 4 })).toEqual(
      expect.arrayContaining([
        { from: { row: 9, col: 4 }, to: { row: 8, col: 4 } },
        { from: { row: 9, col: 4 }, to: { row: 9, col: 3 } },
        { from: { row: 9, col: 4 }, to: { row: 9, col: 5 } }
      ])
    );
    expect(getLegalMoves(state, { row: 9, col: 4 })).not.toContainEqual({ from: { row: 9, col: 4 }, to: { row: 8, col: 3 } });
    state.board[9][3].piece = { id: "red-advisor", code: "a", owner: "red", labelKey: "chess.bishop" };
    expect(getLegalMoves({ ...state, turn: "red" }, { row: 9, col: 3 })).toContainEqual({ from: { row: 9, col: 3 }, to: { row: 8, col: 4 } });
  });

  test("xiangqi prevents flying generals from facing each other", () => {
    let state = createInitialState("xiangqi", "flying-general");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-general", code: "g", owner: "black", labelKey: "chess.king" };
    state.board[4][4].piece = { id: "red-soldier", code: "p", owner: "red", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 4, col: 4 })).not.toContainEqual({ from: { row: 4, col: 4 }, to: { row: 4, col: 3 } });
  });

  test("xiangqi cannon captures only with exactly one screen", () => {
    let state = createInitialState("xiangqi", "cannon");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[0][4].piece = { id: "black-general", code: "g", owner: "black", labelKey: "chess.king" };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "red-cannon", code: "c", owner: "red", labelKey: "chess.rook" };
    state.board[3][4].piece = { id: "screen", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[1][4].piece = { id: "black-horse", code: "h", owner: "black", labelKey: "chess.knight" };
    state.board[2][4].piece = { id: "black-soldier", code: "p", owner: "black", labelKey: "chess.pawn" };

    const moves = getLegalMoves(state, { row: 5, col: 4 });

    expect(moves).toContainEqual({ from: { row: 5, col: 4 }, to: { row: 2, col: 4 } });
    expect(moves).not.toContainEqual({ from: { row: 5, col: 4 }, to: { row: 1, col: 4 } });
  });

  test("xiangqi horse legs and elephant eyes block movement", () => {
    let state = createInitialState("xiangqi", "blockers");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-general", code: "g", owner: "black", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "red-horse", code: "h", owner: "red", labelKey: "chess.knight" };
    state.board[4][4].piece = { id: "horse-leg", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[9][2].piece = { id: "red-elephant", code: "e", owner: "red", labelKey: "chess.elephant" };
    state.board[8][3].piece = { id: "elephant-eye", code: "p", owner: "red", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 5, col: 4 })).not.toContainEqual({ from: { row: 5, col: 4 }, to: { row: 3, col: 5 } });
    expect(getLegalMoves(state, { row: 9, col: 2 })).not.toContainEqual({ from: { row: 9, col: 2 }, to: { row: 7, col: 4 } });
    expect(getLegalMoves(state, { row: 9, col: 2 })).not.toContainEqual({ from: { row: 9, col: 2 }, to: { row: 5, col: 6 } });
  });

  test("xiangqi stalemate is a loss for the side with no legal move", () => {
    let state = createInitialState("xiangqi", "xiangqi-stalemate");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[0][4].piece = { id: "black-general", code: "g", owner: "black", labelKey: "chess.king" };
    state.board[2][3].piece = { id: "red-rook-left", code: "r", owner: "red", labelKey: "chess.rook" };
    state.board[1][5].piece = { id: "red-rook-right", code: "r", owner: "red", labelKey: "chess.rook" };
    state.board[3][3].piece = { id: "red-horse", code: "h", owner: "red", labelKey: "chess.knight" };
    state.board[5][4].piece = { id: "file-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 2, col: 3 }, to: { row: 1, col: 3 } });

    expect(next.status).toBe("completed");
    expect(next.result).toBe("red");
  });

  test("sets up Jungle Chess with opposing sides and blocks non-rats from rivers", () => {
    let state = createInitialState("jungle", "jungle-test");
    expect(state.board[0][0].piece).toMatchObject({ code: "l", owner: "black" });
    expect(state.board[8][6].piece).toMatchObject({ code: "l", owner: "white" });

    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[6][1].piece = { id: "white-dog", code: "d", owner: "white", labelKey: "chess.pawn" };
    state.board[6][2].piece = { id: "white-rat", code: "r", owner: "white", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 6, col: 1 })).not.toContainEqual({ from: { row: 6, col: 1 }, to: { row: 5, col: 1 } });
    expect(getLegalMoves(state, { row: 6, col: 2 })).toContainEqual({ from: { row: 6, col: 2 }, to: { row: 5, col: 2 } });
  });

  test("handles Jungle Chess lion and tiger river jumps with rat blockers", () => {
    let state = createInitialState("jungle", "jungle-jump");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[6][1].piece = { id: "white-tiger", code: "t", owner: "white", labelKey: "chess.rook" };
    state.board[2][1].piece = { id: "black-cat", code: "c", owner: "black", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 6, col: 1 })).toContainEqual({ from: { row: 6, col: 1 }, to: { row: 2, col: 1 } });

    state.board[4][1].piece = { id: "river-rat", code: "r", owner: "black", labelKey: "chess.pawn" };
    expect(getLegalMoves(state, { row: 6, col: 1 })).not.toContainEqual({ from: { row: 6, col: 1 }, to: { row: 2, col: 1 } });
  });

  test("applies Jungle Chess rank, rat-elephant, trap, and den objectives", () => {
    let state = createInitialState("jungle", "jungle-ranks");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][0].piece = { id: "white-rat", code: "r", owner: "white", labelKey: "chess.pawn" };
    state.board[3][0].piece = { id: "black-elephant", code: "e", owner: "black", labelKey: "chess.elephant" };
    expect(getLegalMoves(state, { row: 4, col: 0 })).toContainEqual({ from: { row: 4, col: 0 }, to: { row: 3, col: 0 } });

    state = { ...state, turn: "black" };
    expect(getLegalMoves(state, { row: 3, col: 0 })).not.toContainEqual({ from: { row: 3, col: 0 }, to: { row: 4, col: 0 } });

    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][1].piece = { id: "white-cat", code: "c", owner: "white", labelKey: "chess.pawn" };
    state.board[1][2].piece = { id: "black-elephant-trapped", code: "e", owner: "black", labelKey: "chess.elephant" };
    expect(getLegalMoves(state, { row: 1, col: 1 })).toContainEqual({ from: { row: 1, col: 1 }, to: { row: 1, col: 2 } });

    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[8][2].piece = { id: "white-dog", code: "d", owner: "white", labelKey: "chess.pawn" };
    expect(getLegalMoves(state, { row: 8, col: 2 })).not.toContainEqual({ from: { row: 8, col: 2 }, to: { row: 8, col: 3 } });

    state.board[1][3].piece = { id: "white-den-runner", code: "d", owner: "white", labelKey: "chess.pawn" };
    const denWin = applyMove({ ...state, turn: "white" }, { from: { row: 1, col: 3 }, to: { row: 0, col: 3 } });
    expect(denWin).toMatchObject({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("ends Jungle Chess when the last opposing animal is captured", () => {
    let state = createInitialState("jungle", "jungle-capture-all");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][0].piece = { id: "white-elephant", code: "e", owner: "white", labelKey: "chess.elephant" };
    state.board[0][0].piece = { id: "black-cat", code: "c", owner: "black", labelKey: "chess.pawn" };

    expect(applyMove(state, { from: { row: 1, col: 0 }, to: { row: 0, col: 0 } })).toMatchObject({
      status: "completed",
      result: "white",
      outcomeReason: "objective"
    });
  });
});
