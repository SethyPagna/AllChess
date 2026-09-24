import type { BoardThemePreference } from "./appearance";

export type PieceCollection = "khmer" | "classic";
export type PieceFinish = "original" | "porcelain" | "slate";

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
  classic: [0xddd0ad, 0x60764e], wood: [0xbd925e, 0x765039], jade: [0xdbe2c6, 0x6f947d],
  contrast: [0xf2efe5, 0x303638], slate: [0xcad5df, 0x556b7d], plum: [0xe4d6df, 0x8f6a86], ocean: [0xd3e7e3, 0x508396]
};

export const tabletopCameraTarget = [0, -.02, 0] as const;
export const tabletopAspect = 1.25;
export const tabletopFieldOfView = 2 * Math.atan(Math.tan(42 * Math.PI / 360) / tabletopAspect) * 180 / Math.PI;
export const tabletopCameraPosition = [.30, .56, .76] as const;

export function isPieceFinish(value: string | null): value is PieceFinish { return value === "original" || value === "porcelain" || value === "slate"; }
