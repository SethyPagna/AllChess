import type { BoardCell, GameState, PlayerColor } from "./types";

/**
 * Chess960 setup profiles.
 *
 * - "random-v1": one of the 960 Fischer Random back ranks, chosen deterministically
 *   from the game id and recorded in `variantState` (`chess960Profile`,
 *   `chess960Position`, `chess960BackRank`). The recorded back rank is the source of
 *   truth once a game exists, so imported copies with a new id keep their setup.
 * - legacy (no profile): the fixed `nrkbqrbn` setup that shipped before random-v1.
 *   Old saves and room timelines keep replaying on that setup.
 */
export const CHESS960_PROFILE = "random-v1";
export const LEGACY_CHESS960_BACK_RANK = "nrkbqrbn";
export const CHESS960_POSITION_COUNT = 960;

const knightPlacements: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]
];

const backRankLabels: Record<string, string> = {
  k: "chess.king",
  q: "chess.queen",
  r: "chess.rook",
  b: "chess.bishop",
  n: "chess.knight"
};

/** Scharnagl numbering: 0..959, where 518 is the orthodox `rnbqkbnr`. Returns lowercase files a..h. */
export function chess960BackRank(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= CHESS960_POSITION_COUNT) {
    throw new Error("errors.invalidChess960Position");
  }
  const files: Array<string | null> = Array(8).fill(null);
  let n = index;
  files[(n % 4) * 2 + 1] = "b"; // light-squared bishop: b, d, f or h file
  n = Math.floor(n / 4);
  files[(n % 4) * 2] = "b"; // dark-squared bishop: a, c, e or g file
  n = Math.floor(n / 4);
  const queenSlot = n % 6;
  n = Math.floor(n / 6);
  placeOnEmpty(files, queenSlot, "q");
  const [firstKnight, secondKnight] = knightPlacements[n];
  // Remove the later knight slot first so the earlier slot index stays valid.
  placeOnEmpty(files, secondKnight, "n");
  placeOnEmpty(files, firstKnight, "n");
  for (const code of ["r", "k", "r"]) placeOnEmpty(files, 0, code);
  return files.join("");
}

function placeOnEmpty(files: Array<string | null>, slot: number, code: string) {
  let seen = 0;
  for (let col = 0; col < files.length; col += 1) {
    if (files[col] !== null) continue;
    if (seen === slot) {
      files[col] = code;
      return;
    }
    seen += 1;
  }
}

/** 32-bit FNV-1a over the id, reduced to a Scharnagl index. Stable across runtimes. */
export function chess960IndexForId(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0) % CHESS960_POSITION_COUNT;
}

export function isChess960BackRank(value: unknown): value is string {
  if (typeof value !== "string" || !/^[kqrbn]{8}$/.test(value)) return false;
  const count = (code: string) => value.split("").filter((token) => token === code).length;
  if (count("k") !== 1 || count("q") !== 1 || count("r") !== 2 || count("b") !== 2 || count("n") !== 2) return false;
  const bishops = [value.indexOf("b"), value.lastIndexOf("b")];
  if (bishops[0] % 2 === bishops[1] % 2) return false;
  const king = value.indexOf("k");
  return value.indexOf("r") < king && king < value.lastIndexOf("r");
}

export function chess960IndexOf(backRank: string): number {
  const normalized = backRank.toLowerCase();
  for (let index = 0; index < CHESS960_POSITION_COUNT; index += 1) {
    if (chess960BackRank(index) === normalized) return index;
  }
  return -1;
}

export const usesChess960RandomSetup = (state: GameState) =>
  state.variantKey === "chess960" && state.variantState?.chess960Profile === CHESS960_PROFILE;

/**
 * The back rank a Chess960 game started from (lowercase, a..h). Recorded data wins;
 * the id-derived rank is only a fallback for random-v1 states missing their record.
 * Games without a profile are legacy fixed-setup games.
 */
export function readChess960BackRank(state: GameState): string {
  if (!usesChess960RandomSetup(state)) return LEGACY_CHESS960_BACK_RANK;
  const recorded = state.variantState?.chess960BackRank;
  if (isChess960BackRank(recorded)) return recorded;
  const position = state.variantState?.chess960Position;
  if (typeof position === "number" && Number.isInteger(position) && position >= 0 && position < CHESS960_POSITION_COUNT) {
    return chess960BackRank(position);
  }
  return chess960BackRank(chess960IndexForId(state.id));
}

/** Place a back rank for both sides (Black mirrors White) and record it on the state. */
export function withChess960BackRank(state: GameState, backRank: string): GameState {
  if (!isChess960BackRank(backRank)) throw new Error("errors.invalidChess960Position");
  const board = state.board.map((row) => row.map((cell) => ({ ...cell })));
  const lastRow = board.length - 1;
  for (const [row, owner] of [[0, "black"], [lastRow, "white"]] as Array<[number, PlayerColor]>) {
    board[row] = board[row].map((cell, col): BoardCell => {
      const code = backRank[col];
      return { ...cell, piece: { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: backRankLabels[code] } };
    });
  }
  return {
    ...state,
    board,
    variantState: { ...state.variantState, chess960Profile: CHESS960_PROFILE, chess960Position: chess960IndexOf(backRank), chess960BackRank: backRank }
  };
}

/**
 * Rebuild the opening a recorded Chess960 game actually used, for replaying its moves.
 * random-v1 games restore their recorded back rank (independent of the replay id);
 * legacy games restore the fixed `nrkbqrbn` setup without profile metadata.
 */
export function restoreChess960Opening(initial: GameState, played: GameState): GameState {
  if (initial.variantKey !== "chess960") return initial;
  if (usesChess960RandomSetup(played)) return withChess960BackRank(initial, readChess960BackRank(played));
  const legacy = withChess960BackRank(initial, LEGACY_CHESS960_BACK_RANK);
  const variantState = { ...legacy.variantState };
  delete variantState.chess960Profile;
  delete variantState.chess960Position;
  delete variantState.chess960BackRank;
  const next: GameState = { ...legacy };
  if (Object.keys(variantState).length) next.variantState = variantState;
  else delete next.variantState;
  return next;
}
