import { getVariant } from "./catalog";
import { buildBoard } from "./engine";
import type { GameState } from "./types";

export const HORDE_PROFILE = "lichess-v1";
/** The 32-pawn setup (ranks 2-5) used before the Lichess 36-pawn horde. */
export const LEGACY_HORDE_SETUP = ["rnbqkbnr", "pppppppp", "........", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP", "........"];

export const usesLichessHordeSetup = (state: GameState) => state.variantKey === "horde" && state.variantState?.hordeProfile === HORDE_PROFILE;

/** Rebuild the legacy opening for unversioned room timelines so their moves still replay. */
export function restoreHordeOpening(initial: GameState, played: GameState) {
  if (initial.variantKey !== "horde" || usesLichessHordeSetup(played)) return initial;
  const next: GameState = { ...initial, board: buildBoard({ ...getVariant("horde"), setup: LEGACY_HORDE_SETUP }) };
  const variantState = { ...initial.variantState };
  delete variantState.hordeProfile;
  if (Object.keys(variantState).length) next.variantState = variantState;
  else delete next.variantState;
  return next;
}
