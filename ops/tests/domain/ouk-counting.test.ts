import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, type GameState } from "@/lib/variants";
import { applyOukCountAction, getOukCountChoices, oukPieceCountLimit, readOukCount, withOukBotCount } from "@/lib/variants/ouk-counting";
import { createOukEndgame } from "@/lib/variants/ouk-endgames";
import { describeGameOutcome } from "@/lib/game/outcome";

const move = (state: GameState, r1: number, c1: number, r2: number, c2: number) => applyMove(state, { from: { row: r1, col: c1 }, to: { row: r2, col: c2 } });
const mate = (state: GameState) => move(state, 2, 1, 2, 0);

describe("Ouk Chaktrang explicit counting", () => {
  test("requires an eligible player and their turn to start", () => {
    expect(() => applyOukCountAction(createInitialState("ouk-chaktrang"), "white", "start-board")).toThrow();
    const state = createOukEndgame("two-rooks");
    expect(() => applyOukCountAction(state, "black", "start-board")).toThrow();
    expect(() => applyOukCountAction(createInitialState("classic"), "white", "start-board")).toThrow();
    expect(getOukCountChoices(state, "white")).toMatchObject({ board: true, pieces: true, pieceStart: 5, pieceLimit: 8 });
  });
  test.each([["rr", 8], ["r", 16], ["ss", 22], ["nn", 32], ["s", 44], ["n", 64], ["mmm", 64], ["ssnn", 22], ["rnn", 16]])("material %s chooses the shortest piece limit %i", (codes, limit) => {
    const state = createOukEndgame("two-rooks");
    state.board.forEach(row => row.forEach(cell => { if (cell.piece?.owner === "black" && cell.piece.code !== "k") cell.piece = null; }));
    [...codes].forEach((code, col) => { state.board[0][col].piece = { id: `black-${col}`, code, labelKey: code, owner: "black" }; });
    expect(oukPieceCountLimit(state, "black")).toBe(limit);
  });
  test("piece counting requires a bare king and no unpromoted pawns on either side", () => {
    const state = createOukEndgame("board-honor");
    expect(getOukCountChoices(state, "white").pieces).toBe(false);
    state.board[6][2].piece = null;
    expect(getOukCountChoices(state, "white").pieces).toBe(false);
    state.board[4][7].piece!.code = "m"; state.board[4][7].piece!.promoted = true;
    expect(getOukCountChoices(state, "white").pieces).toBe(true);
  });
  test("the first escaping move announces the start; chasing moves do not count", () => {
    let state = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-pieces");
    expect(readOukCount(state)).toMatchObject({ count: 5, firstMovePending: true });
    state = move(state, 7, 0, 7, 1);
    expect(readOukCount(state)).toMatchObject({ count: 5, firstMovePending: false });
    state = move(state, 3, 3, 3, 4);
    expect(readOukCount(state)?.count).toBe(5);
    state = move(state, 7, 1, 7, 0);
    expect(readOukCount(state)?.count).toBe(6);
  });
  test("two-rook counting draws on the fourth escaping move, at 8", () => {
    let state = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-pieces");
    for (let i = 0; i < 4; i++) {
      state = move(state, 7, i % 2, 7, 1 - i % 2);
      if (i < 3) { expect(state.status).toBe("active"); state = move(state, 3, 3 + i % 2, 3, 4 - i % 2); }
    }
    expect(state).toMatchObject({ status: "completed", result: "draw", outcomeReason: "counting-rule", ply: 7 });
    expect(readOukCount(state)?.count).toBe(8);
    expect(() => move(state, 3, 4, 3, 3)).toThrow();
  });
  test("board counting lasts 64 claimant moves, not 64 plies", () => {
    let state = applyOukCountAction(createOukEndgame("board-honor"), "white", "start-board");
    for (let i = 0; i < 64; i++) {
      state = move(state, 7, i % 2, 7, 1 - i % 2);
      if (i < 63) { expect(state.status).toBe("active"); state = move(state, 1, 5 + i % 2, 1, 6 - i % 2); }
    }
    expect(state).toMatchObject({ status: "completed", result: "draw", ply: 127 });
    expect(readOukCount(state)?.count).toBe(64);
  });
  test("capturing a rook never resets the starting count or fixed piece limit", () => {
    const start = createOukEndgame("two-rooks");
    start.board[6][6].piece = start.board[7][0].piece; start.board[7][0].piece = null;
    start.board[5][5].piece = start.board[0][6].piece; start.board[0][6].piece = null;
    const counted = applyOukCountAction(start, "white", "start-pieces");
    const captured = move(counted, 6, 6, 5, 5);
    expect(readOukCount(captured)).toMatchObject({ count: 5, limit: 8 });
    expect(oukPieceCountLimit(captured, "black")).toBe(16);
    expect(() => applyOukCountAction(captured, "white", "stop")).toThrow();
    expect(() => applyOukCountAction(captured, "white", "start-pieces")).toThrow();
  });
  test("only the board claimant can stop, including during the opponent's turn", () => {
    let state = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-board");
    state = move(state, 7, 0, 7, 1);
    expect(() => applyOukCountAction(state, "black", "stop")).toThrow();
    state = applyOukCountAction(state, "white", "stop");
    expect(readOukCount(state)).toBeNull();
    state = move(state, 3, 3, 3, 4);
    state = applyOukCountAction(state, "white", "start-board");
    expect(readOukCount(state)).toMatchObject({ count: 1, firstMovePending: true });
  });
  test("the bare king has priority to replace the opponent's board count", () => {
    let state = createOukEndgame("two-rooks"); state.turn = "black";
    state = applyOukCountAction(state, "black", "start-board");
    state = move(state, 3, 3, 3, 4);
    state = applyOukCountAction(state, "white", "start-pieces");
    expect(readOukCount(state)).toMatchObject({ side: "white", phase: "pieces", count: 5, limit: 8 });
  });
  test("only the chasing player can accept the active board-count draw", () => {
    const state = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-board");
    expect(() => applyOukCountAction(state, "white", "claim-draw")).toThrow();
    const accepted = applyOukCountAction(state, "black", "claim-draw");
    expect(accepted).toMatchObject({ status: "completed", result: "draw", outcomeReason: "counting-rule" });
    expect(describeGameOutcome(accepted)?.context[0]).toContain("accepted the draw");
  });
  test("a counting player's checkmate is a draw until they stop counting", () => {
    const state = createOukEndgame("countermate");
    expect(mate(state)).toMatchObject({ status: "completed", result: "white", outcomeReason: "checkmate" });
    const counting = applyOukCountAction(state, "white", "start-board");
    expect(mate(counting)).toMatchObject({ status: "completed", result: "draw", outcomeReason: "counting-rule" });
    expect(describeGameOutcome(mate(counting))?.context[0]).toContain("without stopping");
    expect(mate(applyOukCountAction(counting, "white", "stop"))).toMatchObject({ result: "white", outcomeReason: "checkmate" });
  });
  test("the chasing player's checkmate wins before the escaping player's final count", () => {
    const state = createOukEndgame("countermate"); state.turn = "black";
    const counting = applyOukCountAction(state, "black", "start-board");
    counting.turn = "white";
    counting.variantState!.oukCount = { ...readOukCount(counting), count: 63, firstMovePending: false };
    expect(mate(counting)).toMatchObject({ result: "white", outcomeReason: "checkmate" });
  });
  test("a defending bot starts the shorter count without taking over a human claim", () => {
    const state = createOukEndgame("two-rooks");
    expect(readOukCount(withOukBotCount(state))).toMatchObject({ phase: "pieces", side: "white" });
    expect(readOukCount(withOukBotCount(createOukEndgame("board-honor")))?.phase).toBe("board");
    const counted = applyOukCountAction(state, "white", "start-board"); counted.turn = "black";
    expect(withOukBotCount(counted)).toBe(counted);
  });
  test("counting state and actions survive JSON round trips without changing the board", () => {
    const state = createOukEndgame("two-rooks");
    const counted = applyOukCountAction(state, "white", "start-pieces");
    const restored = JSON.parse(JSON.stringify(counted)) as GameState;
    expect(readOukCount(restored)).toEqual(readOukCount(counted));
    expect(restored.board).toEqual(state.board); expect(restored.ply).toBe(0);
    expect(restored.variantState?.oukCountEvents).toEqual([{ ply: 0, actor: "white", action: "start-pieces" }]);
  });
});
