import { createInitialState } from "./engine";
import type { GameState, PlayerColor } from "./types";

export const oukEndgames = [
  { key: "two-rooks", label: "Escape two boats", detail: "Bare king · count 5 to 8" },
  { key: "board-honor", label: "Hold the position", detail: "Board count · stop and restart" },
  { key: "countermate", label: "Win or draw?", detail: "Stop counting before your mate" }
] as const;
export type OukEndgameKey = typeof oukEndgames[number]["key"];

/** Legal, small teaching positions. White moves first in every exercise. */
export function createOukEndgame(key: OukEndgameKey): GameState {
  const state = createInitialState("ouk-chaktrang");
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  state.clocks.forEach(clock => { clock.remainingMs = 0; clock.incrementMs = 0; });
  const put = (row: number, col: number, code: string, owner: PlayerColor) => {
    state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
  };
  if (key === "two-rooks") {
    put(7, 0, "k", "white"); put(3, 3, "k", "black"); put(0, 6, "r", "black"); put(2, 7, "r", "black");
  } else if (key === "board-honor") {
    put(7, 0, "k", "white"); put(6, 2, "m", "white"); put(1, 5, "k", "black"); put(0, 7, "r", "black"); put(4, 7, "p", "black");
  } else {
    put(1, 2, "k", "white"); put(2, 1, "r", "white"); put(0, 0, "k", "black"); put(0, 7, "r", "black");
  }
  // These are endgames: no original-piece opening leap rights remain.
  state.variantState = { oukLeapUsed: { whitek: true, blackk: true, whitem: true, blackm: true }, oukExercise: key };
  return state;
}
