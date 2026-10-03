import { applyMove, getLegalMoves, getVariant, sameSquare } from "@/lib/variants";
import type { GameState, Move, Piece, PlayerColor, Square, VariantDefinition } from "@/lib/variants";

/**
 * Display-only move text. `move.notation` stays the engine's persisted key;
 * everything here is derived from the positions around the move and never throws.
 */

type RecordedMove = GameState["moves"][number];
export type NotationMove = Move & { notation?: string };

type CastlingSide = "king" | "queen";

const PASS = "pass";
const TOP_SIDE: ReadonlySet<PlayerColor> = new Set(["black", "blue", "gote"]);
// Draughts men and Kōnane stones are interchangeable, so a letter adds nothing.
const UNLETTERED_VARIANTS: ReadonlySet<string> = new Set(["english-draughts", "international-draughts", "turkish-draughts", "konane"]);
const PROMOTION_LETTERS: Record<string, string> = { queen: "Q", rook: "R", bishop: "B", knight: "N", king: "K" };
const DEFAULT_PROMOTION: Record<string, string> = { chaturanga: "M", shatranj: "F" };

export function formatMoveNotation(before: GameState, move: NotationMove, after?: GameState): string {
  try {
    const variant = getVariant(before.variantKey);
    const resolvedAfter = resolveAfter(before, move, after);
    const text = variant.family === "western"
      ? formatSan(variant, before, move, resolvedAfter)
      : formatCoordinates(variant, before, move, resolvedAfter);
    return text || storedNotation(move);
  } catch {
    return storedNotation(move);
  }
}

/** `timeline[i]` is the position before `moves[i]`; `timeline[i + 1]` (optional for the last move) is the position after it. */
export function formatTimelineNotation(timeline: readonly GameState[], moves: readonly RecordedMove[]): string[] {
  try {
    const byPly = new Map<number, GameState>();
    for (const state of timeline) {
      if (Array.isArray(state?.moves) && !byPly.has(state.moves.length)) byPly.set(state.moves.length, state);
    }
    return moves.map((move, ply) => {
      const before = positionAt(timeline, byPly, ply);
      return before ? formatMoveNotation(before, move, positionAt(timeline, byPly, ply + 1)) : storedNotation(move);
    });
  } catch {
    return Array.isArray(moves) ? moves.map((move) => storedNotation(move)) : [];
  }
}

function storedNotation(move: unknown): string {
  const notation = (move as { notation?: unknown } | null | undefined)?.notation;
  return typeof notation === "string" ? notation : "";
}

function positionAt(timeline: readonly GameState[], byPly: Map<number, GameState>, ply: number) {
  const indexed = timeline[ply];
  if (indexed && (!Array.isArray(indexed.moves) || indexed.moves.length === ply)) return indexed;
  return byPly.get(ply);
}

function resolveAfter(before: GameState, move: Move, after?: GameState): GameState | undefined {
  if (after && after.variantKey === before.variantKey && followsDirectly(before, after)) return after;
  try {
    return applyMove(before, move);
  } catch {
    return undefined;
  }
}

function followsDirectly(before: GameState, after: GameState) {
  if (!Array.isArray(before.moves) || !Array.isArray(after.moves)) return true;
  return after.moves.length === before.moves.length + 1;
}

function formatSan(variant: VariantDefinition, before: GameState, move: Move, after?: GameState): string {
  const kind = moveKind(move);
  if (kind === "pass") return PASS;
  if (kind === "remove") return `x${squareName(before, move.from)}`;
  if (kind === "drop") {
    const drop = requireDrop(move);
    return `${drop.code.toUpperCase()}@${squareName(before, move.to)}${checkSuffix(variant, before, after, drop.owner ?? before.turn)}`;
  }

  const piece = requirePiece(before, move.from);
  const suffix = checkSuffix(variant, before, after, piece.owner);
  const castle = variant.supportsCastling && piece.code === "k" ? castlingSide(before, move, piece, after) : null;
  if (castle) return `${castle === "king" ? "O-O" : "O-O-O"}${suffix}`;

  const destination = squareName(before, move.to);
  if (piece.code === "p") {
    // A pawn only changes file when it captures, which also covers en passant onto an empty square.
    const capture = move.from.col !== move.to.col || isCapture(before, move, piece.owner, after);
    return `${capture ? `${fileName(move.from.col)}x` : ""}${destination}${pawnPromotion(variant, before, move, piece, after)}${suffix}`;
  }
  const capture = isCapture(before, move, piece.owner, after) ? "x" : "";
  return `${piece.code.toUpperCase()}${sanDisambiguation(before, move, piece)}${capture}${destination}${suffix}`;
}

