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
  f: "chess.queen",
  s: "chess.pawn",
  m: "chess.queen",
  l: "chess.rook",
  d: "chess.pawn",
  w: "chess.pawn",
  t: "chess.rook",
  x: "chess.king"
};

const janggiPiecePoints: Record<string, number> = {
  g: 0,
  r: 13,
  c: 7,
  h: 5,
  e: 3,
  a: 3,
  p: 2
};

type MakrukCountingState = {
  phase: "board" | "bare-king";
  startedAtPly: number;
  remainingMoves: number;
  limit: number;
  strongerSide?: PlayerColor;
  pieceCount: number;
};

type ShogiRepetitionState = {
  key: string;
  count: number;
  occurrences: Record<string, number>;
  checker: PlayerColor | null;
};

type ShogiImpasseState = {
  sentePoints: number;
  gotePoints: number;
  senteKingEntered: boolean;
  goteKingEntered: boolean;
};

type JanggiScoringState = {
  redPoints: number;
  bluePoints: number;
  redPieceCounts: Record<string, number>;
  bluePieceCounts: Record<string, number>;
};

type DropMoveOptions = {
  validatePawnDropMate?: boolean;
};

export function createInitialState(variantKey: string, id = crypto.randomUUID()): GameState {
  const variant = getVariant(variantKey);
  const board = buildBoard(variant);
  const state: GameState = {
    id,
    variantKey: variant.key,
    board,
    turn: variant.players[0],
    ply: 0,
    status: "active",
    moves: [],
    captured: [],
    checks: {},
    halfmoveClock: 0,
    clocks: variant.players.map((color) => ({
      color,
      remainingMs: 600000,
      incrementMs: 5000
    }))
  };
  if (variant.supportsDrops) {
    state.hands = Object.fromEntries(variant.players.map((player) => [player, {}])) as GameState["hands"];
  }
  return state;
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

export function getLegalMoves(state: GameState, fromOrHand: Square | { drop: Piece }): Move[] {
  if (state.status !== "active") return [];

  if ("drop" in fromOrHand) {
    return getLegalDropMoves(state, fromOrHand.drop);
  }

  const from = fromOrHand;
  const cell = cellAt(state, from);
  if (!cell?.piece || cell.piece.owner !== state.turn) return [];

  const variant = getVariant(state.variantKey);
  const pseudoMoves =
    variant.supportsCastling && cell.piece.code === "k"
      ? [...getPseudoLegalMoves(state, from), ...castlingMoves(state, from, cell.piece)]
      : getPseudoLegalMoves(state, from);

  const legalMoves = pseudoMoves.filter((move) => {
    const target = cellAt(state, move.to)?.piece;
    if (variant.supportsCheck && target && isRoyal(target)) return false;
    if (!variant.supportsCheck) return true;
    if (variant.key === "racing-kings" && wouldGiveRoyalCheck(state, move, cell.piece!.owner)) return false;
    return !wouldLeaveRoyalInCheck(state, move, cell.piece!.owner);
  });

  if (variant.key === "antichess" && hasAnyCaptureMove(state, state.turn)) {
    return legalMoves.filter((move) => isCaptureMove(state, move));
  }
  if (isDraughtsVariant(variant.key)) {
    const continuation = draughtsContinuationFor(state);
    if (continuation && (!sameSquare(from, continuation.square) || continuation.owner !== state.turn)) return [];
    const requiredCaptures = draughtsRequiredCaptureLength(state, state.turn, continuation?.square);
    if (requiredCaptures > 0) return legalMoves.filter((move) => draughtsCaptureLengthForMove(state, move) === requiredCaptures);
  }

  return legalMoves;
}

function getPseudoLegalMoves(state: GameState, from: Square): Move[] {
  const cell = cellAt(state, from);
  if (!cell?.piece) return [];

  const piece = cell.piece;
  const variant = getVariant(state.variantKey);
  if (variant.key === "janggi") {
    return janggiPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (isShogiFamily(variant.key)) {
    return shogiPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (variant.key === "makruk") {
    return makrukPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (variant.key === "chaturanga") {
    return chaturangaPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (variant.key === "shatranj") {
    return shatranjPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (variant.key === "xiangqi" || variant.key === "janggi") {
    return eastAsianPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }
  if (variant.key === "jungle") {
    return junglePieceMoves(state, piece, from);
  }
  if (isDraughtsVariant(variant.key)) {
    return draughtsPieceMoves(state, piece, from);
  }
  if (piece.code === "p" && ["western", "southeast-asian"].includes(variant.family)) {
    return westernPawnMoves(state, piece, from, variant.family === "western").filter((move) => terrainAllows(state, piece, move.to));
  }
  if (piece.code === "p" && (variant.key === "xiangqi" || variant.key === "janggi")) {
    return xiangqiSoldierMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
  }

  return genericPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
}

function getLegalDropMoves(state: GameState, drop: Piece, options: DropMoveOptions = {}): Move[] {
  const variant = getVariant(state.variantKey);
  if (!variant.supportsDrops || drop.owner !== state.turn) return [];
  const handCount = state.hands?.[drop.owner]?.[drop.code] ?? 0;
  if (handCount <= 0) return [];

  const moves: Move[] = [];
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece || !canDropPieceOn(state, drop, cell.square)) continue;
      const move = { kind: "drop" as const, from: { row: -1, col: -1 }, to: cell.square, drop };
      if (variant.supportsCheck && wouldDropLeaveRoyalInCheck(state, move, drop.owner)) continue;
      if (options.validatePawnDropMate !== false && isShogiPawnDropMate(state, move)) continue;
      moves.push(move);
    }
  }
  return moves;
}

function canDropPieceOn(state: GameState, drop: Piece, to: Square) {
  if (state.variantKey === "crazyhouse") return canDropCrazyhousePieceOn(state, drop, to);
  if (!isShogiFamily(state.variantKey)) return true;
  if (isShogiDeadDrop(drop, to, state.board.length)) return false;
  if (drop.code === "p" && hasUnpromotedShogiPawnOnFile(state, drop.owner, to.col)) return false;
  return true;
}

function canDropCrazyhousePieceOn(state: GameState, drop: Piece, to: Square) {
  if (drop.code !== "p") return true;
  return to.row > 0 && to.row < state.board.length - 1;
}

function isShogiPawnDropMate(state: GameState, move: Move) {
  if (!isShogiFamily(state.variantKey) || move.drop?.code !== "p") return false;
  const next: GameState = structuredClone(state);
  const toCell = cellAt(next, move.to);
  if (!toCell || toCell.piece) return false;
  toCell.piece = { ...move.drop, promoted: false };
  next.turn = opponentOf(move.drop.owner);
  return isInCheck(next, next.turn) && !hasAnyLegalMove(next, next.turn, { validatePawnDropMate: false });
}

function isShogiDeadDrop(piece: Piece, to: Square, boardRows: number) {
  const lastRank = piece.owner === "sente" ? 0 : boardRows - 1;
  const penultimateRank = piece.owner === "sente" ? 1 : boardRows - 2;
  if (["p", "l"].includes(piece.code)) return to.row === lastRank;
  if (piece.code === "n") return piece.owner === "sente" ? to.row <= penultimateRank : to.row >= penultimateRank;
  return false;
}

function hasUnpromotedShogiPawnOnFile(state: GameState, owner: PlayerColor, col: number) {
  return state.board.some((row) => row[col]?.piece?.owner === owner && row[col]?.piece?.code === "p" && !row[col]?.piece?.promoted);
}

function shogiPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  if (piece.promoted && ["p", "l", "n", "s"].includes(piece.code)) {
    return steppingMoves(state, piece, from, shogiGoldDirections(piece.owner));
  }

  switch (piece.code) {
    case "k":
      return steppingMoves(state, piece, from, movementDirections("k"));
    case "g":
      return steppingMoves(state, piece, from, shogiGoldDirections(piece.owner));
    case "s":
      return steppingMoves(state, piece, from, shogiSilverDirections(piece.owner));
    case "n":
      return steppingMoves(state, piece, from, shogiKnightDirections(piece.owner));
    case "l":
      return rayMoves(state, piece, from, [[shogiForward(piece.owner), 0]]);
    case "p":
      return steppingMoves(state, piece, from, [[shogiForward(piece.owner), 0]]);
    case "b":
      return [
        ...rayMoves(state, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]),
        ...(piece.promoted ? steppingMoves(state, piece, from, [[-1, 0], [1, 0], [0, -1], [0, 1]]) : [])
      ];
    case "r":
      return [
        ...rayMoves(state, piece, from, [[-1, 0], [1, 0], [0, -1], [0, 1]]),
        ...(piece.promoted ? steppingMoves(state, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]) : [])
      ];
    default:
      return steppingMoves(state, piece, from, movementDirections(piece.code));
  }
}

