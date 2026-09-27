import type { PieceSkinPreference } from "./piece-icon";
import type { PieceCollection } from "./board-3d-config";

export type PieceSetId = "standard" | "rosette";
export type PieceSetOption = { key: PieceSetId; label: string; skin: PieceSkinPreference; finishLabel?: string };

const draughtsSets: PieceSetOption[] = [
  { key: "standard", label: "Turned", skin: "checker", finishLabel: "Maple & wenge" },
  { key: "rosette", label: "Rosette", skin: "rosette", finishLabel: "Boxwood & walnut" }
];

export function pieceSetOptions(variantKey: string): readonly PieceSetOption[] {
  return ["english-draughts", "international-draughts", "turkish-draughts"].includes(variantKey) ? draughtsSets : [];
}

export function resolvePieceSet(variantKey: string, value: string | null | undefined): PieceSetId {
  return pieceSetOptions(variantKey).find(set => set.key === value)?.key ?? "standard";
}

export function pieceSetModelPath(collection: PieceCollection, set: PieceSetId): string | undefined {
  return collection === "draughts" && set === "rosette" ? "/assets/draughts/rosette.glb" : undefined;
}

export function pieceSetSkin(variantKey: string, set: PieceSetId, fallback: PieceSkinPreference): PieceSkinPreference {
  return pieceSetOptions(variantKey).find(option => option.key === set)?.skin ?? fallback;
}
