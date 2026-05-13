import { applyMove, getLegalMoves, type GameState, type Move, type PlayerColor } from "@/lib/variants";

export type BotDifficultyKey = "easy" | "normal" | "hard" | "very-hard" | "nightmare" | "hell";

export type BotDifficulty = {
  key: BotDifficultyKey;
  label: string;
  depth: number;
  moveTimeMs: number;
  skill: number;
  nodeBudget: number;
  beamWidth: number;
  quiescenceDepth: number;
  riskTolerance: number;
};

export const botDifficultyLevels: BotDifficulty[] = [
  { key: "easy", label: "Easy", depth: 1, moveTimeMs: 120, skill: 2, nodeBudget: 80, beamWidth: 4, quiescenceDepth: 0, riskTolerance: 0.85 },
  { key: "normal", label: "Normal", depth: 2, moveTimeMs: 250, skill: 5, nodeBudget: 250, beamWidth: 8, quiescenceDepth: 0, riskTolerance: 0.65 },
  { key: "hard", label: "Hard", depth: 3, moveTimeMs: 500, skill: 8, nodeBudget: 900, beamWidth: 14, quiescenceDepth: 1, riskTolerance: 0.45 },
  { key: "very-hard", label: "Very Hard", depth: 4, moveTimeMs: 900, skill: 12, nodeBudget: 2200, beamWidth: 20, quiescenceDepth: 1, riskTolerance: 0.28 },
  { key: "nightmare", label: "Nightmare", depth: 5, moveTimeMs: 1500, skill: 16, nodeBudget: 5200, beamWidth: 28, quiescenceDepth: 2, riskTolerance: 0.15 },
  { key: "hell", label: "Hell", depth: 6, moveTimeMs: 2400, skill: 20, nodeBudget: 12000, beamWidth: 36, quiescenceDepth: 3, riskTolerance: 0.05 }
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
  const safe = chooseBotMoveSafe(state, difficultyKey);
  if (!safe.move) {
    throw new Error("errors.noLegalMoves");
  }
  return safe.move;
}

export function chooseBotMoveSafe(
  state: GameState,
  difficultyKey: BotDifficultyKey = "normal"
): { move: Move; reason: "ok" } | { move: null; reason: "no-legal-moves" } {
  const difficulty = botDifficultyLevels.find((level) => level.key === difficultyKey) ?? botDifficultyLevels[1];
  const legalMoves = allLegalMoves(state);
  if (!legalMoves.length) {
    return { move: null, reason: "no-legal-moves" };
  }

  const perspective = state.turn;
  const budget = { nodes: 0, deadline: Date.now() + Math.min(difficulty.moveTimeMs, 45) };
  const ranked = legalMoves
    .map((move) => ({ move, score: evaluateMove(state, move, difficulty, perspective, budget) }))
    .sort((a, b) => b.score - a.score);

  if (difficulty.key === "easy") {
    return { move: ranked[Math.min(ranked.length - 1, Math.floor(ranked.length / 2))].move, reason: "ok" };
  }

  return { move: ranked[0].move, reason: "ok" };
}

export function allLegalMoves(state: GameState) {
  return state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));
}

function evaluateMove(
  state: GameState,
  move: Move,
  difficulty: BotDifficulty,
  perspective: PlayerColor,
  budget: { nodes: number; deadline: number }
) {
  if (difficulty.key === "easy") {
    return staticMoveScore(state, move) + deterministicNoise(move) * 20;
  }

  const next = tryMove(state, move);
  if (!next) return Number.NEGATIVE_INFINITY;
  if (next.status === "completed") {
    return evaluateState(next, perspective);
  }

  const searchDepth = Math.min(difficulty.depth - 1, 4);
  const searchScore = minimax(next, searchDepth, perspective, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, difficulty, budget);
  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  const riskPenalty = movedPiece ? hangingPenalty(next, move.to, movedPiece) * (1 - difficulty.riskTolerance) : 0;
  const noise = difficulty.skill >= 20 ? 0 : deterministicNoise(move) * (22 - difficulty.skill);
  return searchScore - riskPenalty + noise;
}

