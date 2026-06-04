import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, formatVariantPlayMeta, getLegalMoves, getVariant, variantCatalog } from "@/lib/variants";
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
      "three-check",
      "racing-kings"
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
      "three-check": "chessops",
      "racing-kings": "chessops"
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

  test("formats play metadata from variant engine support", () => {
    expect(formatVariantPlayMeta(getVariant("classic"))).toBe("Rules checked / Engine-assisted bot");
    expect(formatVariantPlayMeta(getVariant("jungle"))).toBe("Rules checked / AllChess bot");
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

  test("racing kings starts without pawns on the shared race side", () => {
    const state = createInitialState("racing-kings", "racing-start");
    const pieces = state.board.flatMap((row) => row.map((cell) => cell.piece).filter(Boolean));

    expect(pieces).toHaveLength(16);
    expect(pieces.some((piece) => piece?.code === "p")).toBe(false);
    expect(state.board[7].map((cell) => cell.piece?.code ?? ".").join("")).toBe("qrbnnbrq");
    expect(state.board[7].slice(4, 7).map((cell) => cell.piece?.owner)).toEqual(["white", "white", "white"]);
    expect(state.board[6].map((cell) => cell.piece?.code ?? ".").join("")).toBe("krbnnbrk");
    expect(state.board[6].slice(4, 8).map((cell) => cell.piece?.owner)).toEqual(["white", "white", "white", "white"]);
  });

  test("racing kings forbids moves that give check", () => {
    let state = createInitialState("racing-kings", "racing-no-check");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[1][0].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    expect(getLegalMoves(state, { row: 1, col: 0 })).not.toContainEqual({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 } });
    expect(() => applyMove(state, { from: { row: 1, col: 0 }, to: { row: 0, col: 0 } })).toThrow("errors.invalidMove");
  });

  test("racing kings lets black draw immediately after white reaches the eighth rank", () => {
    let state = createInitialState("racing-kings", "racing-draw");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[1][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const whiteReached = applyMove(state, { from: { row: 1, col: 4 }, to: { row: 0, col: 4 } });

    expect(whiteReached.status).toBe("active");
    expect(whiteReached.result).toBeUndefined();
    expect(whiteReached.variantState).toMatchObject({ racingKingsWhiteReached: true });

    const drawn = applyMove(whiteReached, { from: { row: 1, col: 7 }, to: { row: 0, col: 7 } });

    expect(drawn).toMatchObject({ status: "completed", result: "draw", outcomeReason: "objective" });
  });

  test("racing kings awards black when black reaches the eighth rank first", () => {
    let state = createInitialState("racing-kings", "racing-black-win");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "black"
    };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[1][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    const next = applyMove(state, { from: { row: 1, col: 7 }, to: { row: 0, col: 7 } });

    expect(next).toMatchObject({ status: "completed", result: "black", outcomeReason: "objective" });
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

  test("horde starts with an asymmetric army and no white royal", () => {
    const state = createInitialState("horde", "horde-setup");
    const pieces = state.board.flatMap((row) => row.map((cell) => cell.piece).filter((piece) => piece !== null));
    const whitePieces = pieces.filter((piece) => piece.owner === "white");
    const blackPieces = pieces.filter((piece) => piece.owner === "black");

    expect(whitePieces).toHaveLength(32);
    expect(whitePieces.every((piece) => piece.code === "p")).toBe(true);
    expect(blackPieces).toHaveLength(16);
    expect(blackPieces.some((piece) => piece.code === "k")).toBe(true);
    expect(whitePieces.some((piece) => piece.code === "k")).toBe(false);
  });

  test("horde lets black win by eliminating the pawn army", () => {
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

  test("horde lets white checkmate black without a white king", () => {
    let state = createInitialState("horde", "horde-checkmate");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-pawn-cover", code: "p", owner: "white", labelKey: "chess.pawn" };

    expect(applyMove(state, { from: { row: 2, col: 1 }, to: { row: 1, col: 1 } })).toMatchObject({
      status: "completed",
      result: "white",
      outcomeReason: "checkmate"
    });
  });

  test("horde pawns still promote instead of triggering bare-material draws", () => {
    let state = createInitialState("horde", "horde-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[1][0].piece = { id: "horde-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };

    const promoted = applyMove(state, { from: { row: 1, col: 0 }, to: { row: 0, col: 0 } });

    expect(promoted).toMatchObject({ status: "active" });
    expect(promoted.board[0][0].piece).toMatchObject({ owner: "white", code: "q", promoted: true });
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

  test("shogi generates native movement and enforces drop restrictions", () => {
    let state = createInitialState("shogi", "shogi-drops");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: { p: 1, n: 1, l: 1, g: 1 }, gote: {} },
      turn: "sente"
    };
    state.board[8][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "chess.king" };
    state.board[6][4].piece = { id: "sente-file-pawn", code: "p", owner: "sente", labelKey: "chess.pawn" };
    state.board[4][4].piece = { id: "sente-silver", code: "s", owner: "sente", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 4, col: 4 })).toEqual(
      expect.arrayContaining([
        { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } },
        { from: { row: 4, col: 4 }, to: { row: 3, col: 4 } },
        { from: { row: 4, col: 4 }, to: { row: 3, col: 5 } },
        { from: { row: 4, col: 4 }, to: { row: 5, col: 3 } },
        { from: { row: 4, col: 4 }, to: { row: 5, col: 5 } }
      ])
    );
    expect(getLegalMoves(state, { row: 4, col: 4 })).not.toContainEqual({ from: { row: 4, col: 4 }, to: { row: 4, col: 3 } });

    const pawnDrop = { id: "sente-hand-pawn", code: "p", owner: "sente" as const, labelKey: "chess.pawn" };
    const knightDrop = { id: "sente-hand-knight", code: "n", owner: "sente" as const, labelKey: "chess.knight" };
    const lanceDrop = { id: "sente-hand-lance", code: "l", owner: "sente" as const, labelKey: "chess.rook" };
    expect(getLegalMoves(state, { drop: pawnDrop })).not.toContainEqual(expect.objectContaining({ to: { row: 5, col: 4 } }));
    expect(getLegalMoves(state, { drop: knightDrop })).not.toContainEqual(expect.objectContaining({ to: { row: 1, col: 0 } }));
    expect(getLegalMoves(state, { drop: lanceDrop })).not.toContainEqual(expect.objectContaining({ to: { row: 0, col: 0 } }));

    const goldDrop = { id: "sente-hand-gold", code: "g", owner: "sente" as const, labelKey: "chess.king" };
    const legalGoldDrop = getLegalMoves(state, { drop: goldDrop }).find((move) => move.to.row === 4 && move.to.col === 3);
    expect(legalGoldDrop).toEqual(expect.objectContaining({ kind: "drop", drop: goldDrop }));

    const dropped = applyMove(state, legalGoldDrop!);
    expect(dropped.board[4][3].piece).toMatchObject({ code: "g", owner: "sente", promoted: false });
    expect(dropped.hands?.sente?.g).toBeUndefined();
    expect(dropped.moves[0].notation).toBe("G*4,3");
  });

  test("shogi captures add demoted pieces to the capturer hand", () => {
    let state = createInitialState("shogi", "shogi-capture-hand");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: {}, gote: {} },
      turn: "sente"
    };
    state.board[8][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "chess.king" };
    state.board[4][0].piece = { id: "sente-rook", code: "r", owner: "sente", labelKey: "chess.rook" };
    state.board[4][4].piece = { id: "gote-promoted-pawn", code: "p", owner: "gote", labelKey: "chess.pawn", promoted: true };

    const next = applyMove(state, { from: { row: 4, col: 0 }, to: { row: 4, col: 4 } });

    expect(next.hands?.sente?.p).toBe(1);
    expect(next.captured[0]).toMatchObject({ code: "p", owner: "gote", promoted: true });
  });

  test("shogi forbids pawn-drop mate but allows answerable pawn drops", () => {
    let answerable = createInitialState("shogi", "shogi-answerable-pawn-drop");
    answerable = {
      ...answerable,
      board: answerable.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: { p: 1 }, gote: {} },
      turn: "sente"
    };
    answerable.board[8][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "chess.king" };
    answerable.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "chess.king" };
    const pawnDrop = { id: "sente-hand-pawn", code: "p", owner: "sente" as const, labelKey: "chess.pawn" };

    expect(getLegalMoves(answerable, { drop: pawnDrop })).toContainEqual(expect.objectContaining({ kind: "drop", to: { row: 1, col: 4 } }));

    let mate = createInitialState("shogi", "shogi-pawn-drop-mate");
    mate = {
      ...mate,
      board: mate.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: { p: 1 }, gote: {} },
      turn: "sente"
    };
    mate.board[8][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "chess.king" };
    mate.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "chess.king" };
    mate.board[2][3].piece = { id: "sente-left-rook", code: "r", owner: "sente", labelKey: "chess.rook" };
    mate.board[2][4].piece = { id: "sente-gold-cover", code: "g", owner: "sente", labelKey: "chess.king" };
    mate.board[2][5].piece = { id: "sente-right-rook", code: "r", owner: "sente", labelKey: "chess.rook" };

    expect(getLegalMoves(mate, { drop: pawnDrop })).not.toContainEqual(expect.objectContaining({ to: { row: 1, col: 4 } }));
    expect(() => applyMove(mate, { kind: "drop", from: { row: -1, col: -1 }, to: { row: 1, col: 4 }, drop: pawnDrop })).toThrow("errors.invalidMove");
  });

  test("shogi records fourfold repetition as a draw", () => {
    let state = createInitialState("shogi", "shogi-repetition");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: {}, gote: {} },
      turn: "sente"
    };
    state.board[8][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "chess.king" };
    state.board[7][0].piece = { id: "sente-rook", code: "r", owner: "sente", labelKey: "chess.rook" };
    state.board[1][0].piece = { id: "gote-rook", code: "r", owner: "gote", labelKey: "chess.rook" };

    const cycleMoves = [
      { from: { row: 7, col: 0 }, to: { row: 7, col: 1 } },
      { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } },
      { from: { row: 7, col: 1 }, to: { row: 7, col: 0 } },
      { from: { row: 1, col: 1 }, to: { row: 1, col: 0 } }
    ];
    for (let cycle = 0; cycle < 4 && state.status === "active"; cycle += 1) {
      for (const move of cycleMoves) {
        state = applyMove(state, move);
        if (state.status === "completed") break;
      }
    }

    expect(state).toMatchObject({ status: "completed", result: "draw", outcomeReason: "repetition" });
    expect(state.variantState?.shogiRepetition).toMatchObject({ count: 4, checker: null });
  });

  test("shogi impasse adjudicates entered kings by material points", () => {
    let state = createInitialState("shogi", "shogi-impasse");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: { r: 2, b: 1, g: 4 }, gote: { r: 2, b: 1, g: 4 } },
      turn: "sente"
    };
    state.board[0][4].piece = { id: "sente-king-entered", code: "k", owner: "sente", labelKey: "chess.king" };
    state.board[8][4].piece = { id: "gote-king-entered", code: "k", owner: "gote", labelKey: "chess.king" };
    state.board[1][0].piece = { id: "sente-rook", code: "r", owner: "sente", labelKey: "chess.rook" };
    state.board[7][0].piece = { id: "gote-rook", code: "r", owner: "gote", labelKey: "chess.rook" };

    const adjudicated = applyMove(state, { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } });

    expect(adjudicated).toMatchObject({ status: "completed", result: "draw", outcomeReason: "impasse" });
    expect(adjudicated.variantState?.shogiImpasse).toMatchObject({
      sentePoints: 24,
      gotePoints: 24,
      senteKingEntered: true,
      goteKingEntered: true
    });
  });

  test("makruk setup uses one king and one met per side", () => {
    const state = createInitialState("makruk", "makruk-setup");
    const whitePieces = state.board.flatMap((row) => row.map((cell) => cell.piece).filter((piece) => piece?.owner === "white"));
    const blackPieces = state.board.flatMap((row) => row.map((cell) => cell.piece).filter((piece) => piece?.owner === "black"));

    expect(whitePieces.filter((piece) => piece?.code === "k")).toHaveLength(1);
    expect(whitePieces.filter((piece) => piece?.code === "m")).toHaveLength(1);
    expect(blackPieces.filter((piece) => piece?.code === "k")).toHaveLength(1);
    expect(blackPieces.filter((piece) => piece?.code === "m")).toHaveLength(1);
  });

  test("makruk met, khon, and pawns use native movement", () => {
    let state = createInitialState("makruk", "makruk-movement");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[4][4].piece = { id: "white-met", code: "m", owner: "white", labelKey: "chess.queen" };
    state.board[5][2].piece = { id: "white-khon", code: "s", owner: "white", labelKey: "chess.bishop" };
    state.board[5][6].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[4][7].piece = { id: "black-target", code: "p", owner: "black", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 4, col: 4 })).toEqual(
      expect.arrayContaining([
        { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } },
        { from: { row: 4, col: 4 }, to: { row: 5, col: 5 } }
      ])
    );
    expect(getLegalMoves(state, { row: 4, col: 4 })).not.toContainEqual({ from: { row: 4, col: 4 }, to: { row: 3, col: 4 } });

    expect(getLegalMoves(state, { row: 5, col: 2 })).toEqual(
      expect.arrayContaining([
        { from: { row: 5, col: 2 }, to: { row: 4, col: 2 } },
        { from: { row: 5, col: 2 }, to: { row: 4, col: 1 } },
        { from: { row: 5, col: 2 }, to: { row: 6, col: 3 } }
      ])
    );
    expect(getLegalMoves(state, { row: 5, col: 2 })).not.toContainEqual({ from: { row: 5, col: 2 }, to: { row: 5, col: 3 } });

    expect(getLegalMoves(state, { row: 5, col: 6 })).toContainEqual({ from: { row: 5, col: 6 }, to: { row: 4, col: 6 } });
    expect(getLegalMoves(state, { row: 5, col: 6 })).toContainEqual({ from: { row: 5, col: 6 }, to: { row: 4, col: 7 } });
    expect(getLegalMoves(state, { row: 5, col: 6 })).not.toContainEqual({ from: { row: 5, col: 6 }, to: { row: 3, col: 6 } });
  });

  test("makruk pawns promote to met on the sixth rank", () => {
    let state = createInitialState("makruk", "makruk-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[3][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };

    const promoted = applyMove(state, { from: { row: 3, col: 0 }, to: { row: 2, col: 0 } });

    expect(promoted.board[2][0].piece).toMatchObject({ code: "m", owner: "white", promoted: true });
  });

  test("makruk starts board counting when no unpromoted pawns remain", () => {
    let state = createInitialState("makruk", "makruk-board-count");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[7][0].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[0][0].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    const started = applyMove(state, { from: { row: 7, col: 0 }, to: { row: 6, col: 0 } });
    expect(started.variantState?.makrukCounting).toMatchObject({ phase: "board", limit: 64, remainingMoves: 64, pieceCount: 4 });

    const continued = applyMove(started, { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } });
    expect(continued.variantState?.makrukCounting).toMatchObject({ phase: "board", limit: 64, remainingMoves: 63, pieceCount: 4 });
  });

  test("makruk bare-king counting expires as a draw", () => {
    let state = createInitialState("makruk", "makruk-bare-king-count");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[7][4].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[7][0].piece = { id: "white-rook-left", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[7][7].piece = { id: "white-rook-right", code: "r", owner: "white", labelKey: "chess.rook" };

    const started = applyMove(state, { from: { row: 7, col: 0 }, to: { row: 6, col: 0 } });
    expect(started.variantState?.makrukCounting).toMatchObject({
      phase: "bare-king",
      strongerSide: "white",
      limit: 4,
      remainingMoves: 4,
      pieceCount: 4
    });

    const almostExpired = {
      ...started,
      variantState: {
        ...started.variantState,
        makrukCounting: { phase: "bare-king", startedAtPly: started.ply, remainingMoves: 1, limit: 4, strongerSide: "white", pieceCount: 4 }
      }
    };
    const drawn = applyMove(almostExpired, { from: { row: 0, col: 4 }, to: { row: 0, col: 3 } });

    expect(drawn).toMatchObject({ status: "completed", result: "draw", outcomeReason: "counting-rule" });
    expect(drawn.variantState?.makrukCounting).toMatchObject({ phase: "bare-king", remainingMoves: 0 });
  });

  test("janggi generals and guards follow palace lines including diagonals", () => {
    let state = createInitialState("janggi", "janggi-palace");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[8][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };

    expect(getLegalMoves(state, { row: 8, col: 4 })).toEqual(
      expect.arrayContaining([
        { from: { row: 8, col: 4 }, to: { row: 7, col: 3 } },
        { from: { row: 8, col: 4 }, to: { row: 7, col: 5 } },
        { from: { row: 8, col: 4 }, to: { row: 9, col: 3 } },
        { from: { row: 8, col: 4 }, to: { row: 9, col: 5 } }
      ])
    );

    state.board[8][3].piece = { id: "red-guard", code: "a", owner: "red", labelKey: "chess.bishop" };
    expect(getLegalMoves({ ...state, turn: "red" }, { row: 8, col: 3 })).not.toContainEqual({ from: { row: 8, col: 3 }, to: { row: 7, col: 4 } });
  });

  test("janggi cannons require a non-cannon screen and cannot capture cannons", () => {
    let state = createInitialState("janggi", "janggi-cannon");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[5][0].piece = { id: "red-cannon", code: "c", owner: "red", labelKey: "chess.rook" };
    state.board[4][0].piece = { id: "screen", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[2][0].piece = { id: "blue-horse", code: "h", owner: "blue", labelKey: "chess.knight" };
    state.board[1][0].piece = { id: "blue-cannon", code: "c", owner: "blue", labelKey: "chess.rook" };

    expect(getLegalMoves(state, { row: 5, col: 0 })).toContainEqual({ from: { row: 5, col: 0 }, to: { row: 3, col: 0 } });
    expect(getLegalMoves(state, { row: 5, col: 0 })).toContainEqual({ from: { row: 5, col: 0 }, to: { row: 2, col: 0 } });
    expect(getLegalMoves(state, { row: 5, col: 0 })).not.toContainEqual({ from: { row: 5, col: 0 }, to: { row: 1, col: 0 } });

    state.board[5][2].piece = { id: "screenless-cannon", code: "c", owner: "red", labelKey: "chess.rook" };
    expect(getLegalMoves(state, { row: 5, col: 2 })).not.toContainEqual({ from: { row: 5, col: 2 }, to: { row: 4, col: 2 } });

    state.board[9][3].piece = { id: "palace-cannon", code: "c", owner: "red", labelKey: "chess.rook" };
    state.board[8][4].piece = { id: "palace-screen", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[7][5].piece = { id: "palace-target", code: "h", owner: "blue", labelKey: "chess.knight" };
    expect(getLegalMoves(state, { row: 9, col: 3 })).toContainEqual({ from: { row: 9, col: 3 }, to: { row: 7, col: 5 } });
  });

  test("janggi elephants use native long elephant paths without xiangqi river limits", () => {
    let state = createInitialState("janggi", "janggi-elephant");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[1][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[6][4].piece = { id: "red-elephant", code: "e", owner: "red", labelKey: "chess.elephant" };

    expect(getLegalMoves(state, { row: 6, col: 4 })).toContainEqual({ from: { row: 6, col: 4 }, to: { row: 3, col: 2 } });
    state.board[5][4].piece = { id: "elephant-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };
    expect(getLegalMoves(state, { row: 6, col: 4 })).not.toContainEqual({ from: { row: 6, col: 4 }, to: { row: 3, col: 2 } });
  });

  test("janggi soldiers can move sideways immediately and diagonally along enemy palace lines", () => {
    let state = createInitialState("janggi", "janggi-soldier");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[6][4].piece = { id: "red-soldier", code: "p", owner: "red", labelKey: "chess.pawn" };

    expect(getLegalMoves(state, { row: 6, col: 4 })).toEqual(
      expect.arrayContaining([
        { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } },
        { from: { row: 6, col: 4 }, to: { row: 6, col: 3 } },
        { from: { row: 6, col: 4 }, to: { row: 6, col: 5 } }
      ])
    );

    state.board[6][4].piece = null;
    state.board[2][3].piece = { id: "palace-soldier", code: "p", owner: "red", labelKey: "chess.pawn" };
    expect(getLegalMoves(state, { row: 2, col: 3 })).toContainEqual({ from: { row: 2, col: 3 }, to: { row: 1, col: 4 } });
  });

  test("janggi bikjang asks the next player to resolve facing generals", () => {
    let state = createInitialState("janggi", "janggi-bikjang-pending");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "file-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[3][3].piece = { id: "blue-resolver", code: "p", owner: "blue", labelKey: "chess.pawn" };

    const pending = applyMove(state, { from: { row: 5, col: 4 }, to: { row: 5, col: 3 } });
    expect(pending).toMatchObject({ status: "active", turn: "blue", variantState: { bikjangPlayer: "blue" } });

    const resolved = applyMove(pending, { from: { row: 3, col: 3 }, to: { row: 3, col: 4 } });
    expect(resolved).toMatchObject({ status: "active" });
    expect(resolved.variantState?.bikjangPlayer).toBeNull();
  });

  test("janggi bikjang draws when the next player does not resolve facing generals", () => {
    let state = createInitialState("janggi", "janggi-bikjang-draw");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "file-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };
    state.board[3][0].piece = { id: "blue-irrelevant", code: "p", owner: "blue", labelKey: "chess.pawn" };

    const pending = applyMove(state, { from: { row: 5, col: 4 }, to: { row: 5, col: 3 } });
    const drawn = applyMove(pending, { from: { row: 3, col: 0 }, to: { row: 3, col: 1 } });

    expect(drawn).toMatchObject({ status: "completed", result: "draw", outcomeReason: "draw" });
  });

  test("janggi pass is illegal while in check", () => {
    let state = createInitialState("janggi", "janggi-pass-check");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "blue"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[3][4].piece = { id: "red-chariot-check", code: "r", owner: "red", labelKey: "chess.rook" };

    expect(() => applyMove(state, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } })).toThrow("errors.invalidMove");
  });

  test("janggi consecutive passes adjudicate material scoring", () => {
    let state = createInitialState("janggi", "janggi-pass-scoring");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][3].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[8][0].piece = { id: "red-chariot", code: "r", owner: "red", labelKey: "chess.rook" };
    state.board[1][0].piece = { id: "blue-horse", code: "h", owner: "blue", labelKey: "chess.knight" };

    const redPassed = applyMove(state, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } });
    expect(redPassed).toMatchObject({ status: "active", turn: "blue" });
    expect(redPassed.moves[0].notation).toBe("pass");

    const scored = applyMove(redPassed, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } });
    expect(scored).toMatchObject({ status: "completed", result: "red", outcomeReason: "scoring" });
    expect(scored.variantState?.janggiScoring).toMatchObject({
      redPoints: 13,
      bluePoints: 5,
      redPieceCounts: { g: 1, r: 1 },
      bluePieceCounts: { g: 1, h: 1 }
    });
  });

  test("janggi pass preserves bikjang draw policy", () => {
    let state = createInitialState("janggi", "janggi-bikjang-pass");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "red"
    };
    state.board[9][4].piece = { id: "red-general", code: "g", owner: "red", labelKey: "chess.king" };
    state.board[0][4].piece = { id: "blue-general", code: "g", owner: "blue", labelKey: "chess.king" };
    state.board[5][4].piece = { id: "file-blocker", code: "p", owner: "red", labelKey: "chess.pawn" };

    const pending = applyMove(state, { from: { row: 5, col: 4 }, to: { row: 5, col: 3 } });
    const drawn = applyMove(pending, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } });

    expect(drawn).toMatchObject({ status: "completed", result: "draw", outcomeReason: "draw" });
    expect(drawn.variantState?.janggiScoring).toMatchObject({ redPoints: 2, bluePoints: 0 });
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
