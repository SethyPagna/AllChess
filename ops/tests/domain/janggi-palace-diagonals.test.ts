import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState, type Square } from "@/lib/variants";

const pass = { kind: "pass" as const, from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };

function emptyJanggi(turn: "red" | "blue"): GameState {
  const state = createInitialState("janggi", "janggi-palace-diagonals");
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  state.turn = turn;
  return state;
}

function put(state: GameState, row: number, col: number, code: string, owner: "red" | "blue") {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
}

const targets = (state: GameState, from: Square) => getLegalMoves(state, from).map((move) => `${move.to.row},${move.to.col}`);

describe("janggi palace diagonals", () => {
  test.each([
    [1, 3],
    [1, 5],
    [8, 3],
    [8, 5]
  ])("a chariot on the side midpoint (%i,%i) has no diagonal move", (row, col) => {
    const state = emptyJanggi("red");
    put(state, 9, 3, "g", "red");
    put(state, 1, 4, "g", "blue");
    put(state, row, col, "r", "red");

    const diagonal = targets(state, { row, col }).filter((to) => {
      const [r, c] = to.split(",").map(Number);
      return r !== row && c !== col;
    });
    expect(diagonal).toEqual([]);
  });

  test("a corner chariot still sweeps through the centre to the far corner, and the centre blocks it", () => {
    const state = emptyJanggi("red");
    put(state, 9, 5, "g", "red");
    put(state, 2, 4, "g", "blue");
    put(state, 9, 3, "r", "red");
    expect(targets(state, { row: 9, col: 3 })).toEqual(expect.arrayContaining(["8,4", "7,5"]));

    put(state, 0, 3, "r", "red");
    expect(targets(state, { row: 0, col: 3 })).toEqual(expect.arrayContaining(["1,4", "2,5"]));

    put(state, 8, 4, "p", "red");
    expect(targets(state, { row: 9, col: 3 })).not.toContain("8,4");
    expect(targets(state, { row: 9, col: 3 })).not.toContain("7,5");
  });

  test("a chariot on a side midpoint does not check the general on the palace edge", () => {
    const state = emptyJanggi("red");
    put(state, 9, 3, "g", "red");
    put(state, 1, 0, "r", "red");
    put(state, 0, 4, "g", "blue");
    put(state, 0, 3, "e", "blue");
    put(state, 0, 5, "h", "blue");
    put(state, 5, 8, "p", "blue");

    const after = applyMove(state, { from: { row: 1, col: 0 }, to: { row: 1, col: 3 } });
    expect(after).toMatchObject({ status: "active", turn: "blue" });
    expect(after.checks.blue ?? 0).toBe(0);
    expect(() => applyMove(after, pass)).not.toThrow();
    expect(getLegalMoves(after, { row: 5, col: 8 })).toContainEqual({ from: { row: 5, col: 8 }, to: { row: 6, col: 8 } });
  });

  test("a general may pass next to an enemy chariot on a side midpoint", () => {
    const state = emptyJanggi("red");
    put(state, 7, 4, "g", "red");
    put(state, 8, 5, "r", "blue");
    put(state, 1, 3, "g", "blue");

    expect(() => applyMove(state, pass)).not.toThrow();
  });
});