function castlingSide(before: GameState, move: Move, king: Piece, after?: GameState): CastlingSide | null {
  if (move.from.row !== move.to.row) return null;
  const target = pieceAt(before, move.to);
  if (target?.owner === king.owner && target.code === "r") return sideOf(move.to.col, move.from.col);
  if (Math.abs(move.to.col - move.from.col) === 2) return sideOf(move.to.col, move.from.col);
  if (!after) return null;
  // Chess960-style encodings: the king and one of its own rooks both moved along the back rank.
  const backRank = before.board[move.from.row] ?? [];
  for (let col = 0; col < backRank.length; col += 1) {
    const rook = backRank[col]?.piece;
    if (!rook || rook.owner !== king.owner || rook.code !== "r") continue;
    const landed = findPieceSquare(after, rook.id);
    if (landed && !sameSquare(landed, { row: move.from.row, col })) return sideOf(col, move.from.col);
  }
  return null;
}

function sideOf(rookOrTargetCol: number, kingCol: number): CastlingSide {
  return rookOrTargetCol > kingCol ? "king" : "queen";
}

function sanDisambiguation(before: GameState, move: Move, piece: Piece) {
  const rivals: Square[] = [];
  before.board.forEach((cells, row) => cells.forEach((cell, col) => {
    const other = cell?.piece;
    if (!other || other.owner !== piece.owner || other.code !== piece.code) return;
    const square = { row, col };
    if (sameSquare(square, move.from)) return;
    if (getLegalMoves(before, square).some((candidate) => moveKind(candidate) === "move" && sameSquare(candidate.to, move.to))) rivals.push(square);
  }));
  if (rivals.length === 0) return "";
  const file = fileName(move.from.col);
  const rank = rankName(before, move.from.row);
  if (rivals.every((square) => square.col !== move.from.col)) return file;
  if (rivals.every((square) => square.row !== move.from.row)) return rank;
  return `${file}${rank}`;
}

function pawnPromotion(variant: VariantDefinition, before: GameState, move: Move, pawn: Piece, after?: GameState) {
  if (after) {
    const landed = pieceAt(after, move.to);
    return landed && landed.owner === pawn.owner && landed.code !== pawn.code ? `=${landed.code.toUpperCase()}` : "";
  }
  const requested = requestedPromotion(move);
  if (requested) return `=${requested}`;
  const lastRank = move.to.row === 0 || move.to.row === before.board.length - 1;
  return variant.supportsPromotion && lastRank ? `=${DEFAULT_PROMOTION[variant.key] ?? "Q"}` : "";
}

function requestedPromotion(move: Move): string | null {
  const value: unknown = (move as Move & { promoteTo?: unknown }).promoteTo;
  const code = typeof value === "string"
    ? value
    : value && typeof value === "object" && typeof (value as { code?: unknown }).code === "string"
      ? (value as { code: string }).code
      : "";
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return PROMOTION_LETTERS[normalized] ?? normalized.charAt(0).toUpperCase();
}

function checkSuffix(variant: VariantDefinition, before: GameState, after: GameState | undefined, mover: PlayerColor) {
  if (!after) return "";
  if (isCheckmate(after)) return "#";
  if (!variant.supportsCheck) return "";
  const checked = variant.players.some((defender) => defender !== mover && (checkCountRose(before, after, defender) || isKingAttacked(after, defender)));
  return checked ? "+" : "";
}

function checkCountRose(before: GameState, after: GameState, defender: PlayerColor) {
  return (after.checks?.[defender] ?? 0) > (before.checks?.[defender] ?? 0);
}

function isKingAttacked(state: GameState, defender: PlayerColor) {
  const kings: Square[] = [];
  const attackers: Array<{ piece: Piece; square: Square }> = [];
  state.board.forEach((cells, row) => cells.forEach((cell, col) => {
    const piece = cell?.piece;
    if (!piece) return;
    if (piece.owner !== defender) attackers.push({ piece, square: { row, col } });
    else if (piece.code === "k") kings.push({ row, col });
  }));
  return kings.some((king) => attackers.some(({ piece, square }) => attacksSquare(state, piece, square, king)));
}

function attacksSquare(state: GameState, piece: Piece, from: Square, target: Square) {
  const dr = target.row - from.row;
  const dc = target.col - from.col;
  const rows = Math.abs(dr);
  const cols = Math.abs(dc);
  if (rows + cols === 0) return false;
  switch (piece.code) {
    case "p":
      return dr === (TOP_SIDE.has(piece.owner) ? 1 : -1) && cols === 1;
    case "n":
      return (rows === 1 && cols === 2) || (rows === 2 && cols === 1);
    case "k":
      return Math.max(rows, cols) === 1;
    case "m": // chaturanga mantri
    case "f": // shatranj ferz
      return rows === 1 && cols === 1;
    case "e": // chaturanga elephant
    case "a": // shatranj alfil
      return rows === 2 && cols === 2;
    case "b":
      return rows === cols && isLineClear(state, from, target);
    case "r":
      return (rows === 0 || cols === 0) && isLineClear(state, from, target);
    case "q":
      return (rows === cols || rows === 0 || cols === 0) && isLineClear(state, from, target);
    default:
      return false;
  }
}