function shogiForward(owner: PlayerColor) {
  return owner === "gote" ? 1 : -1;
}

function shogiGoldDirections(owner: PlayerColor): Array<[number, number]> {
  const forward = shogiForward(owner);
  return [[forward, -1], [forward, 0], [forward, 1], [0, -1], [0, 1], [-forward, 0]];
}

function shogiSilverDirections(owner: PlayerColor): Array<[number, number]> {
  const forward = shogiForward(owner);
  return [[forward, -1], [forward, 0], [forward, 1], [-forward, -1], [-forward, 1]];
}

function shogiKnightDirections(owner: PlayerColor): Array<[number, number]> {
  const forward = shogiForward(owner);
  return [[forward * 2, -1], [forward * 2, 1]];
}

function makrukPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  switch (piece.code) {
    case "m":
      return steppingMoves(state, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    case "s":
      return steppingMoves(state, piece, from, [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [orient(piece.owner, -1), 0]
      ]);
    case "p":
      return westernPawnMoves(state, piece, from, false);
    default:
      return genericPieceMoves(state, piece, from);
  }
}

function chaturangaPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  switch (piece.code) {
    case "m":
      return steppingMoves(state, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    case "e":
      return historicalElephantJumpMoves(state, piece, from);
    case "p":
      return westernPawnMoves(state, piece, from, false);
    default:
      return genericPieceMoves(state, piece, from);
  }
}

function shatranjPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  switch (piece.code) {
    case "f":
      return steppingMoves(state, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    case "a":
      return historicalElephantJumpMoves(state, piece, from);
    case "p":
      return westernPawnMoves(state, piece, from, false);
    default:
      return genericPieceMoves(state, piece, from);
  }
}

function historicalElephantJumpMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const moves: Move[] = [];
  for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]] satisfies Array<[number, number]>) {
    const to = { row: from.row + dr, col: from.col + dc };
    if (canOccupy(state, piece, to)) moves.push({ from, to });
  }
  return moves;
}

function genericPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const directions = movementDirections(piece.code);
  const sliding = isSlidingPiece(piece.code);
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    let row = from.row + orient(piece.owner, dr);
    let col = from.col + dc;
    while (isInside(state, { row, col })) {
      const target = cellAt(state, { row, col });
      if (!target) break;
      if (!target.piece) {
        moves.push({ from, to: { row, col } });
      } else {
        if (target.piece.owner !== piece.owner) {
          moves.push({ from, to: { row, col } });
        }
        break;
      }
      if (!sliding) break;
      row += orient(piece.owner, dr);
      col += dc;
    }
  }

  return moves;
}

function westernPawnMoves(state: GameState, piece: Piece, from: Square, allowDouble: boolean) {
  const forward = orient(piece.owner, -1);
  const moves: Move[] = [];
  const one = { row: from.row + forward, col: from.col };
  if (isInside(state, one) && !cellAt(state, one)?.piece) {
    moves.push({ from, to: one });
    const startRow = ["black", "blue", "gote"].includes(piece.owner) ? 1 : state.board.length - 2;
    const two = { row: from.row + forward * 2, col: from.col };
    if (allowDouble && from.row === startRow && isInside(state, two) && !cellAt(state, two)?.piece) {
      moves.push({ from, to: two });
    }
  }

  for (const dc of [-1, 1]) {
    const capture = { row: from.row + forward, col: from.col + dc };
    const target = cellAt(state, capture);
    if (target?.piece && target.piece.owner !== piece.owner) {
      moves.push({ from, to: capture });
    }
  }

  return moves;
}

function draughtsPieceMoves(state: GameState, piece: Piece, from: Square) {
  return [...draughtsQuietMoves(state, piece, from), ...draughtsCaptureMoves(state, piece, from)];
}

function draughtsQuietMoves(state: GameState, piece: Piece, from: Square) {
  if (state.variantKey === "turkish-draughts" && piece.code === "x") {
    return rayMoves(state, piece, from, draughtsAllOrthogonalDirections);
  }
  if (state.variantKey === "international-draughts" && piece.code === "x") {
    return rayMoves(state, piece, from, draughtsAllDiagonalDirections);
  }

  const directions = draughtsQuietDirections(piece, state.variantKey);
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    const to = { row: from.row + dr, col: from.col + dc };
    if (isInside(state, to) && !cellAt(state, to)?.piece) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function draughtsCaptureMoves(state: GameState, piece: Piece, from: Square) {
  if (state.variantKey === "turkish-draughts" && piece.code === "x") {
    return turkishDraughtsKingCaptures(state, piece, from);
  }
  if (state.variantKey === "international-draughts" && piece.code === "x") {
    return internationalDraughtsKingCaptures(state, piece, from);
  }

  const directions = draughtsCaptureDirections(state.variantKey, piece);
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    const middle = { row: from.row + dr, col: from.col + dc };
    const to = { row: from.row + dr * 2, col: from.col + dc * 2 };
    const jumped = cellAt(state, middle)?.piece;
    if (!isInside(state, to) || cellAt(state, to)?.piece || !jumped || jumped.owner === piece.owner) continue;
    moves.push({ from, to });
  }

  return moves;
}

const draughtsAllDiagonalDirections: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const draughtsAllOrthogonalDirections: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function draughtsQuietDirections(piece: Piece, variantKey?: string): Array<[number, number]> {
  if (variantKey === "turkish-draughts") {
    const forward = orient(piece.owner, -1);
    return [[forward, 0], [0, -1], [0, 1]];
  }
  if (piece.code === "x") return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const forward = orient(piece.owner, -1);
  return [[forward, -1], [forward, 1]];
}

function draughtsCaptureDirections(variantKey: string, piece: Piece): Array<[number, number]> {
  if (variantKey === "turkish-draughts") return draughtsAllOrthogonalDirections;
  if (variantKey === "international-draughts" || piece.code === "x") return draughtsAllDiagonalDirections;
  return draughtsQuietDirections(piece, variantKey);
}

function internationalDraughtsKingCaptures(state: GameState, piece: Piece, from: Square) {
  return flyingDraughtsKingCaptures(state, piece, from, draughtsAllDiagonalDirections);
}

function turkishDraughtsKingCaptures(state: GameState, piece: Piece, from: Square) {
  return flyingDraughtsKingCaptures(state, piece, from, draughtsAllOrthogonalDirections);
}

function flyingDraughtsKingCaptures(state: GameState, piece: Piece, from: Square, directions: Array<[number, number]>) {
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    let square = { row: from.row + dr, col: from.col + dc };
    let jumpedEnemy: Piece | null = null;
    while (isInside(state, square)) {
      const target = cellAt(state, square)?.piece;
      if (!target && jumpedEnemy) {
        moves.push({ from, to: { ...square } });
      } else if (target) {
        if (target.owner === piece.owner || jumpedEnemy) break;
        jumpedEnemy = target;
      }
      square = { row: square.row + dr, col: square.col + dc };
    }
  }

  return moves;
}

function draughtsCapturedSquare(state: GameState, move: Move, piece: Piece): Square | null {
  const rowDelta = move.to.row - move.from.row;
  const colDelta = move.to.col - move.from.col;
  if (!isValidDraughtsCaptureLine(state.variantKey, rowDelta, colDelta)) return null;

  if (!isFlyingDraughtsKing(state.variantKey, piece)) {
    if (Math.max(Math.abs(rowDelta), Math.abs(colDelta)) !== 2) return null;
    const middle = { row: (move.from.row + move.to.row) / 2, col: (move.from.col + move.to.col) / 2 };
    const jumped = cellAt(state, middle)?.piece;
    return jumped && jumped.owner !== piece.owner ? middle : null;
  }

  const step = { row: Math.sign(rowDelta), col: Math.sign(colDelta) };
  let square = { row: move.from.row + step.row, col: move.from.col + step.col };
  let captured: Square | null = null;
  while (!sameSquare(square, move.to)) {
    const target = cellAt(state, square)?.piece;
    if (target) {
      if (target.owner === piece.owner || captured) return null;
      captured = { ...square };
    }
    square = { row: square.row + step.row, col: square.col + step.col };
  }
  return captured;
}

