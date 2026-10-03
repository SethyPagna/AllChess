import { expect, test } from "vitest";
import { createBotSearchStateKey } from "@/lib/bot/runtime";
import { applyMove, createInitialState } from "@/lib/variants";

test("bot caches distinguish the last pawn advance that grants en passant", () => {
  const state = applyMove(createInitialState("classic"), { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });
  const withoutRight = structuredClone(state);
  withoutRight.moves[0] = { from: { row: 5, col: 4 }, to: { row: 4, col: 4 }, notation: "e3-e4" };
  expect(createBotSearchStateKey(state)).not.toBe(createBotSearchStateKey(withoutRight));
});

test("bot caches distinguish earlier home-square moves after the pieces return", () => {
  const state = createInitialState("classic");
  state.moves = [
    { from: { row: 7, col: 7 }, to: { row: 6, col: 7 }, notation: "Rh1-h2" },
    { from: { row: 1, col: 0 }, to: { row: 2, col: 0 }, notation: "a7-a6" }
  ];
  const withRights = structuredClone(state);
  withRights.moves[0] = { from: { row: 6, col: 7 }, to: { row: 5, col: 7 }, notation: "h2-h3" };
  expect(createBotSearchStateKey(state)).not.toBe(createBotSearchStateKey(withRights));
});
