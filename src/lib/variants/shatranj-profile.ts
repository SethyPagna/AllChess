import { getVariant } from "./catalog";
import { buildBoard } from "./engine";
import type { GameState } from "./types";

export const SHATRANJ_PROFILE = "same-file-v1";
export const LEGACY_SHATRANJ_SETUP = ["rnakfanr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNAFKANR"];

export const usesSameFileShatranjSetup = (state: GameState) => state.variantKey === "shatranj" && state.variantState?.shatranjProfile === SHATRANJ_PROFILE;

export function restoreShatranjOpening(initial: GameState, played: GameState): GameState {
  if (initial.variantKey !== "shatranj" || usesSameFileShatranjSetup(played)) return initial;
  const next: GameState = { ...initial, board: buildBoard({ ...getVariant("shatranj"), setup: LEGACY_SHATRANJ_SETUP }) };
  const variantState = { ...initial.variantState };
  delete variantState.shatranjProfile;
  if (Object.keys(variantState).length) next.variantState = variantState;
  else delete next.variantState;
  return next;
}
