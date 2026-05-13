import { getLegalMoves, type GameState, type Move } from "@/lib/variants";
import type { BotDifficultyKey } from "@/lib/bots";

export type BotEngineMode = "auto" | "stockfish" | "internal";

export type StockfishDifficultyConfig = {
  limitStrength: boolean;
  elo: number;
  skillLevel: number;
  moveTimeMs: number;
  depth: number;
};

const configs: Record<BotDifficultyKey, StockfishDifficultyConfig> = {
  easy: { limitStrength: true, elo: 900, skillLevel: 2, moveTimeMs: 120, depth: 2 },
  normal: { limitStrength: true, elo: 1400, skillLevel: 6, moveTimeMs: 250, depth: 4 },
  hard: { limitStrength: true, elo: 1900, skillLevel: 10, moveTimeMs: 500, depth: 7 },
  "very-hard": { limitStrength: true, elo: 2300, skillLevel: 14, moveTimeMs: 900, depth: 10 },
  nightmare: { limitStrength: true, elo: 2700, skillLevel: 18, moveTimeMs: 1500, depth: 14 },
  hell: { limitStrength: false, elo: 3200, skillLevel: 20, moveTimeMs: 2400, depth: 18 }
};

export function shouldUseStockfish(state: GameState, engine: BotEngineMode = "auto") {
  if (engine === "internal") return false;
  if (engine === "stockfish") return true;
  return state.variantKey === "classic" || state.variantKey === "chess960";
}

export function getStockfishDifficultyConfig(key: BotDifficultyKey) {
  return configs[key] ?? configs.normal;
}

export function moveToUci(state: GameState, move: Move) {
  const from = squareToUci(state, move.from);
  const to = squareToUci(state, move.to);
  const promotion = move.promotion ? "q" : "";
  return `${from}${to}${promotion}`;
}

export function uciToLegalMove(state: GameState, uci: string) {
  const from = uciSquareToSquare(state, uci.slice(0, 2));
  const to = uciSquareToSquare(state, uci.slice(2, 4));
  if (!from || !to) return null;
  return getLegalMoves(state, from).find((move) => move.to.row === to.row && move.to.col === to.col) ?? null;
}

function squareToUci(state: GameState, square: { row: number; col: number }) {
  return `${String.fromCharCode(97 + square.col)}${state.board.length - square.row}`;
}

function uciSquareToSquare(state: GameState, value: string) {
  const file = value.charCodeAt(0) - 97;
  const rank = Number(value[1]);
  const row = state.board.length - rank;
  if (!Number.isInteger(file) || !Number.isInteger(rank)) return null;
  if (row < 0 || row >= state.board.length || file < 0 || file >= (state.board[0]?.length ?? 0)) return null;
  return { row, col: file };
}
