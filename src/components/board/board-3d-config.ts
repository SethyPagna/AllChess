import type { BoardThemePreference } from "./appearance";

export type PieceCollection = "khmer" | "classic" | "shogi" | "xiangqi" | "janggi" | "makruk" | "draughts" | "konane" | "chaturanga" | "shatranj" | "jungle";
export type PieceFinish = "original" | "porcelain" | "slate";

const classicVariants = new Set(["classic", "chess960", "crazyhouse", "antichess", "horde", "king-of-the-hill", "three-check", "racing-kings"]);
export function get3DCollection(variantKey: string): PieceCollection | null {
  if (variantKey === "jungle") return "jungle";
  if (variantKey === "shatranj" || variantKey === "chaturanga") return variantKey;
  if (variantKey === "konane") return "konane";
  if (variantKey === "ouk-chaktrang") return "khmer";
  if (variantKey === "shogi" || variantKey === "mini-shogi") return "shogi";
  if (["english-draughts", "international-draughts", "turkish-draughts"].includes(variantKey)) return "draughts";
  if (variantKey === "xiangqi" || variantKey === "janggi" || variantKey === "makruk") return variantKey;
  return classicVariants.has(variantKey) ? "classic" : null;
}

export const collectionPieces: Record<PieceCollection, Record<string, string>> = {
  jungle: {r:"rat",c:"cat",w:"wolf",d:"dog",p:"leopard",t:"tiger",l:"lion",e:"elephant"},
  chaturanga: { k: "raja", m: "minister", e: "elephant", n: "horse", r: "chariot", p: "infantry" },
  shatranj: { k: "shah", f: "ferz", a: "alfil", n: "horse", r: "rukh", p: "pawn" },
  konane: { p: "stone" },
  draughts: { p: "man", x: "king" },
  makruk: { k: "khun", m: "met", s: "khon", n: "ma", r: "ruea", p: "bia" },
  khmer: { k: "Khon_king", m: "Neang_queen", s: "Koul_bishop", n: "Ses_horse", r: "Touk_boat", p: "Trey_fish" },
  classic: { k: "king", q: "queen", b: "bishop", n: "knight", r: "rook", p: "pawn" },
  xiangqi: { g: "general", a: "advisor", e: "elephant", h: "horse", r: "chariot", c: "cannon", p: "soldier" },
  janggi: { g: "general", a: "advisor", e: "elephant", h: "horse", r: "chariot", c: "cannon", p: "soldier" },
  shogi: { k: "king", r: "rook", b: "bishop", g: "gold", s: "silver", n: "knight", l: "lance", p: "pawn" }
};

export const shogiPromotedCodes = new Set(["r", "b", "s", "n", "l", "p"]);
export function pieceModelName(collection: PieceCollection, code: string, firstSide: boolean, promoted = false) {
  if (collection === "makruk" && promoted && code === "m") return `${firstSide ? "light" : "dark"}_promoted_bia`;
  return `${firstSide ? "light" : "dark"}_${collection === "shogi" && promoted && shogiPromotedCodes.has(code) ? "promoted_" : ""}${collectionPieces[collection][code]}`;
}

export function board3DLayout(collection: PieceCollection, rows: number, cols: number) {
  const pitchX = .053, pitchZ = collection === "shogi" ? .057 : .053;
  const width = cols * pitchX, depth = rows * pitchZ;
  // The two komadai belong in the default Shogi composition, even while empty.
  const cameraScale = Math.max(.85, Math.max(width, depth) / .424, collection === "shogi" ? (width + .438) / .65 : 0);
  return { pitchX, pitchZ, width, depth, cameraScale, edgeX: width / 2 + .015, edgeZ: depth / 2 + .015 };
}

export const board3DPalettes: Record<BoardThemePreference, readonly [number, number]> = {
  classic: [0xddd0ad, 0x60764e], wood: [0xbd925e, 0x765039], jade: [0xdbe2c6, 0x6f947d],
  contrast: [0xf2efe5, 0x303638], slate: [0xcad5df, 0x556b7d], plum: [0xe4d6df, 0x8f6a86], ocean: [0xd3e7e3, 0x508396]
};

export const tabletopCameraTarget = [0, -.02, 0] as const;
export const tabletopAspect = 1.25;
export const tabletopFieldOfView = 2 * Math.atan(Math.tan(42 * Math.PI / 360) / tabletopAspect) * 180 / Math.PI;
export const tabletopCameraPosition = [.30, .56, .76] as const;

export function isPieceFinish(value: string | null): value is PieceFinish { return value === "original" || value === "porcelain" || value === "slate"; }
