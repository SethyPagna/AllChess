import { getVariant } from "./catalog";
import { advanceOukCount, settleOukCount } from "./ouk-counting";
import { advanceMakrukHonorCount, settleMakrukHonorCount, usesMakrukHonorCount } from "./makruk-counting";
import { usesKonaneNpsRules } from "./konane-profile";
import { jungleRank, jungleTerrain, jungleTrapOwner, usesJungleStandardRules } from "./jungle-profile";
import { chess960BackRank, chess960IndexForId, readChess960BackRank, withChess960BackRank } from "./chess960";
import { isInsufficientMaterialDraw } from "./mating-material";
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
  /** The mover when the latest move gave check, otherwise null. */
  checker: PlayerColor | null;
  /** Ply at which each position first occurred, keyed by positionDigest(key). Older saves lack it. */
  firstPly?: Record<string, number>;
  /** Ply of each side's latest move that did not give check. Older saves lack it. */
  lastQuietPly?: Partial<Record<PlayerColor, number>>;
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
    turn: variant.key === "janggi" ? "blue" : variant.key === "konane" ? "black" : variant.players[0],
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
  if (variant.key === "janggi") state.variantState = { janggiProfile: "cho-first-v1" };
  if (variant.key === "makruk") state.variantState = { makrukProfile: "honor-v1" };
  if (variant.key === "konane") state.variantState = { konaneProfile: "nps-v1" };
  if (variant.key === "jungle") state.variantState = { jungleProfile: "standard-v1" };
  if (variant.key === "horde") state.variantState = { hordeProfile: "lichess-v1" };
  if (variant.supportsDrops) {
    state.hands = Object.fromEntries(variant.players.map((player) => [player, {}])) as GameState["hands"];
  }
  // Chess960 "random-v1": the back rank is derived from the game id, so the same id
  // always rebuilds the same setup. The chosen rank is recorded in variantState.
  if (variant.key === "chess960") return withChess960BackRank(state, chess960BackRank(chess960IndexForId(id)));
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
  const pseudoMoves = getPseudoLegalMoves(state, from);

  let legalMoves = pseudoMoves.filter((move) => {
    const target = cellAt(state, move.to)?.piece;
    if (variant.supportsCheck && target && isRoyal(target, variant.key)) return false;
    if (!variant.supportsCheck) return true;
    if (variant.key === "racing-kings" && wouldGiveRoyalCheck(state, move, cell.piece!.owner)) return false;
    return !wouldLeaveRoyalInCheck(state, move, cell.piece!.owner);
  });

  if (variant.supportsCastling && cell.piece.code === "k") {
    // Castling runs its own king-safety probes (origin, path and final position).
    legalMoves.push(...castlingOptions(state, from, cell.piece).map((option) => option.move));
  }

  if (isShogiFamily(variant.key)) {
    legalMoves = withShogiPromotionChoices(variant, cell.piece, from, legalMoves);
  }
  if (cell.piece.code === "p" && westernPromotionChoices(variant).length) {
    legalMoves = withWesternPromotionChoices(variant, cell.piece, legalMoves);
  }

  if (variant.key === "antichess" && hasAnyCaptureMove(state, state.turn)) {
    return legalMoves.filter((move) => isCaptureMove(state, move));
  }
  if (isDraughtsVariant(variant.key)) {
    const continuation = draughtsContinuationFor(state);
    if (continuation && (!sameSquare(from, continuation.square) || continuation.owner !== state.turn)) return [];
    const requiredCaptures = draughtsRequiredCaptureLength(state, state.turn, continuation?.square);
    if (requiredCaptures > 0) {
      // Capturing is compulsory everywhere, but English draughts leaves the choice among captures free (no majority rule).
      return variant.key === "english-draughts"
        ? legalMoves.filter((move) => draughtsCapturedSquare(state, move, cell.piece!) !== null)
        : legalMoves.filter((move) => draughtsCaptureLengthForMove(state, move) === requiredCaptures);
    }
  }
  if (variant.key === "konane" && !usesKonaneNpsRules(state)) {
    const continuation = konaneContinuationFor(state);
    if (continuation && (!sameSquare(from, continuation.square) || continuation.owner !== state.turn)) return [];
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
  if (variant.key === "ouk-chaktrang") return oukPieceMoves(state, piece, from).filter((move) => terrainAllows(state, piece, move.to));
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
  if (variant.key === "konane") {
    return konanePieceMoves(state, piece, from);
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

// Opening leaps never attack occupied squares. Keep them out of check detection to
// avoid recursion while using the ordinary Cambodian movement for attacks.
function oukPieceMoves(state: GameState, piece: Piece, from: Square): Move[] {
  const moves = makrukPieceMoves(state, piece, from);
  if (piece.promoted || !["k", "m"].includes(piece.code)) return moves;
  const homeRow = piece.owner === "white" ? 7 : 0;
  const homeCol = piece.code === "k" ? (piece.owner === "white" ? 3 : 4) : (piece.owner === "white" ? 4 : 3);
  if (from.row !== homeRow || from.col !== homeCol || hasMovedFrom(state, from)) return moves;
  const used = (state.variantState?.oukLeapUsed ?? {}) as Record<string, boolean>;
  if (used[piece.owner + piece.code]) return moves;
  if (piece.code === "k" && (oukRookAligned(state, piece.owner) || isInCheck(state, piece.owner))) return moves;
  const forward = orient(piece.owner, -1);
  const targets = piece.code === "k" ? [{ row: from.row + forward, col: from.col - 2 }, { row: from.row + forward, col: from.col + 2 }] : [{ row: from.row + forward * 2, col: from.col }];
  for (const to of targets) if (cellAt(state, to) && !cellAt(state, to)?.piece) moves.push({ from, to });
  return moves;
}

function oukRookAligned(state: GameState, owner: PlayerColor) {
  const king = findRoyal(state, owner);
  return Boolean(king && state.board.flat().some(cell => cell.piece?.code === "r" && cell.piece.owner !== owner && (cell.square.row === king.square.row || cell.square.col === king.square.col)));
}

function updateOukLeapRights(state: GameState, piece: Piece) {
  const used = { ...(state.variantState?.oukLeapUsed as Record<string, boolean> ?? {}) };
  if (!piece.promoted && ["k", "m"].includes(piece.code)) used[piece.owner + piece.code] = true;
  for (const owner of getVariant(state.variantKey).players) if (oukRookAligned(state, owner)) used[owner + "k"] = true;
  state.variantState = { ...state.variantState, oukLeapUsed: used };
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
    const hordeFirstRank = state.variantKey === "horde" && piece.owner === "white" && from.row === state.board.length - 1;
    const two = { row: from.row + forward * 2, col: from.col };
    if (allowDouble && (from.row === startRow || hordeFirstRank) && isInside(state, two) && !cellAt(state, two)?.piece) {
      moves.push({ from, to: two });
    }
  }

  for (const dc of [-1, 1]) {
    const capture = { row: from.row + forward, col: from.col + dc };
    const target = cellAt(state, capture);
    if ((target?.piece && target.piece.owner !== piece.owner) || (allowDouble && enPassantCapturedSquare(state, { from, to: capture }))) {
      moves.push({ from, to: capture });
    }
  }

  return moves;
}

function enPassantCapturedSquare(state: GameState, move: Move): Square | null {
  if (getVariant(state.variantKey).family !== "western" || (move.kind && move.kind !== "move")) return null;
  const pawn = cellAt(state, move.from)?.piece, last = state.moves.at(-1);
  if (pawn?.code !== "p" || pawn.promoted || !last || (last.kind && last.kind !== "move") || cellAt(state, move.to)?.piece) return null;
  const forward = orient(pawn.owner, -1);
  if (move.to.row !== move.from.row + forward || Math.abs(move.to.col - move.from.col) !== 1 || !isInside(state, move.to)) return null;
  const captured = cellAt(state, last.to)?.piece;
  if (captured?.code !== "p" || captured.promoted || captured.owner === pawn.owner) return null;
  const originalRow = captured.owner === "black" ? 1 : state.board.length - 2;
  // Horde first-rank double steps are deliberately not en-passant eligible.
  if (last.from.row !== originalRow || last.from.col !== last.to.col || last.to.row - last.from.row !== orient(captured.owner, -2)) return null;
  return last.to.row === move.from.row && last.to.col === move.to.col && move.to.row === (last.from.row + last.to.row) / 2 ? last.to : null;
}

function draughtsPieceMoves(state: GameState, piece: Piece, from: Square) {
  return [...draughtsQuietMoves(state, piece, from), ...draughtsCaptureMoves(state, piece, from, draughtsTrailAt(state, from))];
}

function draughtsQuietMoves(state: GameState, piece: Piece, from: Square) {
  if (state.variantKey === "turkish-draughts" && piece.code === "x") {
    return flyingDraughtsKingQuietMoves(state, from, draughtsAllOrthogonalDirections);
  }
  if (state.variantKey === "international-draughts" && piece.code === "x") {
    return flyingDraughtsKingQuietMoves(state, from, draughtsAllDiagonalDirections);
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

/** A flying king slides over empty squares only; it takes a piece by jumping it, never by landing on it. */
function flyingDraughtsKingQuietMoves(state: GameState, from: Square, directions: Array<[number, number]>) {
  const moves: Move[] = [];
  for (const [dr, dc] of directions) {
    for (let to = { row: from.row + dr, col: from.col + dc }; isInside(state, to) && !cellAt(state, to)?.piece; to = { row: to.row + dr, col: to.col + dc }) {
      moves.push({ from, to });
    }
  }
  return moves;
}

function draughtsCaptureMoves(state: GameState, piece: Piece, from: Square, trail: DraughtsTrail) {
  if (state.variantKey === "turkish-draughts" && piece.code === "x") {
    return turkishDraughtsKingCaptures(state, piece, from, trail);
  }
  if (state.variantKey === "international-draughts" && piece.code === "x") {
    return internationalDraughtsKingCaptures(state, piece, from, trail);
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
  // Turkish men capture forward or sideways, never backward.
  if (variantKey === "turkish-draughts") return draughtsQuietDirections(piece, variantKey);
  if (variantKey === "international-draughts" || piece.code === "x") return draughtsAllDiagonalDirections;
  return draughtsQuietDirections(piece, variantKey);
}

function internationalDraughtsKingCaptures(state: GameState, piece: Piece, from: Square, trail: DraughtsTrail) {
  return flyingDraughtsKingCaptures(state, piece, from, draughtsAllDiagonalDirections, trail.taken);
}

function turkishDraughtsKingCaptures(state: GameState, piece: Piece, from: Square, trail: DraughtsTrail) {
  // A Turkish king may not turn 180 degrees between two captures.
  const heading = trail.heading;
  const directions = heading ? draughtsAllOrthogonalDirections.filter(([dr, dc]) => dr !== -heading.row || dc !== -heading.col) : draughtsAllOrthogonalDirections;
  return flyingDraughtsKingCaptures(state, piece, from, directions, trail.taken);
}

function flyingDraughtsKingCaptures(state: GameState, piece: Piece, from: Square, directions: Array<[number, number]>, taken: Square[]) {
  const moves: Move[] = [];

  for (const [dr, dc] of directions) {
    let square = { row: from.row + dr, col: from.col + dc };
    let jumpedEnemy: Piece | null = null;
    while (isInside(state, square)) {
      // A piece already taken in this sequence stays in the way and cannot be jumped again.
      if (taken.some((takenSquare) => sameSquare(takenSquare, square))) break;
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
      longest = Math.max(longest, draughtsMaxCaptureLengthFrom(state, cell.piece, cell.square, draughtsTrailAt(state, cell.square)));
    }
  }
  return longest;
}

function draughtsCaptureLengthForMove(state: GameState, move: Move) {
  const piece = cellAt(state, move.from)?.piece;
  return piece ? draughtsCaptureLength(state, move, piece, draughtsTrailAt(state, move.from)) : 0;
}

function draughtsMaxCaptureLengthFrom(state: GameState, piece: Piece, from: Square, trail: DraughtsTrail): number {
  const captures = draughtsCaptureMoves(state, piece, from, trail);
  if (captures.length === 0) return 0;
  return Math.max(...captures.map((move) => draughtsCaptureLength(state, move, piece, trail)));
}

/** Pieces taken by `move` plus the longest sequence the same piece must continue with. */
function draughtsCaptureLength(state: GameState, move: Move, piece: Piece, trail: DraughtsTrail): number {
  const capturedSquare = draughtsCapturedSquare(state, move, piece);
  if (!capturedSquare) return 0;
  if (draughtsCrowningEndsCapture(state.variantKey, piece, move.to)) return 1;
  const next = draughtsStateAfterCapture(state, move, piece, capturedSquare);
  return 1 + draughtsMaxCaptureLengthFrom(next, piece, move.to, draughtsTrailAfter(state.variantKey, trail, move, capturedSquare));
}

/**
 * English men are crowned, and their move ends, on reaching the far row. International (FMJD) and
 * Turkish (MindSports) men only pass it mid-capture and are crowned where the capture ends. Kings never stop.
 */
function draughtsCrowningEndsCapture(variantKey: string, piece: Piece, to: Square) {
  return variantKey === "english-draughts" && piece.code === "p" && shouldCrownDraughtsMan(getVariant(variantKey), piece, to);
}

/**
 * What an unfinished capture sequence restricts. International (FMJD) removes taken pieces only
 * when the sequence ends, so their squares block the rest of it and cannot be jumped again (the
 * engine lifts them at once and blocks their squares instead). Turkish removes them as they are
 * jumped, but a king may not reverse the direction (`heading`) of its last jump.
 */
type DraughtsTrail = { taken: Square[]; heading: Square | null };

const freshDraughtsTrail: DraughtsTrail = { taken: [], heading: null };

function draughtsTrailAt(state: GameState, from: Square): DraughtsTrail {
  const continuation = draughtsContinuationFor(state);
  return continuation && sameSquare(continuation.square, from) ? continuation.trail : freshDraughtsTrail;
}

function draughtsTrailAfter(variantKey: string, trail: DraughtsTrail, move: Move, capturedSquare: Square): DraughtsTrail {
  return {
    taken: variantKey === "international-draughts" ? [...trail.taken, capturedSquare] : [],
    heading: { row: Math.sign(move.to.row - move.from.row), col: Math.sign(move.to.col - move.from.col) }
  };
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

function draughtsContinuationFor(state: GameState): { square: Square; owner: PlayerColor; trail: DraughtsTrail } | null {
  const value = state.variantState?.draughtsContinuation;
  if (!value || typeof value !== "object") return null;
  const candidate = value as { row?: unknown; col?: unknown; owner?: unknown; taken?: unknown; heading?: unknown };
  if (typeof candidate.row !== "number" || typeof candidate.col !== "number") return null;
  if (candidate.owner !== "white" && candidate.owner !== "black") return null;
  // Continuations saved before the trail was recorded carry on without its restrictions.
  const trail: DraughtsTrail = {
    taken: Array.isArray(candidate.taken) ? candidate.taken.filter(isSquareValue) : [],
    heading: isSquareValue(candidate.heading) ? candidate.heading : null
  };
  return { square: { row: candidate.row, col: candidate.col }, owner: candidate.owner, trail };
}

function isSquareValue(value: unknown): value is Square {
  return typeof value === "object" && value !== null && typeof (value as Square).row === "number" && typeof (value as Square).col === "number";
}

function isDraughtsVariant(variantKey: string) {
  return variantKey === "english-draughts" || variantKey === "international-draughts" || variantKey === "turkish-draughts";
}

function konanePieceMoves(state: GameState, piece: Piece, from: Square) {
  const openingMoves = konaneOpeningRemovalMoves(state, piece, from);
  if (openingMoves.length > 0 || isKonaneOpeningRemovalPhase(state)) return openingMoves;
  return konaneJumpMoves(state, piece, from);
}

function konaneOpeningRemovalMoves(state: GameState, piece: Piece, from: Square) {
  const opening = readKonaneOpening(state);
  if (opening.removals >= 2) return [];
  if (piece.owner !== state.turn) return [];
  if (opening.removals === 0 || usesKonaneNpsRules(state)) return [{ kind: "remove" as const, from, to: from }];
  if (opening.firstRemoved && isOrthogonallyAdjacent(from, opening.firstRemoved)) {
    return [{ kind: "remove" as const, from, to: from }];
  }
  return [];
}

function konaneJumpMoves(state: GameState, piece: Piece, from: Square) {
  const moves: Move[] = [];
  for (const [dr, dc] of draughtsAllOrthogonalDirections) {
    for (let steps = 2; ; steps += 2) {
      const middle = { row: from.row + dr * (steps-1), col: from.col + dc * (steps-1) };
      const to = { row: from.row + dr * steps, col: from.col + dc * steps };
      const jumped = cellAt(state, middle)?.piece;
      if (!isInside(state, to) || cellAt(state, to)?.piece || !jumped || jumped.owner === piece.owner) break;
      moves.push({ from, to });
      if (!usesKonaneNpsRules(state)) break;
    }
  }
  return moves;
}

function konaneCapturedSquare(state: GameState, move: Move, piece: Piece) {
  const rowDelta = move.to.row - move.from.row;
  const colDelta = move.to.col - move.from.col;
  const distance = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  const orthogonalJump = ((rowDelta === 0) !== (colDelta === 0)) && (usesKonaneNpsRules(state) ? distance >= 2 && distance % 2 === 0 : distance === 2);
  if (!orthogonalJump) return null;
  const middle = { row: move.from.row + Math.sign(rowDelta), col: move.from.col + Math.sign(colDelta) };
  const jumped = cellAt(state, middle)?.piece;
  return jumped && jumped.owner !== piece.owner ? middle : null;
}

function isKonaneOpeningRemovalPhase(state: GameState) {
  return readKonaneOpening(state).removals < 2;
}

function readKonaneOpening(state: GameState) {
  const stored = state.variantState?.konaneOpening as { removals?: unknown; firstRemoved?: Square } | undefined;
  const moveRemovals = state.moves.filter((move) => move.kind === "remove").length;
  const removals = Math.min(2, Number(stored?.removals ?? moveRemovals));
  return {
    removals: Number.isFinite(removals) ? removals : 0,
    firstRemoved: stored?.firstRemoved
  };
}

function konaneContinuationFor(state: GameState) {
  const candidate = state.variantState?.konaneContinuation as { row?: unknown; col?: unknown; owner?: unknown } | null | undefined;
  if (!candidate || typeof candidate.row !== "number" || typeof candidate.col !== "number") return null;
  if (candidate.owner !== "white" && candidate.owner !== "black") return null;
  return { square: { row: candidate.row, col: candidate.col }, owner: candidate.owner };
}

function isOrthogonallyAdjacent(a: Square, b: Square) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
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
        if (target.owner !== piece.owner && isRoyal(target, state.variantKey)) moves.push({ from, to: { ...to } });
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
  const standard = usesJungleStandardRules(state);
  if (standard) {
    if ((fromTerrain === "river") !== (toTerrain === "river")) return false;
    // A defender in the attacker's trap loses protection, including the rat exception.
    if (jungleTrapOwner(to) === attacker.owner) return true;
  }
  if (attacker.code === "r" && defender.code === "e" && fromTerrain !== "river" && toTerrain !== "river") return true;
  if (attacker.code === "e" && defender.code === "r") return false;
  if (defender.code === "r" && toTerrain === "river") return attacker.code === "r";

  const defenderRank = !standard && isJungleOwnTrap(defender.owner, to) ? 0 : jungleRank(defender.code, standard);
  return jungleRank(attacker.code, standard) >= defenderRank;
}

export function applyMove(state: GameState, request: Move): GameState {
  if (state.status !== "active") {
    throw new Error("errors.gameCompleted");
  }

  const variant = getVariant(state.variantKey);
  // Execute and record the legal candidate the request resolved to (its kind, promotion
  // choice, drop and canonical castling square), never the raw request.
  const resolved = findLegalMove(state, request);
  if (!resolved) {
    throw new Error("errors.invalidMove");
  }
  const move: Move = structuredClone(resolved);

  const next: GameState = structuredClone(state);
  const toCell = move.kind === "pass" ? null : cellAt(next, move.to);
  if (move.kind !== "pass" && !toCell) throw new Error("errors.invalidMove");

  let movingPiece: Piece;
  let captured: Piece | null = null;
  let jumpedSquare: Square | null = null;

  if (move.kind === "pass") {
    movingPiece = { id: `${state.turn}-pass-${state.ply}`, code: "pass", owner: state.turn, labelKey: "chess.pawn" };
  } else if (move.kind === "drop" && move.drop) {
    movingPiece = { ...move.drop, id: `${move.drop.owner}-${move.drop.code}-drop-${state.ply}-${move.to.row}-${move.to.col}`, promoted: false };
    const hand = next.hands?.[movingPiece.owner];
    if (!hand || (hand[movingPiece.code] ?? 0) <= 0) throw new Error("errors.invalidMove");
    hand[movingPiece.code] -= 1;
    if (hand[movingPiece.code] <= 0) delete hand[movingPiece.code];
    toCell!.piece = movingPiece;
  } else if (move.kind === "remove") {
    const fromCell = cellAt(next, move.from);
    if (!fromCell?.piece) throw new Error("errors.invalidMove");
    movingPiece = fromCell.piece;
    fromCell.piece = null;
  } else {
    const fromCell = cellAt(next, move.from);
    if (!fromCell?.piece) throw new Error("errors.invalidMove");

    movingPiece = fromCell.piece;
    const castle = variant.supportsCastling && movingPiece.code === "k" ? castlingOptions(state, move.from, movingPiece, false).find((option) => sameSquare(option.move.to, move.to)) : undefined;
    if (castle) {
      // Chess960 squares may overlap (king or rook already on its destination), so
      // lift both pieces before placing them.
      const rookCell = cellAt(next, castle.rookFrom)!;
      const rook = rookCell.piece;
      fromCell.piece = null;
      rookCell.piece = null;
      cellAt(next, castle.kingTo)!.piece = movingPiece;
      cellAt(next, castle.rookTo)!.piece = rook;
    } else {
      jumpedSquare = isDraughtsVariant(variant.key) ? draughtsCapturedSquare(next, move, movingPiece) : variant.key === "konane" ? konaneCapturedSquare(next, move, movingPiece) : enPassantCapturedSquare(next, move);
      const jumpedCell = jumpedSquare ? cellAt(next, jumpedSquare) : null;
      captured = jumpedCell?.piece ?? toCell!.piece;
      if (captured) {
        next.captured.push(captured);
        if (jumpedCell?.piece) {
          jumpedCell.piece = null;
        }
        addCapturedPieceToHand(next, movingPiece.owner, captured);
      }
      if (usesKonaneNpsRules(next) && jumpedSquare) {
        // All landing prefixes are legal choices. A longer straight move removes
        // each intervening enemy atomically and earns only one clock increment.
        const dr = Math.sign(move.to.row - move.from.row), dc = Math.sign(move.to.col - move.from.col);
        const distance = Math.max(Math.abs(move.to.row - move.from.row), Math.abs(move.to.col - move.from.col));
        for (let step = 3; step < distance; step += 2) {
          const cell = cellAt(next, { row: move.from.row + dr*step, col: move.from.col + dc*step })!;
          next.captured.push(cell.piece!); cell.piece = null;
        }
      }
      const promoted = shouldPromote(variant, movingPiece, move.to, move.promotion);
      toCell!.piece = {
        ...movingPiece,
        code: promoted ? move.promoteTo ?? promotionCodeFor(variant, movingPiece) : movingPiece.code,
        promoted: promoted || movingPiece.promoted
      };
      fromCell.piece = null;
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
    return withWesternRepetition(state, withAntichessOutcome(next));
  }

  if (variant.key === "jungle") {
    return withJungleOutcome(next, movingPiece.owner, move.to);
  }

  if (isDraughtsVariant(variant.key)) {
    return withDraughtsOutcome(next, movingPiece.owner, movingPiece, move, jumpedSquare);
  }

  if (variant.key === "konane") {
    return withKonaneOutcome(next, movingPiece.owner, move, Boolean(captured));
  }

  if (variant.key === "janggi") {
    return withJanggiOutcome(next, movingPiece.owner, move.to);
  }

  if (variant.key === "racing-kings") {
    return withWesternRepetition(state, withRacingKingsOutcome(next, movingPiece.owner, move.to));
  }

  if (variant.key === "ouk-chaktrang") {
    updateOukLeapRights(next, movingPiece);
    advanceOukCount(next, movingPiece.owner);
  }
  if (variant.key === "makruk") {
    if (usesMakrukHonorCount(next)) advanceMakrukHonorCount(next, movingPiece.owner);
    else updateMakrukCounting(next);
  }

  if (variant.key === "chaturanga" || variant.key === "shatranj") {
    return withWesternRepetition(state, withHistoricalBareKingOutcome(next, movingPiece.owner, move.to));
  }

  if (!variant.supportsCheck && captured && isRoyal(captured, variant.key)) {
    next.status = "completed";
    next.result = movingPiece.owner;
    next.outcomeReason = "royal-captured";
    return next;
  }
  if (isShogiFamily(variant.key)) {
    return withShogiOutcome(next, movingPiece.owner, move.to, state);
  }
  const outcome = withOutcome(next, movingPiece.owner, move.to);
  if (variant.family === "western") return withWesternRepetition(state, outcome);
  return variant.key === "ouk-chaktrang" ? settleOukCount(outcome) : settleMakrukHonorCount(outcome);
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
  } else if (usesJungleStandardRules(state) && !hasAnyLegalMove(state, state.turn)) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = "stalemate";
  }

  return state;
}

function withDraughtsOutcome(state: GameState, mover: PlayerColor, movedPieceBeforePromotion: Piece, move: Move, capturedSquare: Square | null): GameState {
  const opponent = getVariant(state.variantKey).players.find((player) => player !== mover);
  if (!opponent) return state;

  if (countPieces(state, opponent) === 0) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    state.variantState = { ...(state.variantState ?? {}), draughtsContinuation: null };
    return state;
  }

  if (capturedSquare && !draughtsCrowningEndsCapture(state.variantKey, movedPieceBeforePromotion, move.to)) {
    // The variant state still holds the trail that led to this jump.
    const trail = draughtsTrailAfter(state.variantKey, draughtsTrailAt(state, move.from), move, capturedSquare);
    if (draughtsMaxCaptureLengthFrom(state, movedPieceBeforePromotion, move.to, trail) > 0) {
      // A man passing its crowning row mid-capture stays a man; it is crowned only where the capture ends.
      if (movedPieceBeforePromotion.code === "p") cellAt(state, move.to)!.piece = movedPieceBeforePromotion;
      state.turn = mover;
      state.variantState = {
        ...(state.variantState ?? {}),
        draughtsContinuation: { row: move.to.row, col: move.to.col, owner: mover, taken: trail.taken, heading: trail.heading }
      };
      return state;
    }
  }

  state.variantState = { ...(state.variantState ?? {}), draughtsContinuation: null };
  if (!hasAnyLegalMove(state, state.turn)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "no-legal-moves";
  }

  return state;
}

function withKonaneOutcome(state: GameState, mover: PlayerColor, move: Move, captured: boolean): GameState {
  if (move.kind === "remove") {
    const stored = state.variantState?.konaneOpening as { removals?: unknown; firstRemoved?: Square } | undefined;
    const previousRemovals = Math.min(2, Number(stored?.removals ?? Math.max(0, state.moves.filter((playedMove) => playedMove.kind === "remove").length - 1)));
    state.variantState = {
      ...(state.variantState ?? {}),
      konaneOpening: {
        removals: Math.min(2, (Number.isFinite(previousRemovals) ? previousRemovals : 0) + 1),
        firstRemoved: stored?.firstRemoved ?? move.from
      },
      konaneContinuation: null
    };
    return state;
  }

  const movedPiece = cellAt(state, move.to)?.piece;
  if (!usesKonaneNpsRules(state) && captured && movedPiece && konaneJumpMoves(state, movedPiece, move.to).length > 0) {
    state.turn = mover;
    state.variantState = {
      ...(state.variantState ?? {}),
      konaneContinuation: { row: move.to.row, col: move.to.col, owner: mover }
    };
    return state;
  }

  state.variantState = { ...(state.variantState ?? {}), konaneContinuation: null };
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
    if (canKingReachRow(state, state.turn, 0)) {
      state.variantState = { ...(state.variantState ?? {}), racingKingsWhiteReached: true };
    } else {
      state.status = "completed";
      state.result = "white";
      state.outcomeReason = "objective";
    }
    return state;
  }

  if (moverReachedTarget) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    return state;
  }

  // Checks are illegal here, so a side with no legal move is always stalemated.
  if (!hasAnyLegalMove(state, state.turn)) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = "stalemate";
    return state;
  }

  const drawReason = drawReasonFor(state);
  if (drawReason) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = drawReason;
  }
  return state;
}

