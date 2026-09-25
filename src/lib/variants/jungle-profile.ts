import type { BoardCell, GameState, PlayerColor, Square } from "./types";

export const usesJungleStandardRules = (state: GameState) => state.variantKey === "jungle" && state.variantState?.jungleProfile === "standard-v1";

export function jungleTrapOwner({ row, col }: Square): PlayerColor | null {
  if ((row === 0 && (col === 2 || col === 4)) || (row === 1 && col === 3)) return "black";
  if ((row === 8 && (col === 2 || col === 4)) || (row === 7 && col === 3)) return "white";
  return null;
}

export function jungleTerrain(square: Square, legacy = false): BoardCell["terrain"] {
  const { row, col } = square;
  if (row >= 3 && row <= 5 && [1, 2, 4, 5].includes(col)) return "river";
  if ((row === 0 || row === 8) && col === 3) return "den";
  if (legacy ? (row <= 1 || row >= 7) && [2, 3, 4].includes(col) : jungleTrapOwner(square)) return "trap";
  return "land";
}

export function jungleRank(code: string, standard = true) {
  return ({ r: 1, c: 2, w: standard ? 3 : 4, d: standard ? 4 : 3, p: 5, t: 6, l: 7, e: 8 } as Record<string, number>)[code] ?? 0;
}

/** Rebuild old room timelines with their original terrain and capture semantics. */
export function restoreJungleOpening(initial: GameState, played: GameState) {
  if (initial.variantKey !== "jungle" || usesJungleStandardRules(played)) return initial;
  const next = { ...initial, variantState: { ...initial.variantState }, board: initial.board.map(row => row.map(cell => ({ ...cell, terrain: jungleTerrain(cell.square, true) }))) };
  delete next.variantState.jungleProfile;
  return next;
}
