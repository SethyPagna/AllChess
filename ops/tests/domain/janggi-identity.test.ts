import { expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

const pass = { kind: "pass" as const, from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };

test("Janggi starts Blue Cho, with both generals in their palace centres", () => {
  const state = createInitialState("janggi");
  expect(state.turn).toBe("blue");
  expect(state.board[1][4].piece).toMatchObject({ code: "g", owner: "blue" });
  expect(state.board[8][4].piece).toMatchObject({ code: "g", owner: "red" });
  expect(state.board[0][4].piece).toBeNull(); expect(state.board[9][4].piece).toBeNull();
  expect(state.board.flat().filter(cell => cell.piece)).toHaveLength(32);
  expect(getLegalMoves(state, { row: 3, col: 4 })).toContainEqual({ from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
  expect(getLegalMoves(state, { row: 6, col: 4 })).toEqual([]);
});

test("new Janggi games award Han 1.5 compensation points when both sides pass", () => {
  const result = applyMove(applyMove(createInitialState("janggi"), pass), pass);
  expect(result).toMatchObject({ status: "completed", result: "red", outcomeReason: "scoring" });
  expect(result.variantState?.janggiScoring).toMatchObject({ redPoints: 73.5, bluePoints: 72 });
});

test("unversioned saved games retain their original scoring policy", () => {
  const state = createInitialState("janggi");
  delete state.variantState; state.turn = "red";
  const result = applyMove(applyMove(state, pass), pass);
  expect(result).toMatchObject({ status: "completed", result: "draw", outcomeReason: "scoring" });
  expect(result.variantState?.janggiScoring).toMatchObject({ redPoints: 72, bluePoints: 72 });
});
