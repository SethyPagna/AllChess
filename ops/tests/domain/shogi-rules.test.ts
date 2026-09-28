import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, isRoyal, type GameState, type Move, type Piece, type PlayerColor } from "@/lib/variants";

function emptyBoard(variantKey: string, id: string, hands: GameState["hands"] = {}): GameState {
  const state = createInitialState(variantKey, id);
  return { ...state, board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))), hands, turn: "sente" };
}

function place(state: GameState, row: number, col: number, code: string, owner: PlayerColor) {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: "chess.pawn" };
}

function move(fromRow: number, fromCol: number, toRow: number, toCol: number): Move {
  return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
}

function drop(code: string, owner: PlayerColor, row: number, col: number): Move {
  const piece: Piece = { id: `${owner}-hand-${code}`, code, owner, labelKey: "chess.pawn" };
  return { kind: "drop", from: { row: -1, col: -1 }, to: { row, col }, drop: piece };
}

function allLegalMoves(state: GameState) {
  const fromBoard = state.board.flatMap((row) => row.flatMap((cell) => (cell.piece?.owner === state.turn ? getLegalMoves(state, cell.square) : [])));
  const fromHand = Object.entries(state.hands?.[state.turn] ?? {}).flatMap(([code, count]) =>
    count > 0 ? getLegalMoves(state, { drop: { id: `hand-${code}`, code, owner: state.turn, labelKey: "chess.pawn" } }) : []
  );
  return [...fromBoard, ...fromHand];
}

describe("shogi royalty: only the king is royal, golds are ordinary pieces", () => {
  test("the gold general is royal only as the Xiangqi/Janggi general", () => {
    const gold: Piece = { id: "g", code: "g", owner: "sente", labelKey: "chess.pawn" };
    expect(isRoyal(gold, "shogi")).toBe(false);
    expect(isRoyal(gold, "mini-shogi")).toBe(false);
    expect(isRoyal({ ...gold, owner: "red" }, "xiangqi")).toBe(true);
    expect(isRoyal({ ...gold, owner: "blue" }, "janggi")).toBe(true);
    expect(isRoyal({ ...gold, code: "k" }, "shogi")).toBe(true);
  });

  test("a rook captures an undefended gold and the gold goes to the captor's hand", () => {
    const state = emptyBoard("shogi", "shogi-gold-capture", { sente: {}, gote: {} });
    place(state, 8, 4, "k", "sente");
    place(state, 0, 4, "k", "gote");
    place(state, 4, 0, "r", "sente");
    place(state, 4, 6, "g", "gote");

    expect(getLegalMoves(state, { row: 4, col: 0 })).toContainEqual(move(4, 0, 4, 6));
    const next = applyMove(state, move(4, 0, 4, 6));
    expect(next.board[4][6].piece).toMatchObject({ code: "r", owner: "sente" });
    expect(next.hands?.sente?.g).toBe(1);
    expect(next.status).toBe("active");
  });

  test("a mini-shogi rook captures a gold", () => {
    const state = emptyBoard("mini-shogi", "mini-shogi-gold-capture", { sente: {}, gote: {} });
    place(state, 4, 4, "k", "sente");
    place(state, 0, 4, "k", "gote");
    place(state, 2, 0, "r", "sente");
    place(state, 0, 0, "g", "gote");

    const next = applyMove(state, move(2, 0, 0, 0));
    expect(next.hands?.sente?.g).toBe(1);
    expect(next.status).toBe("active");
  });

  test("a check on the king is detected from the opening while the golds stand on their home squares", () => {
    let state = createInitialState("shogi", "shogi-opening-king-check");
    state = applyMove(state, move(6, 2, 5, 2));
    state = applyMove(state, move(2, 6, 3, 6));
    state = applyMove(state, move(7, 1, 1, 7));
    state = applyMove(state, move(0, 6, 1, 7));
    state = applyMove(state, drop("b", "sente", 4, 8));

    expect(state.checks.gote).toBe(1);
    expect(state.status).toBe("active");
    expect(() => applyMove(state, move(2, 0, 3, 0))).toThrow("errors.invalidMove");
    const answers = ["1,5", "2,6", "3,7", "4,8"];
    const replies = allLegalMoves(state);
    expect(replies.length).toBeGreaterThan(0);
    for (const reply of replies) {
      const movesKing = reply.from.row === 0 && reply.from.col === 4;
      expect(movesKing || answers.includes(`${reply.to.row},${reply.to.col}`)).toBe(true);
    }
  });

  test("a back-rank rook mate on the king is checkmate even with a gold elsewhere on the board", () => {
    const state = emptyBoard("shogi", "shogi-back-rank-mate", { sente: {}, gote: {} });
    place(state, 8, 4, "k", "sente");
    place(state, 0, 4, "k", "gote");
    place(state, 0, 0, "g", "gote");
    place(state, 1, 7, "r", "sente");
    place(state, 4, 8, "r", "sente");

    const mated = applyMove(state, move(4, 8, 0, 8));
    expect(mated).toMatchObject({ status: "completed", result: "sente", outcomeReason: "checkmate" });
    expect(mated.checks.gote).toBe(1);
  });

  test("a trapped gold with a safe king does not end the game", () => {
    const state = emptyBoard("shogi", "shogi-trapped-gold", { sente: {}, gote: {} });
    place(state, 8, 4, "k", "sente");
    place(state, 0, 8, "k", "gote");
    place(state, 0, 0, "g", "gote");
    place(state, 2, 0, "r", "sente");
    place(state, 5, 1, "r", "sente");

    const next = applyMove(state, move(5, 1, 2, 1));
    expect(next.status).toBe("active");
    expect(next.checks.gote).toBeUndefined();
    expect(allLegalMoves(next)).toContainEqual(move(0, 8, 1, 8));
  });

  test("a gold may be dropped onto an enemy rook's rank while the king is safe", () => {
    const state = emptyBoard("shogi", "shogi-gold-drop-safe", { sente: { g: 1 }, gote: {} });
    place(state, 8, 4, "k", "sente");
    place(state, 0, 4, "k", "gote");
    place(state, 4, 7, "r", "gote");

    expect(getLegalMoves(state, { drop: drop("g", "sente", 4, 2).drop! })).toContainEqual(expect.objectContaining({ to: { row: 4, col: 2 } }));
  });

  test("a mini-shogi king in check on its back rank may only answer the check with a gold drop", () => {
    const state = emptyBoard("mini-shogi", "mini-shogi-gold-block", { sente: { g: 1 }, gote: {} });
    place(state, 4, 0, "k", "sente");
    place(state, 3, 0, "p", "sente");
    place(state, 3, 1, "s", "sente");
    place(state, 0, 4, "k", "gote");
    place(state, 4, 4, "r", "gote");
    state.turn = "sente";

    const goldDrops = getLegalMoves(state, { drop: drop("g", "sente", 4, 1).drop! }).map((candidate) => candidate.to);
    expect(goldDrops).toEqual(expect.arrayContaining([{ row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }]));
    expect(goldDrops.every((square) => square.row === 4)).toBe(true);
  });

  test("Xiangqi and Janggi generals stay royal", () => {
    const xiangqi = createInitialState("xiangqi", "xiangqi-general-royal");
    const board = xiangqi.board.map((row) => row.map((cell) => ({ ...cell, piece: null })));
    const state: GameState = { ...xiangqi, board, turn: "red" };
    place(state, 9, 4, "g", "red");
    place(state, 0, 3, "g", "black");
    place(state, 5, 4, "r", "black");

    expect(getLegalMoves(state, { row: 9, col: 4 })).not.toContainEqual(move(9, 4, 8, 4));
    const janggi = createInitialState("janggi", "janggi-general-royal");
    expect(janggi.board[1][4].piece).toMatchObject({ code: "g" });
    expect(isRoyal(janggi.board[1][4].piece!, "janggi")).toBe(true);
  });
});

