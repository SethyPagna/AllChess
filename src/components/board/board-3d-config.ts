import type { BoardThemePreference } from "./appearance";

export type PieceCollection = "khmer" | "classic";
export type PieceFinish = "original" | "porcelain" | "slate";
export type CameraView = "angled" | "top";

const classicVariants = new Set(["classic", "chess960", "crazyhouse", "antichess", "horde", "king-of-the-hill", "three-check", "racing-kings"]);
export function get3DCollection(variantKey: string): PieceCollection | null {
  if (variantKey === "ouk-chaktrang") return "khmer";
  return classicVariants.has(variantKey) ? "classic" : null;
}

export const collectionPieces: Record<PieceCollection, Record<string, string>> = {
  khmer: { k: "Khon_king", m: "Neang_queen", s: "Koul_bishop", n: "Ses_horse", r: "Touk_boat", p: "Trey_fish" },
  classic: { k: "king", q: "queen", b: "bishop", n: "knight", r: "rook", p: "pawn" }
};

export const board3DPalettes: Record<BoardThemePreference, readonly [number, number]> = {
  classic: [0xeee8d3, 0x769263], wood: [0xe5c993, 0x896044], jade: [0xdbe2c6, 0x6f947d],
  contrast: [0xf2efe5, 0x303638], slate: [0xcad5df, 0x556b7d], plum: [0xe4d6df, 0x8f6a86], ocean: [0xd3e7e3, 0x508396]
};

export const cameraPositions: Record<CameraView, readonly [number, number, number]> = {
  angled: [0, .66, .42], top: [0, .66, .001]
};

export function isPieceFinish(value: string | null): value is PieceFinish { return value === "original" || value === "porcelain" || value === "slate"; }
export function isCameraView(value: string | null): value is CameraView { return value === "angled" || value === "top"; }
