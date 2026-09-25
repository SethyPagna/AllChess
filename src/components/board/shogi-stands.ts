import type { GameState, PlayerColor } from "@/lib/variants";

export const shogiStandSize = .174;
export const shogiStandTop = .002;
const handOrder = ["r", "b", "g", "s", "n", "l", "p"];

/** Each player's komadai is at their right, aligned with their end of the board. */
export function shogiStands(width: number, depth: number) {
  return [true, false].map(near => ({
    near,
    x: (near ? 1 : -1) * (width / 2 + .045 + shogiStandSize / 2),
    z: (near ? 1 : -1) * (depth / 2 + .029 - shogiStandSize / 2),
    size: shogiStandSize
  }));
}

export function shogiHandSlots(width: number, depth: number, hands: GameState["hands"], flipped: boolean) {
  return shogiStands(width, depth).flatMap(stand => {
    const owner: PlayerColor = stand.near !== flipped ? "sente" : "gote";
    const direction = stand.near ? 1 : -1;
    return handOrder.filter(code => (hands?.[owner]?.[code] ?? 0) > 0).map((code, i) => ({
      owner, code, count: hands![owner]![code], near: stand.near,
      x: stand.x + direction * ((i % 3) - 1) * .05,
      z: stand.z + direction * (Math.floor(i / 3) - 1) * .051,
      rotation: stand.near ? 0 : Math.PI
    }));
  });
}