function isValidDraughtsCaptureLine(variantKey: string, rowDelta: number, colDelta: number) {
  if (variantKey === "turkish-draughts") {
    return ((rowDelta === 0) !== (colDelta === 0)) && Math.max(Math.abs(rowDelta), Math.abs(colDelta)) >= 2;
  }
  return Math.abs(rowDelta) === Math.abs(colDelta) && Math.abs(rowDelta) >= 2;
}

function isFlyingDraughtsKing(variantKey: string, piece: Piece) {
  return piece.code === "x" && (variantKey === "international-draughts" || variantKey === "turkish-draughts");
}

function draughtsRequiredCaptureLength(state: GameState, owner: PlayerColor, onlyFrom?: Square) {
  let longest = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner !== owner) continue;
      if (onlyFrom && !sameSquare(cell.square, onlyFrom)) continue;
      longest = Math.max(longest, draughtsMaxCaptureLengthFrom(state, cell.piece, cell.square));
    }
  }
  return longest;
}

function draughtsCaptureLengthForMove(state: GameState, move: Move) {
  const piece = cellAt(state, move.from)?.piece;
  if (!piece) return 0;
  const capturedSquare = draughtsCapturedSquare(state, move, piece);
  if (!capturedSquare) return 0;
  const next = draughtsStateAfterCapture(state, move, piece, capturedSquare);
  if (shouldCrownDraughtsMan(getVariant(state.variantKey), piece, move.to)) return 1;
  return 1 + draughtsMaxCaptureLengthFrom(next, piece, move.to);
}

function draughtsMaxCaptureLengthFrom(state: GameState, piece: Piece, from: Square): number {
  const captures = draughtsCaptureMoves(state, piece, from);
  if (captures.length === 0) return 0;
  return Math.max(
    ...captures.map((move) => {
      const capturedSquare = draughtsCapturedSquare(state, move, piece);
      if (!capturedSquare) return 0;
      const next = draughtsStateAfterCapture(state, move, piece, capturedSquare);
      if (shouldCrownDraughtsMan(getVariant(state.variantKey), piece, move.to)) return 1;
      return 1 + draughtsMaxCaptureLengthFrom(next, piece, move.to);
    })
  );
}

function draughtsStateAfterCapture(state: GameState, move: Move, piece: Piece, capturedSquare: Square): GameState {
  const next: GameState = structuredClone(state);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  const capturedCell = cellAt(next, capturedSquare);
  if (fromCell) fromCell.piece = null;
  if (capturedCell) capturedCell.piece = null;
  if (toCell) toCell.piece = { ...piece };
  return next;
}

function draughtsContinuationFor(state: GameState): { square: Square; owner: PlayerColor } | null {
  const value = state.variantState?.draughtsContinuation;
  if (!value || typeof value !== "object") return null;
  const candidate = value as { row?: unknown; col?: unknown; owner?: unknown };
  if (typeof candidate.row !== "number" || typeof candidate.col !== "number") return null;
  if (candidate.owner !== "white" && candidate.owner !== "black") return null;
  return { square: { row: candidate.row, col: candidate.col }, owner: candidate.owner };
}

function isDraughtsVariant(variantKey: string) {
  return variantKey === "english-draughts" || variantKey === "international-draughts" || variantKey === "turkish-draughts";
}

function shouldCrownDraughtsMan(variant: VariantDefinition, piece: Piece, to: Square) {
  return piece.owner === "white" ? to.row === 0 : to.row === variant.board.rows - 1;
}

function xiangqiSoldierMoves(state: GameState, piece: Piece, from: Square) {
  const forward = orient(piece.owner, -1);
  const crossedRiver = ["black", "blue", "gote"].includes(piece.owner)
    ? from.row >= Math.floor(state.board.length / 2)
    : from.row < Math.floor(state.board.length / 2);
  const directions: Array<[number, number]> = crossedRiver ? [[forward, 0], [0, -1], [0, 1]] : [[forward, 0]];
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    const to = { row: from.row + dr, col: from.col + dc };
    const target = cellAt(state, to);
    if (target && (!target.piece || target.piece.owner !== piece.owner)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function eastAsianPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  switch (piece.code) {
    case "g":
      return [
        ...steppingMoves(state, piece, from, [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1]
        ]).filter((move) => inPalace(state, piece.owner, move.to)),
        ...flyingGeneralMoves(state, piece, from)
      ];
    case "a":
      return steppingMoves(state, piece, from, [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ]).filter((move) => inPalace(state, piece.owner, move.to));
    case "e":
      return elephantMoves(state, piece, from);
    case "h":
    case "n":
      return horseMoves(state, piece, from);
    case "c":
      return cannonMoves(state, piece, from);
    case "r":
      return rayMoves(state, piece, from, [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]);
    case "p":
      return xiangqiSoldierMoves(state, piece, from);
    default:
      return steppingMoves(state, piece, from, movementDirections(piece.code));
  }
}

function janggiPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  switch (piece.code) {
    case "g":
    case "a":
      return steppingMoves(
        state,
        piece,
        from,
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1]
        ]
      ).filter((move) => inPalace(state, piece.owner, move.to) && isJanggiPalaceLineStep(state, from, move.to));
    case "e":
      return janggiElephantMoves(state, piece, from);
    case "h":
    case "n":
      return horseMoves(state, piece, from);
    case "c":
      return janggiCannonMoves(state, piece, from);
    case "r":
      return [...rayMoves(state, piece, from, [[-1, 0], [1, 0], [0, -1], [0, 1]]), ...janggiPalaceRayMoves(state, piece, from)];
    case "p":
      return janggiSoldierMoves(state, piece, from);
    default:
      return steppingMoves(state, piece, from, movementDirections(piece.code));
  }
}

function janggiSoldierMoves(state: GameState, piece: Piece, from: Square) {
  const forward = orient(piece.owner, -1);
  const moves = steppingMoves(state, piece, from, [
    [forward, 0],
    [0, -1],
    [0, 1],
    [forward, -1],
    [forward, 1]
  ]);
  return moves.filter((move) => {
    if (move.to.row === from.row || move.to.col === from.col) return true;
    return inPalace(state, opponentOf(piece.owner), move.to) && isJanggiPalaceLineStep(state, from, move.to);
  });
}

function janggiElephantMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const candidates = [
    { to: { row: from.row - 3, col: from.col - 2 }, blocks: [{ row: from.row - 1, col: from.col }, { row: from.row - 2, col: from.col - 1 }] },
    { to: { row: from.row - 3, col: from.col + 2 }, blocks: [{ row: from.row - 1, col: from.col }, { row: from.row - 2, col: from.col + 1 }] },
    { to: { row: from.row + 3, col: from.col - 2 }, blocks: [{ row: from.row + 1, col: from.col }, { row: from.row + 2, col: from.col - 1 }] },
    { to: { row: from.row + 3, col: from.col + 2 }, blocks: [{ row: from.row + 1, col: from.col }, { row: from.row + 2, col: from.col + 1 }] },
    { to: { row: from.row - 2, col: from.col - 3 }, blocks: [{ row: from.row, col: from.col - 1 }, { row: from.row - 1, col: from.col - 2 }] },
    { to: { row: from.row + 2, col: from.col - 3 }, blocks: [{ row: from.row, col: from.col - 1 }, { row: from.row + 1, col: from.col - 2 }] },
    { to: { row: from.row - 2, col: from.col + 3 }, blocks: [{ row: from.row, col: from.col + 1 }, { row: from.row - 1, col: from.col + 2 }] },
    { to: { row: from.row + 2, col: from.col + 3 }, blocks: [{ row: from.row, col: from.col + 1 }, { row: from.row + 1, col: from.col + 2 }] }
  ];
  const moves: Move[] = [];

  for (const { to, blocks } of candidates) {
    if (blocks.every((block) => !cellAt(state, block)?.piece) && canOccupy(state, piece, to)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function janggiCannonMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const directions: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    ...janggiPalaceRayDirections(state, from)
  ];
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    let to = { row: from.row + dr, col: from.col + dc };
    let screens = 0;
    while (isInside(state, to) && (dr === 0 || dc === 0 || inAnyJanggiPalace(state, to))) {
      const target = cellAt(state, to)?.piece;
      if (!target) {
        if (screens === 1) moves.push({ from, to: { ...to } });
      } else {
        if (target.code === "c") break;
        screens += 1;
        if (screens > 1) {
          if (target.owner !== piece.owner) moves.push({ from, to: { ...to } });
          break;
        }
      }
      to = { row: to.row + dr, col: to.col + dc };
    }
  }

  return moves;
}

