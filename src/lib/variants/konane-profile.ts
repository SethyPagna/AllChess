import type { GameState } from "./types";

/** The NPS Hōnaunau profile: Black first, unrestricted own-stone removals,
 * and optional consecutive jumps in one direction, chosen as one move. */
export const usesKonaneNpsRules = (state: GameState) => state.variantKey === "konane" && state.variantState?.konaneProfile === "nps-v1";

export function restoreKonaneOpening(initial: GameState, played: GameState) {
  if (initial.variantKey !== "konane" || usesKonaneNpsRules(played)) return initial;
  const next = { ...initial, turn: "white" as const, variantState: { ...initial.variantState } };
  delete next.variantState.konaneProfile;
  return next;
}
