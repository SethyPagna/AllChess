import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, type GameState, type Move } from "@/lib/variants";

const sq = (row: number, col: number) => ({ row, col });

function firstCandidate(state: GameState): Move {
  for (const cell of state.board.flat()) {
    if (cell.piece?.owner !== state.turn) continue;
    const [candidate] = getLegalMoves(state, cell.square);
    if (candidate) return candidate;
  }
  throw new Error("no legal move");
}

function expectRejected(state: GameState, request: Move) {
  expect(findLegalMove(state, request)).toBeNull();
  expect(() => applyMove(state, request)).toThrow("errors.invalidMove");
}

describe("move requests match a legal candidate including its kind", () => {
  test.each(["classic", "antichess", "xiangqi", "janggi", "english-draughts", "international-draughts", "shogi", "jungle"])("%s rejects a legal move relabelled as a removal", (variantKey) => {
    const state = createInitialState(variantKey);
    const candidate = firstCandidate(state);
    expectRejected(state, { ...candidate, kind: "remove" });
    expect(applyMove(state, candidate).moves.at(-1)?.kind).toBe(candidate.kind);
  });

  test("a Xiangqi screen cannot be removed to open the generals' file", () => {
    const state = createInitialState("xiangqi");
    const kept = [sq(9, 4), sq(0, 4), sq(6, 4)];
    for (const cell of state.board.flat()) {
      if (!kept.some((square) => square.row === cell.square.row && square.col === cell.square.col)) cell.piece = null;
    }
    expect(state.board[6][4].piece?.owner).toBe(state.turn);
    expectRejected(state, { kind: "remove", from: sq(6, 4), to: sq(5, 4) });
    const next = applyMove(state, { from: sq(6, 4), to: sq(5, 4) });
    expect(next.board[5][4].piece?.id).toBe(state.board[6][4].piece?.id);
  });

  test("the king-takes-own-rook castling form resolves only for a plain move request", () => {
    const state = createInitialState("classic");
    state.board[7][5].piece = null;
    state.board[7][6].piece = null;
    expectRejected(state, { kind: "remove", from: sq(7, 4), to: sq(7, 7) });
    const castled = applyMove(state, { kind: "move", from: sq(7, 4), to: sq(7, 7) });
    expect(castled.board[7][6].piece?.code).toBe("k");
    expect(castled.board[7][5].piece?.code).toBe("r");
    expect(castled.moves.at(-1)).toMatchObject({ from: sq(7, 4), to: sq(7, 6) });
  });

  test("a drop request without a piece is rejected instead of played as a board move", () => {
    expectRejected(createInitialState("classic"), { kind: "drop", from: sq(6, 4), to: sq(4, 4) });
    expectRejected(createInitialState("crazyhouse"), { kind: "drop", from: sq(6, 4), to: sq(4, 4) });
  });

  test("Konane opening removals need kind remove and still advance the opening", () => {
    const state = createInitialState("konane");
    expectRejected(state, { from: sq(0, 0), to: sq(0, 0) });
    expectRejected(state, { kind: "move", from: sq(0, 0), to: sq(0, 0) });

    const afterFirst = applyMove(state, { kind: "remove", from: sq(0, 0), to: sq(0, 0) });
    expect(afterFirst.moves.at(-1)?.kind).toBe("remove");
    expect(afterFirst.captured).toHaveLength(0);
    expect(afterFirst.variantState?.konaneOpening).toMatchObject({ removals: 1 });
    const afterSecond = applyMove(afterFirst, { kind: "remove", from: sq(7, 0), to: sq(7, 0) });
    expect(afterSecond.variantState?.konaneOpening).toMatchObject({ removals: 2 });

    const jump = firstCandidate(afterSecond);
    expectRejected(afterSecond, { ...jump, kind: "remove" });
    expect(applyMove(afterSecond, jump).captured).toHaveLength(1);
  });

  test("records the resolved candidate rather than the raw request", () => {
    const next = applyMove(createInitialState("classic"), { kind: "move", from: sq(6, 4), to: sq(4, 4), promotion: true });
    expect(next.moves.at(-1)).toEqual({ from: sq(6, 4), to: sq(4, 4), notation: expect.any(String) });
  });
});
