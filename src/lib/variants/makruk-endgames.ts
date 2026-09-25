import { createInitialState } from "./engine";
import { initializeMakrukPieceCount } from "./makruk-counting";
import type { GameState, PlayerColor } from "./types";

export const makrukEndgames = [
  { key: "two-rooks", label: "Escape two Ruea", detail: "Piece honor · count 5–8, draw at 9" },
  { key: "board-honor", label: "Claim the board's honor", detail: "Start, stop and restart your count" },
  { key: "countermate", label: "Win or draw?", detail: "Stop your count before giving mate" }
] as const;
export type MakrukEndgameKey = typeof makrukEndgames[number]["key"];

export function createMakrukEndgame(key: MakrukEndgameKey): GameState {
  const state = createInitialState("makruk");
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  state.clocks.forEach(clock => { clock.remainingMs = 0; clock.incrementMs = 0; });
  const put = (row: number, col: number, code: string, owner: PlayerColor) => { state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code }; };
  if (key === "two-rooks") {
    put(7, 0, "k", "white"); put(3, 3, "k", "black"); put(0, 6, "r", "black"); put(2, 7, "r", "black");
  } else if (key === "board-honor") {
    put(7, 0, "k", "white"); put(6, 2, "m", "white"); put(1, 5, "k", "black"); put(0, 7, "r", "black");
  } else {
    put(1, 2, "k", "white"); put(2, 1, "r", "white"); put(0, 0, "k", "black"); put(0, 7, "r", "black");
  }
  state.variantState!.makrukExercise = key;
  initializeMakrukPieceCount(state);
  return state;
}