function steppingMoves(state: GameState, piece: Piece, from: Square, directions: Array<[number, number]>) {
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    const to = { row: from.row + dr, col: from.col + dc };
    if (canOccupy(state, piece, to)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function rayMoves(state: GameState, piece: Piece, from: Square, directions: Array<[number, number]>) {
  const moves: Move[] = [];
  for (const [dr, dc] of directions) {
    let to = { row: from.row + dr, col: from.col + dc };
    while (isInside(state, to)) {
      const target = cellAt(state, to)?.piece;
      if (!target) {
        moves.push({ from, to: { ...to } });
      } else {
        if (target.owner !== piece.owner) moves.push({ from, to: { ...to } });
        break;
      }
      to = { row: to.row + dr, col: to.col + dc };
    }
  }
  return moves;
}

function cannonMoves(state: GameState, piece: Piece, from: Square) {
  const moves: Move[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ] satisfies Array<[number, number]>) {
    let to = { row: from.row + dr, col: from.col + dc };
    let screens = 0;
    while (isInside(state, to)) {
      const target = cellAt(state, to)?.piece;
      if (!target && screens === 0) {
        moves.push({ from, to: { ...to } });
      } else if (target) {
        screens += 1;
        if (screens === 2) {
          if (target.owner !== piece.owner) moves.push({ from, to: { ...to } });
          break;
        }
      }
      to = { row: to.row + dr, col: to.col + dc };
    }
  }
  return moves;
}

function horseMoves(state: GameState, piece: Piece, from: Square) {
  const candidates = [
    { to: { row: from.row - 2, col: from.col - 1 }, leg: { row: from.row - 1, col: from.col } },
    { to: { row: from.row - 2, col: from.col + 1 }, leg: { row: from.row - 1, col: from.col } },
    { to: { row: from.row + 2, col: from.col - 1 }, leg: { row: from.row + 1, col: from.col } },
    { to: { row: from.row + 2, col: from.col + 1 }, leg: { row: from.row + 1, col: from.col } },
    { to: { row: from.row - 1, col: from.col - 2 }, leg: { row: from.row, col: from.col - 1 } },
    { to: { row: from.row + 1, col: from.col - 2 }, leg: { row: from.row, col: from.col - 1 } },
    { to: { row: from.row - 1, col: from.col + 2 }, leg: { row: from.row, col: from.col + 1 } },
    { to: { row: from.row + 1, col: from.col + 2 }, leg: { row: from.row, col: from.col + 1 } }
  ];
  const moves: Move[] = [];

  for (const { to, leg } of candidates) {
    if (!cellAt(state, leg)?.piece && canOccupy(state, piece, to)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function elephantMoves(state: GameState, piece: Piece, from: Square) {
  const candidates = [
    { to: { row: from.row - 2, col: from.col - 2 }, eye: { row: from.row - 1, col: from.col - 1 } },
    { to: { row: from.row - 2, col: from.col + 2 }, eye: { row: from.row - 1, col: from.col + 1 } },
    { to: { row: from.row + 2, col: from.col - 2 }, eye: { row: from.row + 1, col: from.col - 1 } },
    { to: { row: from.row + 2, col: from.col + 2 }, eye: { row: from.row + 1, col: from.col + 1 } }
  ];
  const moves: Move[] = [];

  for (const { to, eye } of candidates) {
    if (!cellAt(state, eye)?.piece && canOccupy(state, piece, to) && !crossesXiangqiRiver(piece, to)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function flyingGeneralMoves(state: GameState, piece: Piece, from: Square) {
  const moves: Move[] = [];
  for (const dr of [-1, 1]) {
    let to = { row: from.row + dr, col: from.col };
    while (isInside(state, to)) {
      const target = cellAt(state, to)?.piece;
      if (target) {
        if (target.owner !== piece.owner && isRoyal(target)) moves.push({ from, to: { ...to } });
        break;
      }
      to = { row: to.row + dr, col: to.col };
    }
  }
  return moves;
}

function junglePieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const stepMoves = steppingMoves(state, piece, from, [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ]).filter((move) => canJungleMoveTo(state, piece, from, move.to));

  if (!["l", "t"].includes(piece.code)) return stepMoves;

  return [
    ...stepMoves,
    ...jungleJumpMoves(state, piece, from)
  ];
}

function jungleJumpMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const moves: Move[] = [];
  const directions: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  for (const [dr, dc] of directions) {
    const first = { row: from.row + dr, col: from.col + dc };
    if (!isInside(state, first) || cellAt(state, first)?.terrain !== "river") continue;

    let to = first;
    let blockedByRat = false;
    while (isInside(state, to) && cellAt(state, to)?.terrain === "river") {
      if (cellAt(state, to)?.piece?.code === "r") {
        blockedByRat = true;
        break;
      }
      to = { row: to.row + dr, col: to.col + dc };
    }

    if (!blockedByRat && canJungleMoveTo(state, piece, from, to)) {
      moves.push({ from, to });
    }
  }

  return moves;
}

function canJungleMoveTo(state: GameState, piece: Piece, from: Square, to: Square) {
  const target = cellAt(state, to);
  if (!target || isJungleOwnDen(piece.owner, to)) return false;
  if (target.terrain === "river" && piece.code !== "r") return false;
  if (!target.piece) return true;
  return target.piece.owner !== piece.owner && canJungleCapture(state, piece, from, target.piece, to);
}

function canJungleCapture(state: GameState, attacker: Piece, from: Square, defender: Piece, to: Square) {
  const fromTerrain = cellAt(state, from)?.terrain;
  const toTerrain = cellAt(state, to)?.terrain;
  if (attacker.code === "r" && defender.code === "e" && fromTerrain !== "river" && toTerrain !== "river") return true;
  if (attacker.code === "e" && defender.code === "r") return false;
  if (defender.code === "r" && toTerrain === "river") return attacker.code === "r";

  const defenderRank = isJungleOwnTrap(defender.owner, to) ? 0 : jungleRank(defender.code);
  return jungleRank(attacker.code) >= defenderRank;
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.status !== "active") {
    throw new Error("errors.gameCompleted");
  }

  const legal = move.kind === "pass"
    ? isLegalPassMove(state)
    : move.kind === "drop" && move.drop
      ? getLegalMoves(state, { drop: move.drop }).some((candidate) => sameSquare(candidate.to, move.to))
      : getLegalMoves(state, move.from).some((candidate) => sameSquare(candidate.to, move.to));
  if (!legal) {
    throw new Error("errors.invalidMove");
  }

  const next: GameState = structuredClone(state);
  const toCell = move.kind === "pass" ? null : cellAt(next, move.to);
  const variant = getVariant(state.variantKey);
  if (move.kind !== "pass" && !toCell) throw new Error("errors.invalidMove");

  let movingPiece: Piece;
  let captured: Piece | null = null;

  if (move.kind === "pass") {
    movingPiece = { id: `${state.turn}-pass-${state.ply}`, code: "pass", owner: state.turn, labelKey: "chess.pawn" };
  } else if (move.kind === "drop" && move.drop) {
    movingPiece = { ...move.drop, id: `${move.drop.owner}-${move.drop.code}-drop-${state.ply}-${move.to.row}-${move.to.col}`, promoted: false };
    const hand = next.hands?.[movingPiece.owner];
    if (!hand || (hand[movingPiece.code] ?? 0) <= 0) throw new Error("errors.invalidMove");
    hand[movingPiece.code] -= 1;
    if (hand[movingPiece.code] <= 0) delete hand[movingPiece.code];
    toCell!.piece = movingPiece;
  } else {
    const fromCell = cellAt(next, move.from);
    if (!fromCell?.piece) throw new Error("errors.invalidMove");

    movingPiece = fromCell.piece;
    const jumpedSquare = isDraughtsVariant(variant.key) ? draughtsCapturedSquare(next, move, movingPiece) : null;
    const jumpedCell = jumpedSquare ? cellAt(next, jumpedSquare) : null;
    captured = jumpedCell?.piece ?? toCell!.piece;
    if (captured) {
      next.captured.push(captured);
      if (jumpedCell?.piece) {
        jumpedCell.piece = null;
      } else {
        addCapturedPieceToHand(next, movingPiece.owner, captured);
      }
    }
    const promoted = shouldPromote(variant, movingPiece, move.to, move.promotion);
    toCell!.piece = {
      ...movingPiece,
      code: promoted ? promotionCodeFor(variant, movingPiece) : movingPiece.code,
      promoted: promoted || movingPiece.promoted
    };
    fromCell.piece = null;
    if (variant.supportsCastling && movingPiece.code === "k" && Math.abs(move.to.col - move.from.col) === 2) {
      moveCastlingRook(next, move);
    }
  }

  next.ply += 1;
  next.turn = next.turn === next.clocks[0]?.color ? next.clocks[1]?.color ?? "black" : next.clocks[0]?.color ?? "white";
  next.moves.push({ ...move, notation: notationFor(movingPiece, move) });
  const moverClock = next.clocks.find((clock) => clock.color === movingPiece.owner);
  if (moverClock) {
    moverClock.remainingMs += moverClock.incrementMs;
  }
  next.halfmoveClock = move.kind !== "pass" && (captured || movingPiece.code === "p") ? 0 : (state.halfmoveClock ?? 0) + 1;

  if (variant.key === "horde" && countPieces(next, "white") === 0) {
    next.status = "completed";
    next.result = "black";
    next.outcomeReason = "objective";
    return next;
  }

  if (variant.key === "antichess") {
    return withAntichessOutcome(next);
  }

  if (variant.key === "jungle") {
    return withJungleOutcome(next, movingPiece.owner, move.to);
  }

  if (isDraughtsVariant(variant.key)) {
    return withDraughtsOutcome(next, movingPiece.owner, movingPiece, move, Boolean(captured));
  }

  if (variant.key === "janggi") {
    return withJanggiOutcome(next, movingPiece.owner, move.to);
  }

  if (variant.key === "racing-kings") {
    return withRacingKingsOutcome(next, movingPiece.owner, move.to);
  }

  if (variant.key === "makruk") {
    updateMakrukCounting(next);
  }

  if (variant.key === "chaturanga" || variant.key === "shatranj") {
    return withHistoricalBareKingOutcome(next, movingPiece.owner, move.to);
  }

  if (!variant.supportsCheck && captured && isRoyal(captured)) {
    next.status = "completed";
    next.result = movingPiece.owner;
    next.outcomeReason = "royal-captured";
    return next;
  }
  if (isShogiFamily(variant.key)) {
    return withShogiOutcome(next, movingPiece.owner, move.to);
  }
  return withOutcome(next, movingPiece.owner, move.to);
}

function withHistoricalBareKingOutcome(state: GameState, mover: PlayerColor, destination?: Square): GameState {
  const variant = getVariant(state.variantKey);
  const barePlayers = variant.players.filter((player) => isBareRoyalSide(state, player));
  if (barePlayers.length === variant.players.length) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = "objective";
    return state;
  }
  if (barePlayers.some((player) => player !== mover)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    return state;
  }
  return withOutcome(state, mover, destination);
}

function withAntichessOutcome(state: GameState): GameState {
  const variant = getVariant(state.variantKey);
  const winnerWithNoPieces = variant.players.find((player) => countPieces(state, player) === 0);
  if (winnerWithNoPieces) {
    state.status = "completed";
    state.result = winnerWithNoPieces;
    state.outcomeReason = "lost-all-pieces";
    return state;
  }

  const playerToMove = state.turn;
  if (!hasAnyLegalMove(state, playerToMove)) {
    state.status = "completed";
    state.result = playerToMove;
    state.outcomeReason = "no-legal-moves";
  }

  return state;
}

function withJungleOutcome(state: GameState, mover: PlayerColor, destination: Square): GameState {
  const movedPiece = cellAt(state, destination)?.piece;
  if (movedPiece && isJungleOpponentDen(movedPiece.owner, destination)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    return state;
  }

  const opponent = getVariant(state.variantKey).players.find((player) => player !== mover);
  if (opponent && countPieces(state, opponent) === 0) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
  }

  return state;
}

function withDraughtsOutcome(state: GameState, mover: PlayerColor, movedPieceBeforePromotion: Piece, move: Move, captured: boolean): GameState {
  const opponent = getVariant(state.variantKey).players.find((player) => player !== mover);
  if (!opponent) return state;

  if (countPieces(state, opponent) === 0) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    state.variantState = { ...(state.variantState ?? {}), draughtsContinuation: null };
    return state;
  }

  const movedPiece = cellAt(state, move.to)?.piece;
  const becameKing = movedPieceBeforePromotion.code === "p" && movedPiece?.code === "x";
  if (captured && movedPiece && !becameKing && draughtsMaxCaptureLengthFrom(state, movedPiece, move.to) > 0) {
    state.turn = mover;
    state.variantState = {
      ...(state.variantState ?? {}),
      draughtsContinuation: { row: move.to.row, col: move.to.col, owner: mover }
    };
    return state;
  }

  state.variantState = { ...(state.variantState ?? {}), draughtsContinuation: null };
  if (!hasAnyLegalMove(state, state.turn)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "no-legal-moves";
  }

  return state;
}

function withRacingKingsOutcome(state: GameState, mover: PlayerColor, destination: Square): GameState {
  const movedPiece = cellAt(state, destination)?.piece;
  const blackCanAnswerWhiteReach = state.variantState?.racingKingsWhiteReached === true && mover === "black";
  const moverReachedTarget = movedPiece?.code === "k" && destination.row === 0;

  if (blackCanAnswerWhiteReach) {
    state.status = "completed";
    state.result = moverReachedTarget ? "draw" : "white";
    state.outcomeReason = "objective";
    state.variantState = { ...(state.variantState ?? {}), racingKingsWhiteReached: false };
    return state;
  }

  if (moverReachedTarget && mover === "white") {
    state.variantState = { ...(state.variantState ?? {}), racingKingsWhiteReached: true };
    return state;
  }

  if (moverReachedTarget) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
  }

  return state;
}