function canKingReachRow(state: GameState, color: PlayerColor, row: number) {
  for (const cells of state.board) {
    for (const cell of cells) {
      if (cell.piece?.owner === color && cell.piece.code === "k") {
        return getLegalMoves(state, cell.square).some((move) => move.to.row === row);
      }
    }
  }
  return false;
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
  // New native games award Han the 1.5-point compensation for moving second.
  // Unversioned saved games retain their original adjudication convention.
  let redPoints = state.variantState?.janggiProfile === "cho-first-v1" ? 1.5 : 0;
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

function withShogiOutcome(state: GameState, mover: PlayerColor, destination: Square, previous: GameState): GameState {
  const next = withOutcome(state, mover, destination);
  if (next.status === "completed") return next;

  updateShogiVariantState(next, mover, previous);
  const repetition = readShogiRepetition(next);
  if (repetition && repetition.count >= 4) {
    const perpetual = perpetualChecker(repetition);
    next.status = "completed";
    next.result = perpetual ? opponentOf(perpetual) : "draw";
    next.outcomeReason = perpetual ? "perpetual-check" : "repetition";
    return next;
  }

  // Mini-shogi has no impasse rule, and a side in check must answer it before impasse can apply.
  const impasse = next.variantKey === "shogi" ? readShogiImpasse(next) : undefined;
  if (impasse?.senteKingEntered && impasse.goteKingEntered && !isInCheck(next, next.turn)) {
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

function updateShogiVariantState(state: GameState, mover: PlayerColor, previous: GameState) {
  const key = shogiPositionKey(state);
  const earlier = readShogiRepetition(previous) ?? startShogiRepetition(previous);
  const occurrences = { ...earlier.occurrences };
  const count = (occurrences[key] ?? 0) + 1;
  occurrences[key] = count;
  const checker = isInCheck(state, state.turn) ? mover : null;
  // Positions counted before these fields existed keep no first ply, so they can only end in a draw.
  const firstPly = { ...(earlier.firstPly ?? {}) };
  if (count === 1) firstPly[positionDigest(key)] = state.ply;
  const lastQuietPly: Partial<Record<PlayerColor, number>> = { ...(earlier.lastQuietPly ?? { sente: previous.ply, gote: previous.ply }) };
  if (!checker) lastQuietPly[mover] = state.ply;

  state.variantState = { ...(state.variantState ?? {}) };
  state.variantState.shogiRepetition = { key, count, occurrences, checker, firstPly, lastQuietPly } satisfies ShogiRepetitionState;
  state.variantState.shogiImpasse = calculateShogiImpasse(state);
}

/** The position before the first recorded move is its own first occurrence. */
function startShogiRepetition(state: GameState): ShogiRepetitionState {
  const key = shogiPositionKey(state);
  return { key, count: 1, occurrences: { [key]: 1 }, checker: null, firstPly: { [positionDigest(key)]: state.ply }, lastQuietPly: { sente: state.ply, gote: state.ply } };
}

/**
 * Sennichite: the side that gave check with every one of its moves since the repeated
 * position first appeared loses. Mutual continuous checks, or history recorded before
 * these fields existed, fall back to a plain repetition draw.
 */
function perpetualChecker(repetition: ShogiRepetitionState): PlayerColor | null {
  const firstPly = repetition.firstPly?.[positionDigest(repetition.key)];
  const lastQuietPly = repetition.lastQuietPly;
  if (firstPly === undefined || !lastQuietPly) return null;
  const checkers = (["sente", "gote"] as const).filter((side) => (lastQuietPly[side] ?? Infinity) <= firstPly);
  return checkers.length === 1 ? checkers[0] : null;
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

/**
 * Threefold repetition (FIDE 9.2) draws a game the move left active, automatically like the fifty-move
 * rule. `variantState.westernRepetition` lists position digests, oldest first, since the last capture
 * or pawn move; drop variants keep the whole game because captured material can return to the board.
 */
function withWesternRepetition(previous: GameState, next: GameState): GameState {
  if (next.status !== "active") return next;
  const digest = positionDigest(westernPositionKey(next));
  const irreversible = next.halfmoveClock === 0 && !getVariant(next.variantKey).supportsDrops;
  const recorded = previous.variantState?.westernRepetition;
  const earlier = irreversible ? [] : typeof recorded === "string" && recorded ? recorded.split(" ") : [positionDigest(westernPositionKey(previous))];
  const positions = [...earlier, digest];
  next.variantState = { ...next.variantState, westernRepetition: positions.join(" ") };
  if (positions.filter((position) => position === digest).length >= 3) {
    next.status = "completed";
    next.result = "draw";
    next.outcomeReason = "repetition";
  }
  return next;
}

/**
 * Same pieces, side to move, castling rights, en passant option, pockets and (three-check) check counts.
 * A promoted piece differs only where captures go to a pocket, since it returns there as a pawn.
 */
function westernPositionKey(state: GameState) {
  const drops = getVariant(state.variantKey).supportsDrops;
  let board = "";
  for (const row of state.board) {
    for (const cell of row) board += cell.piece ? `${cell.piece.owner[0]}${cell.piece.code}${drops && cell.piece.promoted ? "+" : ""}` : ".";
    board += "/";
  }
  const castling = getCastlingRights(state).map((right) => `${right.owner[0]}${right.side[0]}`).join("");
  const hands = Object.entries(state.hands ?? {})
    .map(([owner, hand]) => `${owner}:${Object.entries(hand ?? {}).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => `${code}${count}`).join(",")}`)
    .sort()
    .join("|");
  const checks = state.variantKey === "three-check" ? `${state.checks.white ?? 0},${state.checks.black ?? 0}` : "";
  return `${state.turn};${board};${castling};${enPassantFile(state)};${hands};${checks}`;
}

/** Positions differ only when an en passant capture is actually legal (FIDE 9.2.3.1). */
function enPassantFile(state: GameState) {
  const last = state.moves.at(-1);
  if (!last || (last.kind && last.kind !== "move")) return -1;
  const target = { row: (last.from.row + last.to.row) / 2, col: last.to.col };
  for (const dc of [-1, 1]) {
    const from = { row: last.to.row, col: last.to.col + dc };
    if (enPassantCapturedSquare(state, { from, to: target }) && getLegalMoves(state, from).some((move) => sameSquare(move.to, target))) return target.col;
  }
  return -1;
}

/** 53-bit string hash (cyrb53): a compact stand-in for a long position key; collisions are negligible at game length. */
function positionDigest(key: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
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
        return isShogiPromotionSquare(getVariant(state.variantKey), owner, cell.square);
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

  if (variant.key === "king-of-the-hill" && destination && movedPiece && isRoyal(movedPiece, variant.key) && isCenterSquare(state, destination)) {
    state.status = "completed";
    state.result = mover;
    state.outcomeReason = "objective";
    return state;
  }

  if (!variant.supportsCheck) return state;

  if (isCountingLimitReached(state)) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = "counting-rule";
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
    return state;
  }

  // Mate and variant wins take precedence over these draws (FIDE 9.6.2).
  const drawReason = drawReasonFor(state);
  if (drawReason) {
    state.status = "completed";
    state.result = "draw";
    state.outcomeReason = drawReason;
  }

  return state;
}

function isCountingLimitReached(state: GameState) {
  const makrukCounting = state.variantKey === "makruk" && !usesMakrukHonorCount(state) ? readMakrukCounting(state) : undefined;
  return Boolean(makrukCounting && makrukCounting.remainingMoves <= 0);
}

function drawReasonFor(state: GameState): "insufficient-material" | "fifty-move" | null {
  if (getVariant(state.variantKey).family === "western" && state.halfmoveClock >= 100) return "fifty-move";
  return isInsufficientMaterialDraw(state) ? "insufficient-material" : null;
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
  // Palace diagonals run corner-centre-corner only; edge midpoints have none.
  if (from.col === 4 || from.row === centerRow) return [];
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

/**
 * Castling (classic and Chess960).
 *
 * The king always ends on the g-file (col 6) or c-file (col 2) and the castling rook
 * on the f-file (col 5) or d-file (col 3). Every square either piece crosses or lands
 * on must be empty apart from those two pieces, neither piece may have moved, and the
 * king may not start in, pass through, or land on an attacked square.
 *
 * Move encoding (`Move.from` is always the king's square):
 * - the king travels two or more files: `to` is the king's destination square
 *   (classic e1-g1 / e1-c1 are unchanged);
 * - the king travels zero or one file: `to` is the castling rook's square, because
 *   the destination is either the king's own square or a normal one-step king move.
 * `applyMove` also accepts the king-takes-own-rook form (`to` = rook square) for any
 * castling, which is how UCI_Chess960 engines report it, and records the canonical form.
 */
type CastlingSide = "king" | "queen";
type CastlingOption = { side: CastlingSide; kingFrom: Square; kingTo: Square; rookFrom: Square; rookTo: Square; move: Move };
export type CastlingRight = { owner: PlayerColor; side: CastlingSide; kingSquare: Square; rookSquare: Square };

function castlingHome(state: GameState, owner: PlayerColor) {
  const variant = getVariant(state.variantKey);
  if (!variant.supportsCastling || (owner !== "white" && owner !== "black")) return null;
  const row = owner === "white" ? variant.board.rows - 1 : 0;
  const rank = variant.key === "chess960" ? readChess960BackRank(state) : (variant.setup[row] ?? "").toLowerCase();
  const kingCol = rank.indexOf("k");
  if (kingCol < 0) return null;
  const queenRookCol = kingCol > 0 ? rank.lastIndexOf("r", kingCol - 1) : -1;
  const kingRookCol = rank.indexOf("r", kingCol + 1);
  return { row, kingCol, rooks: [["king", kingRookCol], ["queen", queenRookCol]] as Array<[CastlingSide, number]> };
}

/** A square keeps its castling right only while no move has left it or landed on it. */
function hasTouchedSquare(state: GameState, square: Square) {
  return state.moves.some((move) => (move.kind !== "drop" && sameSquare(move.from, square)) || sameSquare(move.to, square));
}

/** Castling rights that remain structurally available (unmoved king and rook), ignoring checks and blockers. */
export function getCastlingRights(state: GameState): CastlingRight[] {
  const rights: CastlingRight[] = [];
  for (const owner of ["white", "black"] as const) {
    const home = castlingHome(state, owner);
    if (!home) continue;
    const kingSquare = { row: home.row, col: home.kingCol };
    const king = cellAt(state, kingSquare)?.piece;
    if (!king || king.owner !== owner || king.code !== "k" || hasTouchedSquare(state, kingSquare)) continue;
    for (const [side, rookCol] of home.rooks) {
      if (rookCol < 0) continue;
      const rookSquare = { row: home.row, col: rookCol };
      const rook = cellAt(state, rookSquare)?.piece;
      if (rook && rook.owner === owner && rook.code === "r" && !hasTouchedSquare(state, rookSquare)) rights.push({ owner, side, kingSquare, rookSquare });
    }
  }
  return rights;
}

function castlingOptions(state: GameState, from: Square, king: Piece, checkSafety = true): CastlingOption[] {
  if (king.code !== "k") return [];
  const home = castlingHome(state, king.owner);
  if (!home || from.row !== home.row || from.col !== home.kingCol || hasTouchedSquare(state, from)) return [];
  const row = home.row;
  const options: CastlingOption[] = [];

  for (const [side, rookCol] of home.rooks) {
    if (rookCol < 0) continue;
    const rookFrom = { row, col: rookCol };
    const rook = cellAt(state, rookFrom)?.piece;
    if (!rook || rook.owner !== king.owner || rook.code !== "r" || hasTouchedSquare(state, rookFrom)) continue;
    const kingTo = { row, col: side === "king" ? 6 : 2 };
    const rookTo = { row, col: side === "king" ? 5 : 3 };
    // The king's and rook's spans always overlap, so their union is one contiguous run.
    const low = Math.min(from.col, kingTo.col, rookFrom.col, rookTo.col);
    const high = Math.max(from.col, kingTo.col, rookFrom.col, rookTo.col);
    let blocked = false;
    for (let col = low; col <= high && !blocked; col += 1) {
      blocked = Boolean(cellAt(state, { row, col })?.piece) && col !== from.col && col !== rookFrom.col;
    }
    if (blocked) continue;
    const move: Move = { from, to: Math.abs(kingTo.col - from.col) >= 2 ? kingTo : rookFrom };
    options.push({ side, kingFrom: from, kingTo, rookFrom, rookTo, move });
  }

  if (!checkSafety || !options.length) return options;
  if (isInCheck(state, king.owner)) return [];
  return options.filter((option) => isCastlingPathSafe(state, option, king));
}

function isCastlingPathSafe(state: GameState, option: CastlingOption, king: Piece) {
  const enemies = getVariant(state.variantKey).players.filter((player) => player !== king.owner);
  const step = Math.sign(option.kingTo.col - option.kingFrom.col);
  // Probe each square the king crosses with the king standing on it, so pawn
  // diagonals (which only attack occupied squares) are seen. The castling rook
  // stays on its square during these probes.
  for (let col = option.kingFrom.col + step; step !== 0 && col !== option.kingTo.col; col += step) {
    const square = { row: option.kingFrom.row, col };
    const probe = copyForRoyalSafetyProbe(state, [option.kingFrom, square]);
    cellAt(probe, option.kingFrom)!.piece = null;
    cellAt(probe, square)!.piece = king;
    if (enemies.some((enemy) => isSquareAttacked(probe, square, enemy))) return false;
  }
  // The final position decides the landing square, including lines the rook used to block.
  const probe = copyForRoyalSafetyProbe(state, [option.kingFrom, option.rookFrom, option.kingTo, option.rookTo]);
  const rook = cellAt(probe, option.rookFrom)!.piece;
  cellAt(probe, option.kingFrom)!.piece = null;
  cellAt(probe, option.rookFrom)!.piece = null;
  cellAt(probe, option.kingTo)!.piece = king;
  cellAt(probe, option.rookTo)!.piece = rook;
  return !isInCheck(probe, king.owner);
}

function hasMovedFrom(state: GameState, square: Square) {
  return state.moves.some((move) => sameSquare(move.from, square));
}

function shouldPromote(variant: VariantDefinition, piece: Piece, to: Square, requested?: boolean) {
  if (!variant.supportsPromotion) return false;
  if (isDraughtsVariant(variant.key)) {
    return shouldCrownDraughtsMan(variant, piece, to);
  }
  if (isShogiFamily(variant.key)) {
    return mustPromoteShogiPiece(piece, to, variant.board.rows) || Boolean(requested && canPromoteShogiPiece(piece));
  }
  if (piece.code !== "p") return false;
  if (variant.key === "makruk" || variant.key === "ouk-chaktrang") {
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

function withShogiPromotionChoices(variant: VariantDefinition, piece: Piece, from: Square, moves: Move[]): Move[] {
  if (!canPromoteShogiPiece(piece)) return moves;
  const promotionMoves: Move[] = [];
  for (const move of moves) {
    if (!isShogiPromotionMove(variant, piece, from, move.to)) {
      promotionMoves.push(move);
    } else if (mustPromoteShogiPiece(piece, move.to, variant.board.rows)) {
      promotionMoves.push({ ...move, promotion: true });
    } else {
      promotionMoves.push(move, { ...move, promotion: true });
    }
  }
  return promotionMoves;
}

function canPromoteShogiPiece(piece: Piece) {
  return !piece.promoted && ["p", "l", "n", "s", "b", "r"].includes(piece.code);
}

function isShogiPromotionMove(variant: VariantDefinition, piece: Piece, from: Square, to: Square) {
  return isShogiPromotionSquare(variant, piece.owner, from) || isShogiPromotionSquare(variant, piece.owner, to);
}

function isShogiPromotionSquare(variant: VariantDefinition, owner: PlayerColor, square: Square) {
  const zoneRanks = variant.key === "mini-shogi" ? 1 : 3;
  return owner === "sente" ? square.row < zoneRanks : square.row >= variant.board.rows - zoneRanks;
}

function mustPromoteShogiPiece(piece: Piece, to: Square, boardRows: number) {
  const lastRank = piece.owner === "sente" ? 0 : boardRows - 1;
  const penultimateRank = piece.owner === "sente" ? 1 : boardRows - 2;
  if (["p", "l"].includes(piece.code)) return to.row === lastRank;
  if (piece.code === "n") return piece.owner === "sente" ? to.row <= penultimateRank : to.row >= penultimateRank;
  return false;
}

function sameMoveKind(candidate: Move, requested: Move) {
  return (candidate.kind ?? "move") === (requested.kind ?? "move");
}

function matchesMoveRequest(variant: VariantDefinition, candidate: Move, requested: Move) {
  if (!sameSquare(candidate.to, requested.to) || !sameMoveKind(candidate, requested)) return false;
  if (candidate.promoteTo !== undefined || requested.promoteTo !== undefined) {
    // Western promotion choice: an omitted piece means a queen; a piece requested
    // for a move that offers no choice never matches.
    return candidate.promoteTo !== undefined && candidate.promoteTo === normalizePromoteTo(requested.promoteTo);
  }
  if (!isShogiFamily(variant.key)) return true;
  if (requested.promotion === true) return candidate.promotion === true;
  if (requested.promotion === false) return candidate.promotion !== true;
  return true;
}

/** Pieces a Western pawn may choose on the last rank, queen first. Empty when the variant has a fixed promotion. */
export function westernPromotionChoices(variant: VariantDefinition): string[] {
  if (variant.family !== "western" || !variant.supportsPromotion) return [];
  // Chaturanga and Shatranj promote to their single historical piece.
  if (variant.key === "chaturanga" || variant.key === "shatranj") return [];
  return variant.key === "antichess" ? ["q", "r", "b", "n", "k"] : ["q", "r", "b", "n"];
}

function normalizePromoteTo(value: string | undefined) {
  return value === undefined ? "q" : value.toLowerCase();
}

function withWesternPromotionChoices(variant: VariantDefinition, piece: Piece, moves: Move[]): Move[] {
  const choices = westernPromotionChoices(variant);
  const expanded: Move[] = [];
  for (const move of moves) {
    if (!shouldPromote(variant, piece, move.to)) {
      expanded.push(move);
      continue;
    }
    for (const promoteTo of choices) expanded.push({ ...move, promotion: true, promoteTo });
  }
  return expanded;
}

function findLegalBoardMove(state: GameState, variant: VariantDefinition, request: Move): Move | null {
  const candidates = getLegalMoves(state, request.from);
  const direct = candidates.find((candidate) => matchesMoveRequest(variant, candidate, request));
  if (direct) return direct;
  // King-takes-own-rook castling (the UCI_Chess960 form) resolves to the canonical candidate.
  const king = cellAt(state, request.from)?.piece;
  if (!variant.supportsCastling || king?.code !== "k" || request.promoteTo !== undefined) return null;
  const option = castlingOptions(state, request.from, king, false).find((candidate) => sameSquare(candidate.rookFrom, request.to));
  return option ? candidates.find((candidate) => sameMoveKind(candidate, request) && sameSquare(candidate.to, option.move.to) && candidate.promoteTo === undefined) ?? null : null;
}

/**
 * The legal candidate a move request refers to, or null. The candidate's kind must equal
 * the request's (omitted means "move"). Board moves resolve Western promotion choices
 * (`promoteTo`, default queen) and the king-takes-own-rook castling form; drops need a
 * piece and match by destination; passes are checked by the rules.
 */
export function findLegalMove(state: GameState, request: Move): Move | null {
  if (state.status !== "active") return null;
  if (request.kind === "pass") return isLegalPassMove(state) ? { kind: "pass", from: request.from, to: request.to } : null;
  if (request.kind === "drop") {
    if (!request.drop) return null;
    return getLegalMoves(state, { drop: request.drop }).find((candidate) => sameSquare(candidate.to, request.to)) ?? null;
  }
  return findLegalBoardMove(state, getVariant(state.variantKey), request);
}

function promotionCodeFor(variant: VariantDefinition, piece: Piece) {
  if (isDraughtsVariant(variant.key) && piece.code === "p") return "x";
  if (variant.key === "chaturanga" && piece.code === "p") return "m";
  if (variant.key === "shatranj" && piece.code === "p") return "f";
  if (variant.family === "western" && piece.code === "p") return "q";
  if ((variant.key === "makruk" || variant.key === "ouk-chaktrang") && piece.code === "p") return "m";
  return piece.code;
}

function copyForRoyalSafetyProbe(state: GameState, squares: Square[]): GameState {
  // Probes only replace pieces in these cells. Attack detection reads the
  // remaining board and metadata, so history, clocks and hands can stay shared.
  const board = state.board.slice();
  for (const square of squares) {
    const originalRow = state.board[square.row];
    if (!originalRow?.[square.col]) continue;
    if (board[square.row] === originalRow) board[square.row] = originalRow.slice();
    board[square.row][square.col] = { ...originalRow[square.col] };
  }
  return { ...state, board };
}

function wouldLeaveRoyalInCheck(state: GameState, move: Move, owner: PlayerColor) {
  const enPassant = enPassantCapturedSquare(state, move);
  const next = copyForRoyalSafetyProbe(state, enPassant ? [move.from, move.to, enPassant] : [move.from, move.to]);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  if (!fromCell?.piece || !toCell) return true;
  if (enPassant) cellAt(next, enPassant)!.piece = null;
  toCell.piece = { ...fromCell.piece, promoted: move.promotion || fromCell.piece.promoted };
  fromCell.piece = null;
  return isInCheck(next, owner);
}

function wouldGiveRoyalCheck(state: GameState, move: Move, owner: PlayerColor) {
  const enPassant = enPassantCapturedSquare(state, move);
  const next = copyForRoyalSafetyProbe(state, enPassant ? [move.from, move.to, enPassant] : [move.from, move.to]);
  const fromCell = cellAt(next, move.from);
  const toCell = cellAt(next, move.to);
  if (!fromCell?.piece || !toCell) return true;
  if (enPassant) cellAt(next, enPassant)!.piece = null;
  toCell.piece = { ...fromCell.piece, promoted: move.promotion || fromCell.piece.promoted };
  fromCell.piece = null;
  return isInCheck(next, opponentOf(owner));
}

function wouldDropLeaveRoyalInCheck(state: GameState, move: Move, owner: PlayerColor) {
  if (!move.drop) return true;
  const next = copyForRoyalSafetyProbe(state, [move.to]);
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
      const attacks = state.variantKey === "ouk-chaktrang" ? makrukPieceMoves(state, cell.piece, cell.square) : getPseudoLegalMoves(state, cell.square);
      if (attacks.some((move) => sameSquare(move.to, square))) {
        return true;
      }
    }
  }
  return false;
}

function findRoyal(state: GameState, color: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === color && isRoyal(cell.piece, state.variantKey)) return cell;
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
  return Boolean(movingPiece && ((targetPiece && targetPiece.owner !== movingPiece.owner) || enPassantCapturedSquare(state, move)));
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
      if (isRoyal(piece, state.variantKey)) {
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

/** "g" is the royal general in Xiangqi and Janggi, but the capturable gold general in Shogi. */
export function isRoyal(piece: Piece, variantKey: string) {
  return piece.code === "k" || (piece.code === "g" && (variantKey === "xiangqi" || variantKey === "janggi"));
}

function isCenterSquare(state: GameState, square: Square) {
  const centerRows = state.board.length % 2 === 0 ? [state.board.length / 2 - 1, state.board.length / 2] : [Math.floor(state.board.length / 2)];
  const width = state.board[0]?.length ?? 0;
  const centerCols = width % 2 === 0 ? [width / 2 - 1, width / 2] : [Math.floor(width / 2)];
  return centerRows.includes(square.row) && centerCols.includes(square.col);
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
    return jungleTerrain(square);
  }
  if (variant.key === "xiangqi" || variant.key === "janggi") {
    if ((square.row <= 2 || square.row >= 7) && square.col >= 3 && square.col <= 5) return "palace";
  }
  if (variant.key === "mini-shogi") {
    return square.row === 0 || square.row === variant.board.rows - 1 ? "promotion-zone" : "land";
  }
  if (variant.key === "shogi" && (square.row <= 2 || square.row >= variant.board.rows - 3)) {
    return "promotion-zone";
  }
  if (variant.key === "makruk" || variant.key === "ouk-chaktrang") return square.row === 2 || square.row === 5 ? "promotion-zone" : "land";
  if (variant.supportsPromotion && (square.row === 0 || square.row === variant.board.rows - 1)) return "promotion-zone";
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
  if (move.kind === "remove") return `${label}x${move.from.row},${move.from.col}`;
  // Queen promotions keep the historical key; underpromotions name the chosen piece.
  const promotion = move.promoteTo && move.promoteTo !== "q" ? `=${move.promoteTo.toUpperCase()}` : "";
  return `${label}${move.from.row},${move.from.col}-${move.to.row},${move.to.col}${promotion}`;
}