function isLineClear(state: GameState, from: Square, to: Square) {
  const stepRow = Math.sign(to.row - from.row);
  const stepCol = Math.sign(to.col - from.col);
  let row = from.row + stepRow;
  let col = from.col + stepCol;
  while (row !== to.row || col !== to.col) {
    if (state.board[row]?.[col]?.piece) return false;
    row += stepRow;
    col += stepCol;
  }
  return true;
}

function formatCoordinates(variant: VariantDefinition, before: GameState, move: Move, after?: GameState): string {
  const kind = moveKind(move);
  if (kind === "pass") return PASS;
  if (kind === "remove") return `x${squareName(before, move.from)}`;
  const mate = after && isCheckmate(after) ? "#" : "";
  if (kind === "drop") return `${requireDrop(move).code.toUpperCase()}*${squareName(before, move.to)}${mate}`;

  const piece = requirePiece(before, move.from);
  const unlettered = UNLETTERED_VARIANTS.has(variant.key);
  const capture = isCapture(before, move, piece.owner, after) || (unlettered && !after && jumpsEnemy(before, move, piece.owner));
  const letter = unlettered ? "" : `${piece.promoted ? "+" : ""}${piece.code.toUpperCase()}`;
  const promotion = !unlettered && promotesOnMove(move, piece, after) ? "+" : "";
  return `${letter}${squareName(before, move.from)}${capture ? "x" : "-"}${squareName(before, move.to)}${promotion}${mate}`;
}

function promotesOnMove(move: Move, piece: Piece, after?: GameState) {
  if (piece.promoted) return false;
  if (!after) return move.promotion === true;
  const landed = pieceAt(after, move.to);
  return Boolean(landed && landed.owner === piece.owner && landed.promoted);
}

/** Captures can happen away from the destination (draughts jumps, en passant), so compare enemy material too. */
function isCapture(before: GameState, move: Move, mover: PlayerColor, after?: GameState) {
  const target = pieceAt(before, move.to);
  if (target && target.owner !== mover) return true;
  return after ? countEnemies(after, mover) < countEnemies(before, mover) : false;
}

function jumpsEnemy(before: GameState, move: Move, mover: PlayerColor) {
  const rows = Math.abs(move.to.row - move.from.row);
  const cols = Math.abs(move.to.col - move.from.col);
  if (Math.max(rows, cols) < 2 || (rows !== 0 && cols !== 0 && rows !== cols)) return false;
  const stepRow = Math.sign(move.to.row - move.from.row);
  const stepCol = Math.sign(move.to.col - move.from.col);
  for (let row = move.from.row + stepRow, col = move.from.col + stepCol; row !== move.to.row || col !== move.to.col; row += stepRow, col += stepCol) {
    const piece = before.board[row]?.[col]?.piece;
    if (piece && piece.owner !== mover) return true;
  }
  return false;
}

function countEnemies(state: GameState, mover: PlayerColor) {
  let count = 0;
  for (const cells of state.board) {
    for (const cell of cells) {
      if (cell?.piece && cell.piece.owner !== mover) count += 1;
    }
  }
  return count;
}

function isCheckmate(state: GameState) {
  return state.status === "completed" && state.outcomeReason === "checkmate";
}

function moveKind(move: Move): NonNullable<Move["kind"]> {
  return move.kind ?? (move.drop ? "drop" : "move");
}

function requireDrop(move: Move): Piece {
  if (!move.drop || typeof move.drop.code !== "string" || !move.drop.code) throw new Error("Drop move without a piece");
  return move.drop;
}

function requirePiece(state: GameState, square: Square): Piece {
  const piece = pieceAt(state, square);
  if (!piece || typeof piece.code !== "string" || !piece.code) throw new Error("No piece on the origin square");
  return piece;
}

function pieceAt(state: GameState, square: Square) {
  return state.board[square.row]?.[square.col]?.piece ?? null;
}

function findPieceSquare(state: GameState, id: string): Square | null {
  for (let row = 0; row < state.board.length; row += 1) {
    const cells = state.board[row] ?? [];
    for (let col = 0; col < cells.length; col += 1) {
      if (cells[col]?.piece?.id === id) return { row, col };
    }
  }
  return null;
}

/** Files a, b, c… from the left; ranks count up from the bottom row, so row 0 is the top rank. */
function squareName(state: GameState, square: Square) {
  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;
  if (!Number.isInteger(square?.row) || !Number.isInteger(square?.col) || square.row < 0 || square.col < 0 || square.row >= rows || square.col >= cols) {
    throw new Error("Square outside the board");
  }
  return `${fileName(square.col)}${rankName(state, square.row)}`;
}

function fileName(col: number) {
  return String.fromCharCode(97 + col);
}

function rankName(state: GameState, row: number) {
  return String(state.board.length - row);
}