function withJanggiOutcome(state: GameState, mover: PlayerColor, destination?: Square): GameState {
  const facedBeforeMove = state.variantState?.bikjangPlayer === mover;
  const generalsFacing = areJanggiGeneralsFacing(state);

  updateJanggiScoring(state);

  if (facedBeforeMove && generalsFacing) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = "draw";
    state.variantState = { ...(state.variantState ?? {}), bikjangPlayer: null };
    return state;
  }

  if (generalsFacing) {
    state.variantState = { ...(state.variantState ?? {}), bikjangPlayer: state.turn };
  } else if (state.variantState?.bikjangPlayer) {
    state.variantState = { ...(state.variantState ?? {}), bikjangPlayer: null };
  }

  if (hasConsecutivePasses(state)) {
    const scoring = readJanggiScoring(state);
    if (scoring) {
      state.status = "completed";
      state.result = scoring.redPoints === scoring.bluePoints ? "draw" : scoring.redPoints > scoring.bluePoints ? "red" : "blue";
      state.outcomeReason = "scoring";
      return state;
    }
  }

  return withOutcome(state, mover, destination);
}

function isLegalPassMove(state: GameState) {
  return state.variantKey === "janggi" && !isInCheck(state, state.turn);
}

function updateJanggiScoring(state: GameState) {
  if (state.variantKey !== "janggi") return;
  state.variantState = { ...(state.variantState ?? {}) };
  state.variantState.janggiScoring = calculateJanggiScoring(state);
}

