import { expect, test } from "vitest";

import { applyMove, createInitialState, getVariant, type GameState, type Move } from "@/lib/variants";
import { buildBoard } from "@/lib/variants/engine";
import { restoreShatranjOpening, usesSameFileShatranjSetup } from "@/lib/variants/shatranj-profile";
import { exportLocalMatch, importLocalMatch } from "@/lib/game/local-match-transfer";
import { botDifficultyLevels } from "@/lib/bot/config";

const openingMoves: Move[] = [
  { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } },
  { from: { row: 1, col: 3 }, to: { row: 2, col: 3 } },
  { from: { row: 5, col: 0 }, to: { row: 4, col: 0 } },
  { from: { row: 0, col: 3 }, to: { row: 1, col: 3 } }
];

function legacyOpening(): GameState {
  const state = createInitialState("shatranj", "legacy-shatranj-room");
  state.board = buildBoard({ ...getVariant("shatranj"), setup: ["rnakfanr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNAFKANR"] });
  delete state.variantState;
  return state;
}

const replay = (state: GameState, moves: Move[]) => moves.reduce(applyMove, state);

test("new Shatranj games record the e-file king opening through play", () => {
  const initial = createInitialState("shatranj", "shatranj-profile");
  expect(initial.variantState?.shatranjProfile).toBe("same-file-v1");
  const played = applyMove(initial, { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } });
  expect(played.variantState?.shatranjProfile).toBe("same-file-v1");
  expect(usesSameFileShatranjSetup(played)).toBe(true);
  expect(restoreShatranjOpening(initial, played)).toBe(initial);
});

test("unversioned room replay restores Black's d8 king and completes its recorded move", () => {
  const played = replay(legacyOpening(), openingMoves);
  const initial = createInitialState("shatranj", played.id);
  const restored = restoreShatranjOpening(initial, played);

  expect(() => replay(initial, played.moves)).toThrow("errors.invalidMove");
  expect(restored.board[0][3].piece).toMatchObject({ code: "k", owner: "black" });
  expect(restored.board[0][4].piece).toMatchObject({ code: "f", owner: "black" });
  expect(restored.variantState).toBeUndefined();
  expect(replay(restored, played.moves)).toEqual(played);
  expect(initial.board[0][4].piece).toMatchObject({ code: "k", owner: "black" });
  expect(initial.variantState?.shatranjProfile).toBe("same-file-v1");
});

test.each([false, true])("Shatranj transfer preserves opening choice and replay (legacy %s)", (legacy) => {
  const initial = legacy ? legacyOpening() : createInitialState("shatranj", "shatranj-save");
  const moves = legacy ? openingMoves : openingMoves.slice(0, 3);
  const history: GameState[] = [];
  let state = initial;
  for (const move of moves) {
    history.push(state);
    state = applyMove(state, move);
  }
  const imported = importLocalMatch(exportLocalMatch({
    state, history, future: [],
    settings: { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "freestyle", humanColor: "white", seatChoice: "first", boardOrientation: "auto" }
  }).contents);
  const restored = restoreShatranjOpening(createInitialState("shatranj", imported.state.id), imported.state);

  expect(usesSameFileShatranjSetup(imported.state)).toBe(!legacy);
  expect(imported.history[0].board).toEqual(initial.board);
  expect(replay(restored, imported.state.moves)).toEqual(imported.state);
});

test("restoring Shatranj does not change other variants", () => {
  const initial = createInitialState("classic", "classic-room");
  expect(restoreShatranjOpening(initial, initial)).toBe(initial);
});
