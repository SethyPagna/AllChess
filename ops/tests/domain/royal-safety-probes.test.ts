import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, variantCatalog, type GameState, type Piece } from "@/lib/variants";

function freezeState<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeState(child);
  }
  return value;
}

function emptyState(variantKey: string) {
  const state = createInitialState(variantKey, "immutable-probe");
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  return state;
}

function put(state: GameState, row: number, col: number, code: string, owner: Piece["owner"]) {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
}

describe("royal safety probes", () => {
  test.each(variantCatalog)("$key legal moves leave frozen positions intact", (variant) => {
    let state = createInitialState(variant.key, "immutable-probe");
    for (let ply = 0; ply < 3; ply += 1) {
      const snapshot = structuredClone(state);
      freezeState(state);
      const legal = state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));
      expect(legal.length).toBeGreaterThan(0);
      expect(state).toEqual(snapshot);
      const next = applyMove(state, legal[Math.floor(legal.length / 2)]);
      expect(state).toEqual(snapshot);
      expect(next.board).not.toBe(state.board);
      expect(next.moves).not.toBe(state.moves);
      expect(next.clocks).not.toBe(state.clocks);
      state = next;
    }
  });

  test.each([false, true])("en passant checks copy the captured pawn cell (exposed rook: %s)", (exposedRook) => {
    let state = emptyState("classic");
    put(state, 7, 4, "k", "white");
    put(state, 0, 4, "k", "black");
    put(state, 3, 4, "p", "white");
    put(state, 1, 3, "p", "black");
    state.turn = "black";
    state = applyMove(state, { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } });
    if (exposedRook) {
      state.board[7][4].piece = null;
      put(state, 3, 7, "k", "white");
      put(state, 3, 0, "r", "black");
    }
    const snapshot = structuredClone(state);
    const capture = { from: { row: 3, col: 4 }, to: { row: 2, col: 3 } };
    const moves = getLegalMoves(freezeState(state), capture.from);
    if (exposedRook) expect(moves).not.toContainEqual(capture);
    else expect(moves).toContainEqual(capture);
    expect(state).toEqual(snapshot);
  });

  test("checking a defensive drop preserves the board, hand and supplied piece", () => {
    const state = emptyState("crazyhouse");
    put(state, 7, 4, "k", "white");
    put(state, 0, 0, "k", "black");
    put(state, 0, 4, "r", "black");
    state.hands = { white: { n: 1 }, black: {} };
    const drop: Piece = freezeState({ id: "held-knight", code: "n", owner: "white", labelKey: "n" });
    const snapshot = structuredClone(state);
    const moves = getLegalMoves(freezeState(state), { drop });
    expect(moves).toContainEqual(expect.objectContaining({ kind: "drop", to: { row: 6, col: 4 } }));
    expect(moves).not.toContainEqual(expect.objectContaining({ to: { row: 6, col: 3 } }));
    expect(state).toEqual(snapshot);
    expect(drop.promoted).toBeUndefined();
  });

  test("racing kings checks both kings without changing the original position", () => {
    const state = emptyState("racing-kings");
    put(state, 7, 7, "k", "white");
    put(state, 1, 0, "r", "white");
    put(state, 0, 7, "k", "black");
    const snapshot = structuredClone(state);
    const moves = getLegalMoves(freezeState(state), { row: 1, col: 0 });
    expect(moves).not.toContainEqual({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 } });
    expect(moves).toContainEqual({ from: { row: 1, col: 0 }, to: { row: 2, col: 0 } });
    expect(state).toEqual(snapshot);
  });
});