describe("shogi impasse", () => {
  test("mini-shogi has no impasse: kings meeting on the middle rank keep the game going", () => {
    let state = createInitialState("mini-shogi", "mini-shogi-no-impasse");
    state = applyMove(state, move(4, 0, 3, 1));
    state = applyMove(state, move(0, 4, 1, 3));
    state = applyMove(state, move(3, 1, 2, 1));
    state = applyMove(state, move(1, 3, 2, 3));

    expect(state.status).toBe("active");
    expect(state.outcomeReason).toBeUndefined();
    expect(allLegalMoves(state).length).toBeGreaterThan(0);
  });

  test("mini-shogi kings deep in the opposing camps do not trigger impasse", () => {
    const state = emptyBoard("mini-shogi", "mini-shogi-deep-kings", { sente: {}, gote: {} });
    place(state, 0, 0, "k", "sente");
    place(state, 4, 4, "k", "gote");
    place(state, 2, 2, "s", "sente");
    place(state, 1, 4, "s", "gote");

    const next = applyMove(state, move(2, 2, 1, 2));
    expect(next.status).toBe("active");
    expect(next.outcomeReason).toBeUndefined();
  });

  test("shogi impasse waits until the side to move is out of check", () => {
    const state = emptyBoard("shogi", "shogi-impasse-in-check", { sente: {}, gote: { r: 2, b: 2, g: 4 } });
    place(state, 3, 4, "k", "sente");
    place(state, 1, 4, "r", "sente");
    place(state, 6, 4, "k", "gote");

    const discovered = applyMove(state, move(3, 4, 2, 3));
    expect(discovered.status).toBe("active");
    expect(discovered.outcomeReason).toBeUndefined();
    expect(discovered.checks.gote).toBe(1);
    expect(() => applyMove(discovered, drop("g", "gote", 7, 0))).toThrow("errors.invalidMove");

    const blocked = applyMove(discovered, drop("g", "gote", 4, 4));
    expect(blocked).toMatchObject({ status: "completed", result: "gote", outcomeReason: "impasse" });
  });
});
