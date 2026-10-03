import type { GameState, PlayerColor } from "./types";

// Follows Lichess/scalachess InsufficientMatingMaterial. Only orthodox-material
// variants use it; three-check draws bare kings only, the rest keep their own endings.
const orthodoxVariants = new Set(["classic", "chess960"]);

type Material = { kings: number; knights: number; bishops: number; pawns: number; queens: number; others: number };

const noMaterial = (): Material => ({ kings: 0, knights: 0, bishops: 0, pawns: 0, queens: 0, others: 0 });

function readMaterial(state: GameState) {
  const byOwner = new Map<PlayerColor, Material>();
  const bishopSquareColors = new Set<number>();
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece) continue;
      const material = byOwner.get(piece.owner) ?? noMaterial();
      byOwner.set(piece.owner, material);
      if (piece.code === "k") material.kings += 1;
      else if (piece.code === "n") material.knights += 1;
      else if (piece.code === "p") material.pawns += 1;
      else if (piece.code === "q") material.queens += 1;
      else if (piece.code === "b") {
        material.bishops += 1;
        bishopSquareColors.add((cell.square.row + cell.square.col) % 2);
      } else material.others += 1;
    }
  }
  const of = (owner: PlayerColor) => byOwner.get(owner) ?? noMaterial();
  return { of, bishopsOnBothColors: bishopSquareColors.size === 2 };
}

const nonKings = (side: Material) => side.knights + side.bishops + side.pawns + side.queens + side.others;

function opponentOf(state: GameState, color: PlayerColor): PlayerColor {
  return state.clocks.find((clock) => clock.color !== color)?.color ?? (color === "white" ? "black" : "white");
}

/** Automatic draw: neither side can ever mate (K v K, K+minor v K, only same-coloured bishops). */
export function isInsufficientMaterialDraw(state: GameState) {
  const { of, bishopsOnBothColors } = readMaterial(state);
  const sides = [of(state.turn), of(opponentOf(state, state.turn))];
  if (sides.some((side) => side.kings === 0)) return false;
  if (state.variantKey === "three-check") return sides.every((side) => nonKings(side) === 0);
  if (!orthodoxVariants.has(state.variantKey)) return false;
  if (sides.some((side) => side.pawns + side.queens + side.others > 0)) return false;
  const minors = sides.reduce((total, side) => total + side.knights + side.bishops, 0);
  const knights = sides.reduce((total, side) => total + side.knights, 0);
  return minors <= 1 || (knights === 0 && !bishopsOnBothColors);
}

/** FIDE 6.9: a flag loses only if `color` could still mate by some series of legal moves. */
export function canWinOnTime(state: GameState, color: PlayerColor) {
  const { of, bishopsOnBothColors } = readMaterial(state);
  const own = of(color);
  if (state.variantKey === "three-check") return nonKings(own) > 0;
  if (!orthodoxVariants.has(state.variantKey)) return true;
  const opponent = of(opponentOf(state, color));
  if (nonKings(own) === 0) return false;
  if (nonKings(own) === own.knights) return own.knights > 1 || nonKings(opponent) > opponent.queens;
  if (nonKings(own) === own.bishops) return bishopsOnBothColors || opponent.knights + opponent.pawns > 0;
  return true;
}
