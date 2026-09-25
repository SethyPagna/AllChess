import type { GameState, PlayerColor } from "@/lib/variants";

export const shogiStandSize = .174;
export const shogiStandTop = .002;
const handOrder = ["r", "b", "g", "s", "n", "l", "p"];

/** Right-side komadai on wide boards; compact end trays on narrow screens. */
export function shogiStands(width: number, depth: number, compact = false) {
  return [true, false].map(near => ({
    near,
    x: compact ? 0 : (near ? 1 : -1) * (width / 2 + .045 + shogiStandSize / 2),
    z: (near ? 1 : -1) * (compact ? depth / 2 + .115 : depth / 2 + .029 - shogiStandSize / 2),
    size: shogiStandSize, width: compact ? .224 : shogiStandSize, depth: compact ? .122 : shogiStandSize
  }));
}

export function shogiHandSlots(width: number, depth: number, hands: GameState["hands"], flipped: boolean, compact = false) {
  return shogiStands(width, depth, compact).flatMap(stand => {
    const owner: PlayerColor = stand.near !== flipped ? "sente" : "gote";
    const direction = stand.near ? 1 : -1;
    return handOrder.filter(code => (hands?.[owner]?.[code] ?? 0) > 0).map((code, i) => ({
      owner, code, count: hands![owner]![code], near: stand.near,
      x: stand.x + direction * ((i % (compact ? 4 : 3)) - (compact ? 1.5 : 1)) * .05,
      z: stand.z + direction * (Math.floor(i / (compact ? 4 : 3)) - (compact ? .5 : 1)) * .051,
      rotation: stand.near ? 0 : Math.PI
    }));
  });
}
