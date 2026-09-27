import type { PieceSkinPreference } from "./piece-icon";
import type { PieceCollection } from "./board-3d-config";

export type PieceSetId = "standard" | "rosette" | "club";
export type PieceSetOption = { key: PieceSetId; label: string; skin: PieceSkinPreference; finishLabel?: string };

const draughtsSets: PieceSetOption[] = [
  { key: "standard", label: "Turned", skin: "checker", finishLabel: "Maple & wenge" },
  { key: "rosette", label: "Rosette", skin: "rosette", finishLabel: "Boxwood & walnut" },
  { key: "club", label: "Club", skin: "club", finishLabel: "Ivory & oxblood" }
];

export function pieceSetOptions(variantKey: string): readonly PieceSetOption[] {
  return ["english-draughts", "international-draughts", "turkish-draughts"].includes(variantKey) ? draughtsSets : [];
}

export function resolvePieceSet(variantKey: string, value: string | null | undefined): PieceSetId {
  const options = pieceSetOptions(variantKey);
  return options.find(set => set.key === value)?.key ?? (options.length ? "rosette" : "standard");
}

export function readPieceSetPreference(variantKey: string, readPreference: (key: string) => string | null = key => window.localStorage.getItem(key)): PieceSetId {
  try { return resolvePieceSet(variantKey, readPreference(`allchess-piece-set:${variantKey}`)); }
  catch { return resolvePieceSet(variantKey, null); }
}

export function pieceSetModelPath(collection: PieceCollection, set: PieceSetId): string | undefined {
  return collection === "draughts" && (set === "rosette" || set === "club") ? `/assets/draughts/${set}.glb` : undefined;
}

export function pieceSetSkin(variantKey: string, set: PieceSetId, fallback: PieceSkinPreference): PieceSkinPreference {
  return pieceSetOptions(variantKey).find(option => option.key === set)?.skin ?? fallback;
}
