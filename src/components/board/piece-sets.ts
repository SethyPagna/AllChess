import type { PieceSkinPreference } from "./piece-icon";
import type { PieceCollection } from "./board-3d-config";

export type PieceSetId = "standard" | "rosette" | "club" | "courtyard" | "hori" | "celadon" | "shore";
export type Piece2DStyle = "collection" | "clear" | "letters";
export type PieceSetOption = { key: PieceSetId; label: string; skin: PieceSkinPreference; finishLabel?: string };
type PieceSetPreview = { code: string; promoted?: boolean };
type PieceSetFamily = {
  defaultSet: PieceSetId;
  options: readonly PieceSetOption[];
  preview: readonly [PieceSetPreview, PieceSetPreview];
};

const draughtsSets: PieceSetFamily = {
  defaultSet: "rosette",
  options: [
    { key: "standard", label: "Turned", skin: "checker", finishLabel: "Maple & wenge" },
    { key: "rosette", label: "Rosette", skin: "rosette", finishLabel: "Boxwood & walnut" },
    { key: "club", label: "Club", skin: "club", finishLabel: "Ivory & oxblood" }
  ],
  preview: [{ code: "p" }, { code: "x", promoted: true }]
};

const khmerSets: PieceSetFamily = {
  defaultSet: "standard",
  options: [
    { key: "standard", label: "Atelier", skin: "atelier", finishLabel: "Boxwood & rosewood" },
    { key: "courtyard", label: "Courtyard", skin: "courtyard", finishLabel: "Sandstone & charcoal" }
  ],
  preview: [{ code: "k" }, { code: "n" }]
};

const shogiSets: PieceSetFamily = {
  defaultSet: "standard",
  options: [
    { key: "standard", label: "Printed", skin: "wedge", finishLabel: "Boxwood" },
    { key: "hori", label: "Carved", skin: "hori", finishLabel: "Honey boxwood" }
  ],
  preview: [{ code: "k" }, { code: "r", promoted: true }]
};
const miniShogiSets: PieceSetFamily = {
  ...shogiSets,
  options: shogiSets.options.map(set => set.key === "standard" ? { ...set, skin: "mini-wedge" } : set)
};

const xiangqiSets: PieceSetFamily = {
  defaultSet: "standard",
  options: [
    { key: "standard", label: "Boxwood", skin: "disc", finishLabel: "Boxwood" },
    { key: "celadon", label: "Celadon", skin: "celadon", finishLabel: "Celadon glaze" }
  ],
  preview: [{ code: "g" }, { code: "h" }]
};

const konaneSets: PieceSetFamily = {
  defaultSet: "standard",
  options: [
    { key: "standard", label: "Pebbles", skin: "stone", finishLabel: "Natural stone" },
    { key: "shore", label: "Shore", skin: "shore", finishLabel: "Basalt & pale stone" }
  ],
  preview: [{ code: "p" }, { code: "p" }]
};

const readable2DStyles = [
  { key: "collection", label: "Artwork" }, { key: "clear", label: "Clear" }, { key: "letters", label: "Letters" }
] as const;

export function piece2DStyleOptions(variantKey: string) {
  return ["ouk-chaktrang", "shogi", "mini-shogi", "xiangqi"].includes(variantKey) ? readable2DStyles : [];
}

function pieceSetFamily(variantKey: string): PieceSetFamily | undefined {
  if (variantKey === "ouk-chaktrang") return khmerSets;
  if (variantKey === "shogi") return shogiSets;
  if (variantKey === "mini-shogi") return miniShogiSets;
  if (variantKey === "xiangqi") return xiangqiSets;
  if (variantKey === "konane") return konaneSets;
  if (["english-draughts", "international-draughts", "turkish-draughts"].includes(variantKey)) return draughtsSets;
}

export function pieceSetOptions(variantKey: string): readonly PieceSetOption[] {
  return pieceSetFamily(variantKey)?.options ?? [];
}

export function pieceSetPreviewPieces(variantKey: string): readonly PieceSetPreview[] {
  return pieceSetFamily(variantKey)?.preview ?? [];
}

export function resolvePieceSet(variantKey: string, value: string | null | undefined): PieceSetId {
  const family = pieceSetFamily(variantKey);
  return family?.options.find(set => set.key === value)?.key ?? family?.defaultSet ?? "standard";
}

export function readPieceSetPreference(variantKey: string, readPreference: (key: string) => string | null = key => window.localStorage.getItem(key)): PieceSetId {
  try { return resolvePieceSet(variantKey, readPreference(`allchess-piece-set:${variantKey}`)); }
  catch { return resolvePieceSet(variantKey, null); }
}

export function pieceSetModelPath(collection: PieceCollection, set: PieceSetId): string | undefined {
  if (collection === "khmer" && set === "courtyard") return "/assets/khmer/courtyard.glb";
  if (collection === "shogi" && set === "hori") return "/assets/shogi/hori.glb";
  if (collection === "xiangqi" && set === "celadon") return "/assets/xiangqi/celadon.glb";
  if (collection === "konane" && set === "shore") return "/assets/konane/shore.glb";
  return collection === "draughts" && (set === "rosette" || set === "club") ? `/assets/draughts/${set}.glb` : undefined;
}

export function pieceSetSkin(variantKey: string, set: PieceSetId, fallback: PieceSkinPreference): PieceSkinPreference {
  return pieceSetOptions(variantKey).find(option => option.key === set)?.skin ?? fallback;
}

export function resolvePiece2DStyle(variantKey: string, value: string | null | undefined, legacyAppearance?: string | null): Piece2DStyle {
  if (!piece2DStyleOptions(variantKey).length) return "collection";
  if (value === "collection" || value === "clear" || value === "letters") return value;
  if (value == null) {
    if (legacyAppearance === "tablet") return "letters";
    if (legacyAppearance === "contrast") return "clear";
  }
  return "collection";
}

export function readPiece2DStylePreference(
  variantKey: string,
  readPreference: (key: string) => string | null = key => window.localStorage.getItem(key),
  writePreference: (key: string, value: string) => void = (key, value) => window.localStorage.setItem(key, value)
): Piece2DStyle {
  if (!piece2DStyleOptions(variantKey).length) return "collection";
  const key = `allchess-piece-2d-style:${variantKey}`;
  let stored: string | null;
  try { stored = readPreference(key); }
  catch { return "collection"; }
  if (stored !== null) return resolvePiece2DStyle(variantKey, stored);
  let legacy: string | null;
  try { legacy = readPreference(`allchess-appearance-set:${variantKey}`); }
  catch { return "collection"; }
  const style = resolvePiece2DStyle(variantKey, null, legacy);
  // Freeze the migration before a later board colour choice changes the old preset.
  try { writePreference(key, style); } catch { /* Keep the migrated style for this session. */ }
  return style;
}

export function piece2DSkin(variantKey: string, set: PieceSetId, fallback: PieceSkinPreference, style: Piece2DStyle): PieceSkinPreference {
  if (variantKey === "ouk-chaktrang") {
    if (style === "clear") return "khmer";
    if (style === "letters") return "tile";
  }
  if (variantKey === "shogi" || variantKey === "mini-shogi") {
    if (style === "clear") return variantKey === "mini-shogi" ? "mini-wedge" : "wedge";
    if (style === "letters") return "tile";
  }
  if (variantKey === "xiangqi") {
    if (style === "clear") return "disc";
    if (style === "letters") return "tile";
  }
  return pieceSetSkin(variantKey, set, fallback);
}