function calculateJanggiScoring(state: GameState): JanggiScoringState {
  const redPieceCounts: Record<string, number> = {};
  const bluePieceCounts: Record<string, number> = {};
  let redPoints = 0;
  let bluePoints = 0;

  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece) continue;
      const points = janggiPiecePoint(piece.code);
      if (piece.owner === "red") {
        redPoints += points;
        redPieceCounts[piece.code] = (redPieceCounts[piece.code] ?? 0) + 1;
      } else if (piece.owner === "blue") {
        bluePoints += points;
        bluePieceCounts[piece.code] = (bluePieceCounts[piece.code] ?? 0) + 1;
      }
    }
  }

  return { redPoints, bluePoints, redPieceCounts, bluePieceCounts };
}

function readJanggiScoring(state: GameState): JanggiScoringState | undefined {
  const value = state.variantState?.janggiScoring;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<JanggiScoringState>;
  if (typeof candidate.redPoints !== "number" || typeof candidate.bluePoints !== "number") return undefined;
  if (!candidate.redPieceCounts || !candidate.bluePieceCounts) return undefined;
  return candidate as JanggiScoringState;
}

function hasConsecutivePasses(state: GameState) {
  const last = state.moves.at(-1);
  const previous = state.moves.at(-2);
  return last?.kind === "pass" && previous?.kind === "pass";
}

function janggiPiecePoint(code: string) {
  return janggiPiecePoints[code] ?? 0;
}

function updateMakrukCounting(state: GameState) {
  const nextCounting = calculateMakrukCounting(state, readMakrukCounting(state));
  state.variantState = { ...(state.variantState ?? {}) };
  if (nextCounting) {
    state.variantState.makrukCounting = nextCounting;
  } else {
    delete state.variantState.makrukCounting;
  }
}

function calculateMakrukCounting(state: GameState, previous?: MakrukCountingState): MakrukCountingState | null {
  const bareKingCounting = calculateMakrukBareKingCounting(state, previous);
  if (bareKingCounting) return bareKingCounting;

  if (countUnpromotedPawns(state) > 0) return null;
  return continueOrStartMakrukCounting(state, previous?.phase === "board" ? previous : undefined, {
    phase: "board",
    limit: 64,
    pieceCount: countAllPieces(state)
  });
}

function calculateMakrukBareKingCounting(state: GameState, previous?: MakrukCountingState): MakrukCountingState | null {
  const variant = getVariant(state.variantKey);
  const bareKingOwners = variant.players.filter((player) => isBareRoyalSide(state, player));
  if (bareKingOwners.length === variant.players.length) {
    return { phase: "bare-king", startedAtPly: state.ply, remainingMoves: 0, limit: 0, pieceCount: countAllPieces(state) };
  }
  if (bareKingOwners.length !== 1) return null;

  const strongerSide = variant.players.find((player) => player !== bareKingOwners[0]);
  if (!strongerSide) return null;
  const pieceCount = countAllPieces(state);
  const limit = Math.max(makrukBareKingLimit(state, strongerSide) - pieceCount, 1);
  const previousBare = previous?.phase === "bare-king" && previous.strongerSide === strongerSide && previous.limit === limit ? previous : undefined;
  return continueOrStartMakrukCounting(state, previousBare, { phase: "bare-king", limit, strongerSide, pieceCount });
}

function continueOrStartMakrukCounting(
  state: GameState,
  previous: MakrukCountingState | undefined,
  next: Omit<MakrukCountingState, "remainingMoves" | "startedAtPly">
): MakrukCountingState {
  if (!previous) {
    return { ...next, startedAtPly: state.ply, remainingMoves: next.limit };
  }
  return {
    ...next,
    startedAtPly: previous.startedAtPly,
    remainingMoves: Math.max(previous.remainingMoves - 1, 0)
  };
}

function makrukBareKingLimit(state: GameState, strongerSide: PlayerColor) {
  const counts = countMakrukMaterial(state, strongerSide);
  if ((counts.r ?? 0) >= 2) return 8;
  if ((counts.r ?? 0) >= 1) return 16;
  if ((counts.s ?? 0) >= 2) return 22;
  if ((counts.n ?? 0) >= 2) return 32;
  if ((counts.s ?? 0) >= 1) return 44;
  if ((counts.n ?? 0) >= 1) return 64;
  return 64;
}

function readMakrukCounting(state: GameState): MakrukCountingState | undefined {
  const value = state.variantState?.makrukCounting;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<MakrukCountingState>;
  if (candidate.phase !== "board" && candidate.phase !== "bare-king") return undefined;
  if (typeof candidate.startedAtPly !== "number" || typeof candidate.remainingMoves !== "number" || typeof candidate.limit !== "number") return undefined;
  if (typeof candidate.pieceCount !== "number") return undefined;
  return candidate as MakrukCountingState;
}

function withShogiOutcome(state: GameState, mover: PlayerColor, destination: Square): GameState {
  const next = withOutcome(state, mover, destination);
  if (next.status === "completed") return next;

  updateShogiVariantState(next, mover);
  const repetition = readShogiRepetition(next);
  if (repetition && repetition.count >= 4) {
    next.status = "completed";
    next.result = repetition.checker === mover ? opponentOf(mover) : "draw";
    next.outcomeReason = repetition.checker === mover ? "perpetual-check" : "repetition";
    return next;
  }

  const impasse = readShogiImpasse(next);
  if (impasse?.senteKingEntered && impasse.goteKingEntered) {
    next.status = "completed";
    if (impasse.sentePoints >= 24 && impasse.gotePoints >= 24) {
      next.result = "draw";
    } else if (impasse.sentePoints >= 24) {
      next.result = "sente";
    } else if (impasse.gotePoints >= 24) {
      next.result = "gote";
    } else {
      next.result = "draw";
    }
    next.outcomeReason = "impasse";
  }

  return next;
}

function updateShogiVariantState(state: GameState, mover: PlayerColor) {
  const key = shogiPositionKey(state);
  const previous = readShogiRepetition(state);
  const occurrences = { ...(previous?.occurrences ?? {}) };
  const count = (occurrences[key] ?? 0) + 1;
  occurrences[key] = count;
  const defender = state.turn;
  const checker = isInCheck(state, defender) ? mover : null;

  state.variantState = { ...(state.variantState ?? {}) };
  state.variantState.shogiRepetition = { key, count, occurrences, checker } satisfies ShogiRepetitionState;
  state.variantState.shogiImpasse = calculateShogiImpasse(state);
}

function shogiPositionKey(state: GameState) {
  const boardParts: string[] = [];
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (piece) {
        boardParts.push(`${cell.square.row},${cell.square.col}:${piece.owner}:${piece.code}:${piece.promoted ? 1 : 0}`);
      }
    }
  }
  const board = boardParts.join("|");
  const hands = ["sente", "gote"]
    .map((owner) => {
      const hand = state.hands?.[owner as PlayerColor] ?? {};
      const pieces = Object.entries(hand)
        .filter(([, count]) => count > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, count]) => `${code}${count}`)
        .join(",");
      return `${owner}:${pieces}`;
    })
    .join("|");
  return `${state.variantKey};turn=${state.turn};board=${board};hands=${hands}`;
}

function readShogiRepetition(state: GameState): ShogiRepetitionState | undefined {
  const value = state.variantState?.shogiRepetition;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ShogiRepetitionState>;
  if (typeof candidate.key !== "string" || typeof candidate.count !== "number" || typeof candidate.occurrences !== "object") return undefined;
  return candidate as ShogiRepetitionState;
}

function calculateShogiImpasse(state: GameState): ShogiImpasseState {
  return {
    sentePoints: countShogiMaterialPoints(state, "sente"),
    gotePoints: countShogiMaterialPoints(state, "gote"),
    senteKingEntered: isShogiKingEntered(state, "sente"),
    goteKingEntered: isShogiKingEntered(state, "gote")
  };
}

function readShogiImpasse(state: GameState): ShogiImpasseState | undefined {
  const value = state.variantState?.shogiImpasse;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ShogiImpasseState>;
  if (
    typeof candidate.sentePoints !== "number" ||
    typeof candidate.gotePoints !== "number" ||
    typeof candidate.senteKingEntered !== "boolean" ||
    typeof candidate.goteKingEntered !== "boolean"
  ) {
    return undefined;
  }
  return candidate as ShogiImpasseState;
}

