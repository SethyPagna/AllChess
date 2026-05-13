import { getLegalMoves, type GameState, type Move } from "@/lib/variants";

export type BotDifficultyKey = "easy" | "normal" | "hard" | "very-hard" | "nightmare" | "hell";

export type BotDifficulty = {
  key: BotDifficultyKey;
  label: string;
  depth: number;
  moveTimeMs: number;
  skill: number;
};

export const botDifficultyLevels: BotDifficulty[] = [
  { key: "easy", label: "Easy", depth: 1, moveTimeMs: 120, skill: 2 },
  { key: "normal", label: "Normal", depth: 2, moveTimeMs: 250, skill: 5 },
  { key: "hard", label: "Hard", depth: 3, moveTimeMs: 500, skill: 8 },
  { key: "very-hard", label: "Very Hard", depth: 4, moveTimeMs: 900, skill: 12 },
  { key: "nightmare", label: "Nightmare", depth: 5, moveTimeMs: 1500, skill: 16 },
  { key: "hell", label: "Hell", depth: 6, moveTimeMs: 2400, skill: 20 }
];

const pieceValues: Record<string, number> = {
  k: 10000,
  q: 900,
  r: 500,
  c: 500,
  l: 500,
  b: 330,
  e: 330,
  n: 320,
  h: 320,
  g: 250,
  a: 220,
  s: 120,
  p: 100,
  d: 100,
  w: 100,
  t: 700
};

export function chooseBotMove(state: GameState, difficultyKey: BotDifficultyKey = "normal"): Move {
  const difficulty = botDifficultyLevels.find((level) => level.key === difficultyKey) ?? botDifficultyLevels[1];
  const legalMoves = allLegalMoves(state);
  if (!legalMoves.length) {
    throw new Error("errors.noLegalMoves");
  }

  const ranked = legalMoves
    .map((move) => ({ move, score: evaluateMove(state, move, difficulty) }))
    .sort((a, b) => b.score - a.score);

  if (difficulty.key === "easy") {
    return ranked[Math.min(ranked.length - 1, Math.floor(ranked.length / 2))].move;
  }

  return ranked[0].move;
}

export function allLegalMoves(state: GameState) {
  return state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));
}

function evaluateMove(state: GameState, move: Move, difficulty: BotDifficulty) {
  const target = state.board[move.to.row]?.[move.to.col];
  const moving = state.board[move.from.row]?.[move.from.col]?.piece;
  const centerRow = (state.board.length - 1) / 2;
  const centerCol = ((state.board[0]?.length ?? 1) - 1) / 2;
  const centerDistance = Math.abs(move.to.row - centerRow) + Math.abs(move.to.col - centerCol);
  const captureScore = target?.piece ? pieceValues[target.piece.code] ?? 100 : 0;
  const developmentScore = moving && ["n", "b", "h", "e", "a", "g"].includes(moving.code) ? 20 : 0;
  const centerScore = Math.max(0, 12 - centerDistance * 2);
  const depthBias = difficulty.depth * 3;

  return captureScore + developmentScore + centerScore + depthBias;
}