function minimax(
  state: GameState,
  depth: number,
  perspective: PlayerColor,
  alpha: number,
  beta: number,
  difficulty: BotDifficulty,
  budget: { nodes: number; deadline: number }
): number {
  budget.nodes += 1;
  if (state.status === "completed" || depth <= 0 || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) {
    return quiescence(state, difficulty.quiescenceDepth, perspective, alpha, beta, difficulty, budget);
  }

  const moves = allLegalMoves(state)
    .map((move) => ({ move, score: staticMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, difficulty.beamWidth);

  if (!moves.length) return evaluateState(state, perspective);

  const maximizing = state.turn === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const { move } of moves) {
    const next = tryMove(state, move);
    if (!next) continue;
    const score = minimax(next, depth - 1, perspective, alpha, beta, difficulty, budget);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }

  return best;
}

function quiescence(
  state: GameState,
  depth: number,
  perspective: PlayerColor,
  alpha: number,
  beta: number,
  difficulty: BotDifficulty,
  budget: { nodes: number; deadline: number }
): number {
  let best = evaluateState(state, perspective);
  if (depth <= 0 || state.status === "completed" || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) return best;

  const tacticalMoves = allLegalMoves(state)
    .filter((move) => isCapture(state, move) || staticMoveScore(state, move) >= 700)
    .map((move) => ({ move, score: staticMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(4, Math.floor(difficulty.beamWidth / 2)));

  for (const { move } of tacticalMoves) {
    const next = tryMove(state, move);
    if (!next) continue;
    budget.nodes += 1;
    const score = quiescence(next, depth - 1, perspective, alpha, beta, difficulty, budget);
    if (state.turn === perspective) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }

  return best;
}

function evaluateState(state: GameState, perspective: PlayerColor) {
  if (state.status === "completed") {
    if (state.result === "draw") return 0;
    return state.result === perspective ? 100000 - state.ply : -100000 + state.ply;
  }

  const material = state.board.reduce((total, row) => {
    return (
      total +
      row.reduce((rowTotal, cell) => {
        if (!cell.piece) return rowTotal;
        const value = pieceValues[cell.piece.code] ?? 100;
        return rowTotal + (cell.piece.owner === perspective ? value : -value);
      }, 0)
    );
  }, 0);

  const activeMobility = allLegalMoves(state).length * (state.turn === perspective ? 5 : -5);
  const position = positionalScore(state, perspective);
  const royalSafety = royalSafetyScore(state, perspective);
  return material + activeMobility + position + royalSafety;
}

function staticMoveScore(state: GameState, move: Move) {
  const target = state.board[move.to.row]?.[move.to.col];
  const moving = state.board[move.from.row]?.[move.from.col]?.piece;
  const centerRow = (state.board.length - 1) / 2;
  const centerCol = ((state.board[0]?.length ?? 1) - 1) / 2;
  const centerDistance = Math.abs(move.to.row - centerRow) + Math.abs(move.to.col - centerCol);
  const captureScore = target?.piece ? pieceValues[target.piece.code] ?? 100 : 0;
  const developmentScore = moving && ["n", "b", "h", "e", "a", "g"].includes(moving.code) ? 20 : 0;
  const centerScore = Math.max(0, 12 - centerDistance * 2);
  const promotionScore = moving?.code === "p" && (move.to.row === 0 || move.to.row === state.board.length - 1) ? 760 : 0;
  const castlingScore = moving?.code === "k" && Math.abs(move.to.col - move.from.col) === 2 ? 90 : 0;

  return captureScore + promotionScore + castlingScore + developmentScore + centerScore;
}

function positionalScore(state: GameState, perspective: PlayerColor) {
  const centerRow = (state.board.length - 1) / 2;
  const centerCol = ((state.board[0]?.length ?? 1) - 1) / 2;
  let score = 0;

  for (const row of state.board) {
    for (const cell of row) {
      if (!cell.piece) continue;
      const distance = Math.abs(cell.square.row - centerRow) + Math.abs(cell.square.col - centerCol);
      const activity = Math.max(0, 10 - distance) * (["p", "s", "d", "w"].includes(cell.piece.code) ? 1 : 3);
      score += cell.piece.owner === perspective ? activity : -activity;
    }
  }

  return score;
}

function royalSafetyScore(state: GameState, perspective: PlayerColor) {
  const ownRoyal = findRoyalSquare(state, perspective);
  const enemyRoyal = opponentColors(state, perspective).map((color) => findRoyalSquare(state, color)).find(Boolean);
  const ownPressure = ownRoyal ? attackedAround(state, ownRoyal, perspective) : 0;
  const enemyPressure = enemyRoyal ? attackedAround(state, enemyRoyal, perspective) : 0;
  return enemyPressure * 12 - ownPressure * 18;
}

function attackedAround(state: GameState, square: { row: number; col: number }, defender: PlayerColor) {
  const attackers = opponentColors(state, defender);
  return state.board.reduce((total, row) => {
    return (
      total +
      row.reduce((rowTotal, cell) => {
        if (!cell.piece || !attackers.includes(cell.piece.owner)) return rowTotal;
        const distance = Math.abs(cell.square.row - square.row) + Math.abs(cell.square.col - square.col);
        return rowTotal + (distance <= 2 ? 1 : 0);
      }, 0)
    );
  }, 0);
}

function hangingPenalty(state: GameState, square: { row: number; col: number }, piece: { code: string; owner: PlayerColor }) {
  const attackers = opponentColors(state, piece.owner);
  const canBeCaptured = attackers.some((attacker) => allLegalMovesFor(state, attacker).some((move) => move.to.row === square.row && move.to.col === square.col));
  return canBeCaptured ? (pieceValues[piece.code] ?? 100) * 0.45 : 0;
}

function allLegalMovesFor(state: GameState, color: PlayerColor) {
  return allLegalMoves({ ...state, turn: color });
}

function opponentColors(state: GameState, perspective: PlayerColor) {
  return state.clocks.map((clock) => clock.color).filter((color) => color !== perspective);
}

function findRoyalSquare(state: GameState, color: PlayerColor) {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.piece?.owner === color && ["k", "g"].includes(cell.piece.code)) return cell.square;
    }
  }
  return null;
}

function isCapture(state: GameState, move: Move) {
  return Boolean(state.board[move.to.row]?.[move.to.col]?.piece);
}

function tryMove(state: GameState, move: Move) {
  try {
    return applyMove(state, move);
  } catch {
    return null;
  }
}

function deterministicNoise(move: Move) {
  const seed = (move.from.row + 1) * 17 + (move.from.col + 1) * 31 + (move.to.row + 1) * 43 + (move.to.col + 1) * 59;
  return (seed % 11) - 5;
}