function isShogiKingEntered(state: GameState, owner: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === owner && cell.piece.code === "k") {
        return owner === "sente" ? cell.square.row <= 2 : cell.square.row >= state.board.length - 3;
      }
    }
  }
  return false;
}

function countShogiMaterialPoints(state: GameState, owner: PlayerColor) {
  let points = 0;
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece || piece.owner !== owner) continue;
      points += shogiPiecePoint(piece.code);
    }
  }
  const hand = state.hands?.[owner] ?? {};
  for (const [code, count] of Object.entries(hand)) {
    points += shogiPiecePoint(code) * count;
  }
  return points;
}

function shogiPiecePoint(code: string) {
  if (code === "k") return 0;
  if (code === "r" || code === "b") return 5;
  return 1;
}

function withOutcome(state: GameState, mover: PlayerColor, destination?: Square): GameState {
  const variant = getVariant(state.variantKey);
  const movedPiece = destination ? cellAt(state, destination)?.piece : null;

  if (variant.key === "king-of-the-hill" && destination && movedPiece && isRoyal(movedPiece) && isCenterSquare(state, destination)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    return state;
  }

  if (!variant.supportsCheck) return state;

  const drawReason = drawReasonFor(state);
  if (drawReason) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = drawReason;
    return state;
  }

  const defender = state.turn;
  const defenderInCheck = isInCheck(state, defender);
  if (defenderInCheck) {
    state.checks[defender] = (state.checks[defender] ?? 0) + 1;
    if (variant.key === "three-check" && (state.checks[defender] ?? 0) >= 3) {
      state.status = "completed";
      state.result = mover;
      state.outcomeReason = "three-check";
      return state;
    }
  }

  if (!hasAnyLegalMove(state, defender)) {
    state.status = "completed";
    state.result = defenderInCheck || variant.key === "xiangqi" ? mover : "draw";
    state.outcomeReason = defenderInCheck ? "checkmate" : state.result === "draw" ? "stalemate" : "no-legal-moves";
  }

  return state;
}

function drawReasonFor(state: GameState): "insufficient-material" | "fifty-move" | "counting-rule" | null {
  const variant = getVariant(state.variantKey);
  const makrukCounting = variant.key === "makruk" ? readMakrukCounting(state) : undefined;
  if (makrukCounting && makrukCounting.remainingMoves <= 0) return "counting-rule";
  if (variant.family === "western" && state.halfmoveClock >= 100) return "fifty-move";
  if (!["classic", "chess960", "king-of-the-hill", "three-check"].includes(variant.key)) return null;

  const royalOwners = new Set<PlayerColor>();
  let hasNonRoyal = false;

  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece) continue;
      if (isRoyal(piece)) {
        royalOwners.add(piece.owner);
      } else {
        hasNonRoyal = true;
      }
    }
  }

  if (!hasNonRoyal && variant.players.every((player) => royalOwners.has(player))) {
    return "insufficient-material";
  }

  return null;
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

function canOccupy(state: GameState, piece: Piece, to: Square) {
  const target = cellAt(state, to);
  return Boolean(target && (!target.piece || target.piece.owner !== piece.owner));
}

function inPalace(state: GameState, owner: PlayerColor, square: Square) {
  if (!isInside(state, square) || square.col < 3 || square.col > 5) return false;
  const topSide = ["black", "blue", "gote"].includes(owner);
  return topSide ? square.row >= 0 && square.row <= 2 : square.row >= state.board.length - 3 && square.row < state.board.length;
}

function opponentOf(owner: PlayerColor): PlayerColor {
  if (owner === "white") return "black";
  if (owner === "black") return "white";
  if (owner === "red") return "blue";
  if (owner === "blue") return "red";
  if (owner === "sente") return "gote";
  return "sente";
}

function inAnyJanggiPalace(state: GameState, square: Square) {
  return square.col >= 3 && square.col <= 5 && ((square.row >= 0 && square.row <= 2) || (square.row >= state.board.length - 3 && square.row < state.board.length));
}

function janggiPalaceCenterRow(state: GameState, square: Square) {
  if (square.row <= 2) return 1;
  if (square.row >= state.board.length - 3) return state.board.length - 2;
  return null;
}

function isJanggiPalaceCenter(state: GameState, square: Square) {
  return square.col === 4 && square.row === janggiPalaceCenterRow(state, square);
}

function isJanggiPalaceLineStep(state: GameState, from: Square, to: Square) {
  if (!inAnyJanggiPalace(state, from) || !inAnyJanggiPalace(state, to)) return false;
  if (janggiPalaceCenterRow(state, from) !== janggiPalaceCenterRow(state, to)) return false;
  const dr = Math.abs(from.row - to.row);
  const dc = Math.abs(from.col - to.col);
  if (dr + dc === 1) return true;
  return dr === 1 && dc === 1 && (isJanggiPalaceCenter(state, from) || isJanggiPalaceCenter(state, to));
}

function janggiPalaceRayDirections(state: GameState, from: Square): Array<[number, number]> {
  if (!inAnyJanggiPalace(state, from)) return [];
  const centerRow = janggiPalaceCenterRow(state, from);
  if (centerRow === null) return [];
  if (isJanggiPalaceCenter(state, from)) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];
  }
  if (from.col === 4) return [];
  const rowDirection = from.row < centerRow ? 1 : -1;
  const colDirection = from.col < 4 ? 1 : -1;
  return [[rowDirection, colDirection]];
}

function janggiPalaceRayMoves(state: GameState, piece: Piece, from: Square) {
  const moves: Move[] = [];
  for (const [dr, dc] of janggiPalaceRayDirections(state, from)) {
    let to = { row: from.row + dr, col: from.col + dc };
    while (isInside(state, to) && inAnyJanggiPalace(state, to)) {
      const target = cellAt(state, to)?.piece;
      if (!target) {
        moves.push({ from, to: { ...to } });
      } else {
        if (target.owner !== piece.owner) moves.push({ from, to: { ...to } });
        break;
      }
      to = { row: to.row + dr, col: to.col + dc };
    }
  }
  return moves;
}

function crossesXiangqiRiver(piece: Piece, to: Square) {
  if (!["red", "black"].includes(piece.owner)) return false;
  return piece.owner === "red" ? to.row < 5 : to.row > 4;
}

function castlingMoves(state: GameState, from: Square, king: Piece) {
  const variant = getVariant(state.variantKey);
  if (!variant.supportsCastling || from.col !== 4 || hasMovedFrom(state, from) || isInCheck(state, king.owner)) return [];

  const row = from.row;
  const candidates = [
    { rookFrom: { row, col: 7 }, through: [{ row, col: 5 }, { row, col: 6 }], to: { row, col: 6 } },
    { rookFrom: { row, col: 0 }, through: [{ row, col: 3 }, { row, col: 2 }], to: { row, col: 2 }, empty: [{ row, col: 1 }] }
  ];
  const moves: Move[] = [];

  for (const { rookFrom, through, to, empty = [] } of candidates) {
    const rook = cellAt(state, rookFrom)?.piece;
    if (!rook || rook.owner !== king.owner || rook.code !== "r" || hasMovedFrom(state, rookFrom)) continue;
    if (through.some((square) => cellAt(state, square)?.piece) || empty.some((square) => cellAt(state, square)?.piece)) continue;
    if (through.some((square) => variant.players.some((player) => player !== king.owner && isSquareAttacked(state, square, player)))) continue;
    moves.push({ from, to });
  }

  return moves;
}

function hasMovedFrom(state: GameState, square: Square) {
  return state.moves.some((move) => sameSquare(move.from, square));
}

function shouldPromote(variant: VariantDefinition, piece: Piece, to: Square, requested?: boolean) {
  if (!variant.supportsPromotion || piece.code !== "p") return false;
  if (isDraughtsVariant(variant.key)) {
    return shouldCrownDraughtsMan(variant, piece, to);
  }
  if (variant.key === "makruk") {
    return piece.owner === "white" ? to.row <= 2 : to.row >= variant.board.rows - 3;
  }
  if (variant.family === "western") {
    return to.row === 0 || to.row === variant.board.rows - 1;
  }
  return Boolean(requested);
}

