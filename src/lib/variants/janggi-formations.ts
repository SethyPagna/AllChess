import type { GameState } from "./types";

export const janggiFormationKeys = ["inner", "outer", "left", "right"] as const;
export type JanggiFormation = typeof janggiFormationKeys[number];
export type JanggiSide = "red" | "blue";
export type JanggiSetup = Partial<Record<JanggiSide, JanggiFormation>>;
export function pendingJanggiSide(setup: JanggiSetup | undefined): JanggiSide | null {
  return setup ? !setup.red ? "red" : !setup.blue ? "blue" : null : null;
}
export const janggiFormations: Record<JanggiFormation, { label: string; pieces: readonly string[] }> = {
  inner: { label: "Inner elephants", pieces: ["h", "e", "e", "h"] },
  outer: { label: "Outer elephants", pieces: ["e", "h", "h", "e"] },
  left: { label: "Left elephant", pieces: ["h", "e", "h", "e"] },
  right: { label: "Right elephant", pieces: ["e", "h", "e", "h"] }
};

export function readJanggiFormations(state: GameState): Record<JanggiSide, JanggiFormation> {
  const saved = state.variantState?.janggiFormations as Record<string, unknown> | undefined;
  const read = (side: JanggiSide): JanggiFormation => janggiFormationKeys.includes(saved?.[side] as JanggiFormation) ? saved![side] as JanggiFormation : "inner";
  return { red: read("red"), blue: read("blue") };
}

/** Arrange only the four eligible back-rank pieces, viewed from that player's seat. */
export function withJanggiFormation(state: GameState, side: JanggiSide, formation: JanggiFormation): GameState {
  if (state.variantKey !== "janggi" || state.ply !== 0 || state.moves.length || state.status === "completed" || !janggiFormationKeys.includes(formation)) throw new Error("Formation changes are only available before play.");
  const next = structuredClone(state), row = side === "red" ? 9 : 0;
  const columns = side === "red" ? [1, 2, 6, 7] : [7, 6, 2, 1];
  const pieces = columns.map(col => next.board[row][col].piece);
  if (pieces.some(piece => !piece || piece.owner !== side) || pieces.filter(piece => piece?.code === "h").length !== 2 || pieces.filter(piece => piece?.code === "e").length !== 2) throw new Error("The opening pieces are no longer in place.");
  for (const [i, code] of janggiFormations[formation].pieces.entries()) {
    const index = pieces.findIndex(piece => piece?.code === code);
    next.board[row][columns[i]].piece = pieces.splice(index, 1)[0];
  }
  next.variantState = { ...next.variantState, janggiFormations: { ...readJanggiFormations(state), [side]: formation } };
  return next;
}

export function copyJanggiFormations(initial: GameState, played: GameState) {
  if (initial.variantKey !== "janggi") return initial;
  const formations = readJanggiFormations(played);
  return withJanggiFormation(withJanggiFormation(initial, "red", formations.red), "blue", formations.blue);
}

/** Replay must start from the recorded setup, not the catalog's default formation. */
export function restoreJanggiOpening(initial: GameState, played: GameState) {
  if (initial.variantKey !== "janggi") return initial;
  const next = copyJanggiFormations(initial, played);
  // Preserve the scoring rules of an unversioned saved room as well.
  if (!played.variantState?.janggiProfile) delete next.variantState!.janggiProfile;
  return next;
}
