import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState } from "@/lib/variants";

const ep = { from: { row: 3, col: 4 }, to: { row: 2, col: 3 } };
function ready(variant = "classic") {
  const state = createInitialState(variant);
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  const put = (r: number, c: number, code: string, owner: "white" | "black") => { state.board[r][c].piece = { id: `${owner}-${code}-${r}-${c}`, code, owner, labelKey: code }; };
  put(7, 4, "k", "white"); put(0, 4, "k", "black"); put(3, 4, "p", "white"); put(1, 3, "p", "black");
  state.turn = "black";
  return applyMove(state, { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } });
}

describe("en passant", () => {
  test.each(["classic", "chess960", "crazyhouse", "king-of-the-hill", "three-check"])("%s removes the adjacent pawn, records the capture, and resets the quiet-move clock", variant => {
    const state = ready(variant);
    expect(getLegalMoves(state, ep.from)).toContainEqual(ep);
    const result = applyMove(state, ep);
    expect(result.board[3][3].piece).toBeNull(); expect(result.board[3][4].piece).toBeNull();
    expect(result.board[2][3].piece).toMatchObject({ owner: "white", code: "p" });
    expect(result.captured).toHaveLength(1); expect(result.halfmoveClock).toBe(0);
    if (variant === "crazyhouse") expect(result.hands?.white?.p).toBe(1);
  });
  test("the option expires after a different move", () => {
    let state = ready();
    state = applyMove(state, { from: { row: 7, col: 4 }, to: { row: 7, col: 5 } });
    state = applyMove(state, { from: { row: 0, col: 4 }, to: { row: 0, col: 5 } });
    expect(getLegalMoves(state, ep.from)).not.toContainEqual(ep);
  });
  test("black can capture a white double step", () => {
    let state = createInitialState("classic");
    state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
    state.board[7][4].piece = { id: "wk", code: "k", owner: "white", labelKey: "k" };
    state.board[0][4].piece = { id: "bk", code: "k", owner: "black", labelKey: "k" };
    state.board[6][3].piece = { id: "wp", code: "p", owner: "white", labelKey: "p" };
    state.board[4][4].piece = { id: "bp", code: "p", owner: "black", labelKey: "p" };
    state = applyMove(state, { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } });
    const capture = { from: { row: 4, col: 4 }, to: { row: 5, col: 3 } };
    expect(getLegalMoves(state, capture.from)).toContainEqual(capture);
    expect(applyMove(state, capture).board[4][3].piece).toBeNull();
  });
  test("rejects a capture that exposes a horizontal rook attack on the king", () => {
    const state = ready();
    state.board[7][4].piece = null;
    state.board[3][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "k" };
    state.board[3][0].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "r" };
    expect(getLegalMoves(state, ep.from)).not.toContainEqual(ep);
    expect(() => applyMove(state, ep)).toThrow("errors.invalidMove");
  });
  test("antichess treats en passant as a compulsory capture", () => {
    const state = ready("antichess");
    expect(getLegalMoves(state, { row: 7, col: 4 })).toEqual([]);
    expect(getLegalMoves(state, ep.from)).toEqual([ep]);
  });
  test("does not create an en passant right for a drop or a Horde first-rank advance", () => {
    const dropped = ready("crazyhouse"); dropped.moves.at(-1)!.kind = "drop";
    expect(getLegalMoves(dropped, ep.from)).not.toContainEqual(ep);
    const horde = ready("horde");
    expect(getLegalMoves(horde, ep.from)).toContainEqual(ep);
    const firstRank: GameState = structuredClone(horde);
    firstRank.turn = "black"; firstRank.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
    firstRank.board[5][4].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "p" };
    firstRank.board[5][3].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "p" };
    firstRank.moves = [{ from: { row: 7, col: 3 }, to: { row: 5, col: 3 }, notation: "d1-d3" }];
    expect(getLegalMoves(firstRank, { row: 5, col: 4 })).not.toContainEqual({ from: { row: 5, col: 4 }, to: { row: 6, col: 3 } });
  });
});