function isShogiFamily(variantKey: string) {
  return variantKey === "shogi" || variantKey === "mini-shogi";
}

function promotionCodeFor(variant: VariantDefinition, piece: Piece) {
  if (isDraughtsVariant(variant.key) && piece.code === "p") return "x";
  if (variant.key === "chaturanga" && piece.code === "p") return "m";
  if (variant.key === "shatranj" && piece.code === "p") return "f";
  if (variant.family === "western" && piece.code === "p") return "q";
  if (variant.key === "makruk" && piece.code === "p") return "m";
  return piece.code;
}

function moveCastlingRook(state: GameState, kingMove: Move) {
  const row = kingMove.from.row;
  const kingSide = kingMove.to.col > kingMove.from.col;
  const rookFrom = { row, col: kingSide ? 7 : 0 };
  const rookTo = { row, col: kingSide ? 5 : 3 };
  const fromCell = cellAt(state, rookFrom);
  const toCell = cellAt(state, rookTo);
  if (!fromCell?.piece || !toCell) return;
  toCell.piece = fromCell.piece;
  fromCell.piece = null;
}

function wouldLeaveRoyalInCheck(state: GameState, move: Move, owner: PlayerColor) {
  const next: GameState = structuredClone(state);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  if (!fromCell?.piece || !toCell) return true;
  toCell.piece = { ...fromCell.piece, promoted: move.promotion || fromCell.piece.promoted };
  fromCell.piece = null;
  return isInCheck(next, owner);
}

function wouldGiveRoyalCheck(state: GameState, move: Move, owner: PlayerColor) {
  const next: GameState = structuredClone(state);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  if (!fromCell?.piece || !toCell) return true;
  toCell.piece = { ...fromCell.piece, promoted: move.promotion || fromCell.piece.promoted };
  fromCell.piece = null;
  return isInCheck(next, opponentOf(owner));
}

function wouldDropLeaveRoyalInCheck(state: GameState, move: Move, owner: PlayerColor) {
  if (!move.drop) return true;
  const next: GameState = structuredClone(state);
  const toCell = cellAt(next, move.to);
  if (!toCell || toCell.piece) return true;
  toCell.piece = { ...move.drop, promoted: false };
  return isInCheck(next, owner);
}

function isInCheck(state: GameState, color: PlayerColor) {
  const royal = findRoyal(state, color);
  if (!royal) return false;
  const attackers = getVariant(state.variantKey).players.filter((player) => player !== color);
  return attackers.some((attacker) => isSquareAttacked(state, royal.square, attacker));
}

function isSquareAttacked(state: GameState, square: Square, byColor: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner !== byColor) continue;
      if (getPseudoLegalMoves(state, cell.square).some((move) => sameSquare(move.to, square))) {
        return true;
      }
    }
  }
  return false;
}

function findRoyal(state: GameState, color: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === color && isRoyal(cell.piece)) return cell;
    }
  }
  return null;
}

function areJanggiGeneralsFacing(state: GameState) {
  const redGeneral = findRoyal(state, "red");
  const blueGeneral = findRoyal(state, "blue");
  if (!redGeneral || !blueGeneral || redGeneral.square.col !== blueGeneral.square.col) return false;

  const [start, end] = [redGeneral.square.row, blueGeneral.square.row].sort((a, b) => a - b);
  for (let row = start + 1; row < end; row += 1) {
    if (state.board[row]?.[redGeneral.square.col]?.piece) return false;
  }
  return true;
}

function hasAnyLegalMove(state: GameState, color: PlayerColor, options: DropMoveOptions = {}) {
  if (state.turn !== color) return false;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === color && getLegalMoves(state, cell.square).length > 0) {
        return true;
      }
    }
  }
  const hand = state.hands?.[color];
  if (hand) {
    for (const [code, count] of Object.entries(hand)) {
      if (count > 0 && getLegalDropMoves(state, { id: `${color}-${code}-hand`, code, owner: color, labelKey: pieceLabels[code] ?? "chess.pawn" }, options).length > 0) {
        return true;
      }
    }
  }
  return false;
}

function hasAnyCaptureMove(state: GameState, color: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner !== color) continue;
      if (getPseudoLegalMoves(state, cell.square).some((move) => isCaptureMove(state, move))) {
        return true;
      }
    }
  }
  return false;
}

function isCaptureMove(state: GameState, move: Move) {
  const movingPiece = cellAt(state, move.from)?.piece;
  const targetPiece = cellAt(state, move.to)?.piece;
  return Boolean(movingPiece && targetPiece && targetPiece.owner !== movingPiece.owner);
}

function countPieces(state: GameState, owner: PlayerColor) {
  let count = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === owner) count += 1;
    }
  }
  return count;
}

function countAllPieces(state: GameState) {
  let count = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece) count += 1;
    }
  }
  return count;
}

function countUnpromotedPawns(state: GameState) {
  let count = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.code === "p" && !cell.piece.promoted) count += 1;
    }
  }
  return count;
}

function countMakrukMaterial(state: GameState, owner: PlayerColor) {
  const counts: Record<string, number> = {};
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece || piece.owner !== owner || piece.code === "k") continue;
      counts[piece.code] = (counts[piece.code] ?? 0) + 1;
    }
  }
  return counts;
}

function isBareRoyalSide(state: GameState, owner: PlayerColor) {
  let royalCount = 0;
  let nonRoyalCount = 0;
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (piece?.owner !== owner) continue;
      if (isRoyal(piece)) {
        royalCount += 1;
      } else {
        nonRoyalCount += 1;
      }
    }
  }
  return royalCount === 1 && nonRoyalCount === 0;
}

function addCapturedPieceToHand(state: GameState, owner: PlayerColor, captured: Piece) {
  const variant = getVariant(state.variantKey);
  if (!variant.supportsDrops) return;
  state.hands ??= {};
  state.hands[owner] ??= {};
  const code = variant.key === "crazyhouse" && captured.promoted ? "p" : captured.code.toLowerCase();
  state.hands[owner][code] = (state.hands[owner][code] ?? 0) + 1;
}

function isRoyal(piece: Piece) {
  return piece.code === "k" || piece.code === "g";
}

function isCenterSquare(state: GameState, square: Square) {
  const centerRows = state.board.length % 2 === 0 ? [state.board.length / 2 - 1, state.board.length / 2] : [Math.floor(state.board.length / 2)];
  const width = state.board[0]?.length ?? 0;
  const centerCols = width % 2 === 0 ? [width / 2 - 1, width / 2] : [Math.floor(width / 2)];
  return centerRows.includes(square.row) && centerCols.includes(square.col);
}

function jungleRank(code: string) {
  return ({ r: 1, c: 2, d: 3, w: 4, p: 5, t: 6, l: 7, e: 8 } as Record<string, number>)[code] ?? 0;
}

function isJungleOwnDen(owner: PlayerColor, square: Square) {
  return owner === "white" ? square.row === 8 && square.col === 3 : owner === "black" && square.row === 0 && square.col === 3;
}

function isJungleOpponentDen(owner: PlayerColor, square: Square) {
  return owner === "white" ? square.row === 0 && square.col === 3 : owner === "black" && square.row === 8 && square.col === 3;
}

function isJungleOwnTrap(owner: PlayerColor, square: Square) {
  if (![2, 3, 4].includes(square.col)) return false;
  return owner === "white" ? square.row >= 7 : owner === "black" && square.row <= 1;
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
  if (variant.key === "mini-shogi") {
    return square.row === 0 || square.row === variant.board.rows - 1 ? "promotion-zone" : "land";
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
  if (state.variantKey === "jungle") {
    if (isJungleOwnDen(piece.owner, to)) return false;
    if (target.terrain === "river" && piece.code !== "r") return false;
    return true;
  }
  if (target.terrain === "river" && piece.code !== "r") return false;
  if (target.terrain === "den" && piece.owner === state.turn) return false;
  return true;
}

function notationFor(piece: Piece | null, move: Move) {
  if (move.kind === "pass") return "pass";
  const label = piece?.code.toUpperCase() ?? "?";
  if (move.kind === "drop") return `${label}*${move.to.row},${move.to.col}`;
  return `${label}${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
}
