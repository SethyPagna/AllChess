import { getVariant } from "./catalog";
import type { BoardCell, GameState, Move, Piece, PlayerColor, Square, VariantDefinition } from "./types";

const pieceLabels: Record<string, string> = {
  k: "chess.king",
  q: "chess.queen",
  r: "chess.rook",
  b: "chess.bishop",
  n: "chess.knight",
  p: "chess.pawn",
  g: "chess.king",
  a: "chess.bishop",
  e: "chess.elephant",
  h: "chess.knight",
  c: "chess.rook",
  s: "chess.pawn",
  l: "chess.rook",
  d: "chess.pawn",
  w: "chess.pawn",
  t: "chess.rook"
};

export function createInitialState(variantKey: string, id = crypto.randomUUID()): GameState {
  const variant = getVariant(variantKey);
  const board = buildBoard(variant);
  return {
    id,
    variantKey: variant.key,
    board,
    turn: variant.players[0],
    ply: 0,
    status: "active",
    moves: [],
    captured: [],
    checks: {},
    clocks: variant.players.map((color) => ({
      color,
      remainingMs: 600000,
      incrementMs: 5000
    }))
  };
}

export function buildBoard(variant: VariantDefinition): BoardCell[][] {
  return Array.from({ length: variant.board.rows }, (_, row) =>
    Array.from({ length: variant.board.cols }, (_, col) => {
      const token = variant.setup[row]?.[col] ?? ".";
      return {
        square: { row, col },
        terrain: terrainFor(variant, { row, col }),
        piece: token === "." ? null : makePiece(token, ownerForToken(token, variant), row, col)
      };
    })
  );
}

export function getLegalMoves(state: GameState, from: Square): Move[] {
  const cell = cellAt(state, from);
  if (!cell?.piece || cell.piece.owner !== state.turn) return [];

  const directions = movementDirections(cell.piece.code);
  const sliding = isSlidingPiece(cell.piece.code);
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    let row = from.row + orient(cell.piece.owner, dr);
    let col = from.col + dc;
    while (isInside(state, { row, col })) {
      const target = cellAt(state, { row, col });
      if (!target) break;
      if (!target.piece) {
        moves.push({ from, to: { row, col } });
      } else {
        if (target.piece.owner !== cell.piece.owner) {
          moves.push({ from, to: { row, col } });
        }
        break;
      }
      if (!sliding) break;
      row += orient(cell.piece.owner, dr);
      col += dc;
    }
  }

  return moves.filter((move) => terrainAllows(state, cell.piece, move.to));
}

export function applyMove(state: GameState, move: Move): GameState {
  const legal = getLegalMoves(state, move.from).some((candidate) => sameSquare(candidate.to, move.to));
  if (!legal) {
    throw new Error("errors.invalidMove");
  }

  const next: GameState = structuredClone(state);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  if (!fromCell?.piece || !toCell) throw new Error("errors.invalidMove");

  const movingPiece = fromCell.piece;
  const captured = toCell.piece;
  if (captured) next.captured.push(captured);
  toCell.piece = { ...movingPiece, promoted: move.promotion || movingPiece.promoted };
  fromCell.piece = null;
  next.ply += 1;
  next.turn = next.turn === next.clocks[0]?.color ? next.clocks[1]?.color ?? "black" : next.clocks[0]?.color ?? "white";
  next.moves.push({ ...move, notation: notationFor(movingPiece, move) });
  return next;
}

export function serializeSquare(square: Square) {
  return `${square.row}:${square.col}`;
}

export function sameSquare(a: Square, b: Square) {
  return a.row === b.row && a.col === b.col;
}

function cellAt(state: GameState, square: Square) {
  return state.board[square.row]?.[square.col];
}

function isInside(state: GameState, square: Square) {
  return square.row >= 0 && square.col >= 0 && square.row < state.board.length && square.col < (state.board[0]?.length ?? 0);
}

function makePiece(token: string, owner: PlayerColor, row: number, col: number): Piece {
  const code = token.toLowerCase();
  return {
    id: `${owner}-${code}-${row}-${col}`,
    code,
    owner,
    labelKey: pieceLabels[code] ?? "chess.pawn"
  };
}

function ownerForToken(token: string, variant: VariantDefinition): PlayerColor {
  if (variant.players.includes("red") && token === token.toUpperCase()) return "red";
  if (variant.players.includes("blue") && token === token.toLowerCase()) return "blue";
  if (variant.players.includes("sente") && token === token.toUpperCase()) return "sente";
  if (variant.players.includes("gote") && token === token.toLowerCase()) return "gote";
  return token === token.toUpperCase() ? "white" : "black";
}

function terrainFor(variant: VariantDefinition, square: Square): BoardCell["terrain"] {
  if (variant.key === "jungle") {
    const river = square.row >= 3 && square.row <= 5 && [1, 2, 4, 5].includes(square.col);
    if (river) return "river";
    if ((square.row === 0 || square.row === 8) && square.col === 3) return "den";
    if ((square.row <= 1 || square.row >= 7) && [2, 3, 4].includes(square.col)) return "trap";
  }
  if (variant.key === "xiangqi" || variant.key === "janggi") {
    if ((square.row <= 2 || square.row >= 7) && square.col >= 3 && square.col <= 5) return "palace";
  }
  if (variant.supportsPromotion && (square.row <= 2 || square.row >= variant.board.rows - 3)) {
    return "promotion-zone";
  }
  return "land";
}

function movementDirections(code: string): Array<[number, number]> {
  switch (code.toLowerCase()) {
    case "p":
    case "s":
      return [[-1, 0]];
    case "n":
    case "h":
      return [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    case "b":
    case "e":
      return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    case "r":
    case "c":
    case "l":
      return [[-1, 0], [1, 0], [0, -1], [0, 1]];
    case "q":
    case "g":
    case "k":
    default:
      return [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  }
}

function isSlidingPiece(code: string) {
  return ["q", "r", "b", "c", "l"].includes(code.toLowerCase());
}

function orient(owner: PlayerColor, deltaRow: number) {
  return ["black", "blue", "gote"].includes(owner) ? -deltaRow : deltaRow;
}

function terrainAllows(state: GameState, piece: Piece, to: Square) {
  const target = cellAt(state, to);
  if (!target) return false;
  if (target.terrain === "river" && piece.code !== "r") return false;
  if (target.terrain === "den" && piece.owner === state.turn) return false;
  return true;
}

function notationFor(piece: Piece | null, move: Move) {
  const label = piece?.code.toUpperCase() ?? "?";
  return `${label}${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
}
