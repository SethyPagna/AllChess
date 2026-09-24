import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState, type Piece } from "@/lib/variants";

const destinations = (state: GameState, row: number, col: number) => getLegalMoves(state, { row, col }).map(move => `${move.to.row},${move.to.col}`);
function empty() { const state = createInitialState("ouk-chaktrang"); state.board.forEach(row => row.forEach(cell => { cell.piece = null; })); return state; }
function put(state: GameState, row: number, col: number, code: string, owner: Piece["owner"]) { state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code }; }

describe("Cambodian Ouk Chaktrang", () => {
  test("has its own asymmetric royal setup and uncheckered promotion ranks", () => {
    const state = createInitialState("ouk-chaktrang");
    expect(state.board[7][3].piece?.code).toBe("k"); expect(state.board[0][4].piece?.code).toBe("k");
    expect(state.board.flat().filter(cell => cell.piece)).toHaveLength(32);
    expect(state.board[2][0].terrain).toBe("promotion-zone");
    expect(destinations(state, 7, 3)).toEqual(expect.arrayContaining(["6,1", "6,5"]));
  });
  test("a king can leap only without capture or check", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black");
    put(state, 6, 1, "p", "black"); expect(destinations(state, 7, 3)).not.toContain("6,1");
    put(state, 5, 2, "n", "black"); expect(destinations(state, 7, 3)).not.toContain("6,5");
  });
  test("king leaps cannot expose the king to an attack", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black"); put(state, 4, 4, "n", "black");
    expect(destinations(state, 7, 3)).not.toContain("6,5");
  });
  test("rook alignment permanently revokes the leap even through a blocker", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black"); put(state, 2, 2, "r", "black"); put(state, 5, 3, "p", "white");
    state.turn = "black";
    const aligned = applyMove(state, { from: { row: 2, col: 2 }, to: { row: 2, col: 3 } });
    expect(aligned.variantState?.oukLeapUsed).toMatchObject({ whitek: true });
    aligned.board[2][2].piece = aligned.board[2][3].piece; aligned.board[2][3].piece = null;
    expect(destinations(aligned, 7, 3)).not.toContain("6,5");
  });
  test("Neang leaps over a blocker but never captures", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black"); put(state, 7, 4, "m", "white"); put(state, 6, 4, "p", "white");
    expect(destinations(state, 7, 4)).toContain("5,4");
    put(state, 5, 4, "p", "black"); expect(destinations(state, 7, 4)).not.toContain("5,4");
  });
  test("used and promoted queens cannot regain an opening leap", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black"); put(state, 7, 4, "m", "white");
    const next = applyMove(state, { from: { row: 7, col: 4 }, to: { row: 5, col: 4 } });
    expect(next.variantState?.oukLeapUsed).toMatchObject({ whitem: true });
    state.board[7][4].piece!.promoted = true; expect(destinations(state, 7, 4)).not.toContain("5,4");
  });
  test("moving a promoted Trey preserves the original Neang's opening leap", () => {
    const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black"); put(state, 7, 4, "m", "white"); put(state, 4, 0, "m", "white");
    state.board[4][0].piece!.promoted = true;
    const next = applyMove(state, { from: { row: 4, col: 0 }, to: { row: 3, col: 1 } });
    next.turn = "white";
    expect(destinations(next, 7, 4)).toContain("5,4");
  });
  test("Trey promotes to Neang on its sixth rank for both sides", () => {
    for (const owner of ["white", "black"] as const) {
      const state = empty(); put(state, 7, 3, "k", "white"); put(state, 0, 4, "k", "black");
      const from = { row: owner === "white" ? 3 : 4, col: 0 }; const to = { row: owner === "white" ? 2 : 5, col: 0 };
      put(state, from.row, 0, "p", owner); state.turn = owner;
      expect(applyMove(state, { from, to }).board[to.row][0].piece).toMatchObject({ code: "m", promoted: true });
    }
  });
  test("pawns never double-step", () => { expect(destinations(createInitialState("ouk-chaktrang"), 5, 0)).toEqual(["4,0"]); });
});
