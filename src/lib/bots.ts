import { applyMove, getLegalMoves, sameSquare, type GameState, type Move, type PlayerColor } from "@/lib/variants";
import { moveToUci, requestStockfishMove, shouldUseStockfish, type BotEngineMode } from "@/lib/stockfish-engine";

export type BotTierKey = "easy" | "normal" | "hard" | "very-hard" | "grandmaster" | "legend";
export type BotDifficultyKey = BotTierKey;
export type BotPlayStyle = "balanced" | "tactical" | "positional" | "defensive" | "wild";

export type BotDifficulty = {
  key: BotTierKey;
  label: string;
  estimatedStrength: string;
  benchmarkVersion: string;
  depth: number;
  moveTimeMs: number;
  skill: number;
  nodeBudget: number;
  beamWidth: number;
  quiescenceDepth: number;
  riskTolerance: number;
};

export type BotMoveResult = {
  requestId: string;
  status: "ok" | "no-legal-moves" | "cancelled" | "failed";
  engine: "stockfish" | "internal";
  tier: BotTierKey;
  move: Move | null;
  uciMove?: string;
  principalVariation: string[];
  pv: string[];
  reason: "ok" | "no-legal-moves" | "cancelled" | "failed";
  score: number | null;
  evaluation: number | null;
  confidence: number;
  benchmarkVersion: string;
  legal: boolean;
  depth: number;
  nodes: number;
  depthReached: number;
  nodesSearched: number;
  elapsedMs: number;
  validatedLegal: boolean;
  error?: string;
};

export type BotMoveOptions = {
  requestId?: string;
  delayMs?: number;
  maxSearchTimeMs?: number;
  engine?: BotEngineMode;
  playStyle?: BotPlayStyle;
  roomId?: string;
  rated?: boolean;
};

export type BotMoveRequest = {
  state: GameState;
  tier: BotTierKey;
  variantKey: string;
  engineMode: BotEngineMode;
  playStyle: BotPlayStyle;
  maxSearchTimeMs: number;
  roomId?: string;
  rated?: boolean;
};

export const botDifficultyLevels: BotDifficulty[] = [
  { key: "easy", label: "Easy", estimatedStrength: "Beginner practice", benchmarkVersion: "allchess-bench-v1", depth: 1, moveTimeMs: 120, skill: 2, nodeBudget: 80, beamWidth: 4, quiescenceDepth: 0, riskTolerance: 0.85 },
  { key: "normal", label: "Normal", estimatedStrength: "Club basics", benchmarkVersion: "allchess-bench-v1", depth: 2, moveTimeMs: 250, skill: 5, nodeBudget: 250, beamWidth: 8, quiescenceDepth: 0, riskTolerance: 0.65 },
  { key: "hard", label: "Hard", estimatedStrength: "Tactical club", benchmarkVersion: "allchess-bench-v1", depth: 3, moveTimeMs: 650, skill: 8, nodeBudget: 1400, beamWidth: 14, quiescenceDepth: 1, riskTolerance: 0.45 },
  { key: "very-hard", label: "Very Hard", estimatedStrength: "Expert practice", benchmarkVersion: "allchess-bench-v1", depth: 4, moveTimeMs: 1200, skill: 12, nodeBudget: 3600, beamWidth: 20, quiescenceDepth: 1, riskTolerance: 0.28 },
  { key: "grandmaster", label: "Grandmaster", estimatedStrength: "Engine-backed master benchmark", benchmarkVersion: "allchess-bench-v1", depth: 5, moveTimeMs: 2200, skill: 18, nodeBudget: 11000, beamWidth: 32, quiescenceDepth: 2, riskTolerance: 0.12 },
  { key: "legend", label: "Legend", estimatedStrength: "Maximum local benchmark", benchmarkVersion: "allchess-bench-v1", depth: 7, moveTimeMs: 3600, skill: 20, nodeBudget: 26000, beamWidth: 44, quiescenceDepth: 4, riskTolerance: 0.03 }
];

const pendingRequests = new Map<string, { cancelled: boolean }>();

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

export function chooseBotMove(state: GameState, difficultyKey: BotDifficultyKey = "normal", options: Pick<BotMoveOptions, "maxSearchTimeMs" | "engine"> = {}): Move {
  const safe = chooseBotMoveSafe(state, difficultyKey, options);
  if (!safe.move) {
    throw new Error("errors.noLegalMoves");
  }
  return safe.move;
}

export function chooseBotMoveSafe(
  state: GameState,
  difficultyKey: BotDifficultyKey = "normal",
  options: Pick<BotMoveOptions, "maxSearchTimeMs" | "engine"> = {}
):
  | { move: Move; reason: "ok"; score: number; depthReached: number; nodesSearched: number; elapsedMs: number; validatedLegal: true }
  | { move: null; reason: "no-legal-moves" } {
  const startedAt = Date.now();
  const difficulty = botDifficultyLevels.find((level) => level.key === difficultyKey) ?? botDifficultyLevels[1];
  const legalMoves = allLegalMoves(state);
  if (!legalMoves.length) {
    return { move: null, reason: "no-legal-moves" };
  }

  const perspective = state.turn;
  const searchTimeMs = Math.max(8, Math.min(options.maxSearchTimeMs ?? difficulty.moveTimeMs, difficulty.moveTimeMs));
  const budget = { nodes: 0, deadline: startedAt + searchTimeMs };
  const ranked = legalMoves
    .map((move) => ({ move, score: evaluateMove(state, move, difficulty, perspective, budget) }))
    .sort((a, b) => b.score - a.score);

  const selected = difficulty.key === "easy" ? ranked[Math.min(ranked.length - 1, Math.floor(ranked.length / 2))] : ranked[0];
  const depthReached = Math.max(1, Math.min(difficulty.depth, difficulty.depth - (Date.now() >= budget.deadline ? 1 : 0)));

  if (difficulty.key === "easy") {
    return {
      move: selected.move,
      reason: "ok",
      score: selected.score,
      depthReached,
      nodesSearched: budget.nodes,
      elapsedMs: Date.now() - startedAt,
      validatedLegal: true
    };
  }

  return {
    move: selected.move,
    reason: "ok",
    score: selected.score,
    depthReached,
    nodesSearched: budget.nodes,
    elapsedMs: Date.now() - startedAt,
    validatedLegal: true
  };
}

export function requestBotMove(state: GameState, difficultyKey: BotDifficultyKey = "normal", options: BotMoveOptions = {}): Promise<BotMoveResult> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const requestState = { cancelled: false };
  pendingRequests.set(requestId, requestState);
  const startedAt = Date.now();
  const tierConfig = difficultyFor(difficultyKey);

  return new Promise((resolve) => {
    const finish = (result: BotMoveResult) => {
      pendingRequests.delete(requestId);
      resolve(result);
    };

    windowSafeSetTimeout(async () => {
      if (requestState.cancelled) {
        finish({
          requestId,
          status: "cancelled",
          engine: "internal",
          tier: difficultyKey,
          move: null,
          principalVariation: [],
          pv: [],
          reason: "cancelled",
          score: null,
          evaluation: null,
          confidence: 0,
          benchmarkVersion: tierConfig.benchmarkVersion,
          legal: false,
          depth: 0,
          nodes: 0,
          depthReached: 0,
          nodesSearched: 0,
          elapsedMs: Date.now() - startedAt,
          validatedLegal: false
        });
        return;
      }

      try {
        if (shouldUseStockfish(state, options.engine ?? "auto")) {
          const playedMoves = state.moves.map((move) => moveToUci(state, move));
          const stockfish = await requestStockfishMove(state, difficultyKey, playedMoves, options.maxSearchTimeMs ?? difficultyFor(difficultyKey).moveTimeMs);
          if (stockfish && !requestState.cancelled) {
            finish({
              requestId,
              status: "ok",
              engine: "stockfish",
              tier: difficultyKey,
              move: stockfish.move,
              uciMove: stockfish.uciMove,
              principalVariation: stockfish.principalVariation,
              pv: stockfish.principalVariation,
              reason: "ok",
              score: stockfish.evaluation,
              evaluation: stockfish.evaluation,
              confidence: confidenceFor(stockfish.evaluation, stockfish.depthReached, difficultyKey),
              benchmarkVersion: tierConfig.benchmarkVersion,
              legal: true,
              depth: stockfish.depthReached,
              nodes: stockfish.nodesSearched,
              depthReached: stockfish.depthReached,
              nodesSearched: stockfish.nodesSearched,
              elapsedMs: Date.now() - startedAt,
              validatedLegal: true
            });
            return;
          }
        }

        const result = chooseBotMoveSafe(state, difficultyKey, options);
        if (!result.move) {
          finish({
            requestId,
            status: "no-legal-moves",
            engine: "internal",
            tier: difficultyKey,
            move: null,
            principalVariation: [],
            pv: [],
            reason: "no-legal-moves",
            score: null,
            evaluation: null,
            confidence: 0,
            benchmarkVersion: tierConfig.benchmarkVersion,
            legal: false,
            depth: 0,
            nodes: 0,
            depthReached: 0,
            nodesSearched: 0,
            elapsedMs: Date.now() - startedAt,
            validatedLegal: false
          });
          return;
        }

        const validatedLegal = isLegalMove(state, result.move);
        finish({
          requestId,
          status: validatedLegal ? "ok" : "failed",
          engine: "internal",
          tier: difficultyKey,
          move: validatedLegal ? result.move : null,
          uciMove: validatedLegal ? safeUci(state, result.move) : undefined,
          principalVariation: validatedLegal ? [safeUci(state, result.move)].filter(Boolean) : [],
          pv: validatedLegal ? [safeUci(state, result.move)].filter(Boolean) : [],
          reason: validatedLegal ? "ok" : "failed",
          score: result.score,
          evaluation: result.score,
          confidence: validatedLegal ? confidenceFor(result.score, result.depthReached, difficultyKey) : 0,
          benchmarkVersion: tierConfig.benchmarkVersion,
          legal: validatedLegal,
          depth: result.depthReached,
          nodes: result.nodesSearched,
          depthReached: result.depthReached,
          nodesSearched: result.nodesSearched,
          elapsedMs: Date.now() - startedAt,
          validatedLegal,
          error: validatedLegal ? undefined : "Bot selected an illegal move."
        });
      } catch (error) {
        finish({
          requestId,
          status: "failed",
          engine: "internal",
          tier: difficultyKey,
          move: null,
          principalVariation: [],
          pv: [],
          reason: "failed",
          score: null,
          evaluation: null,
          confidence: 0,
          benchmarkVersion: tierConfig.benchmarkVersion,
          legal: false,
          depth: 0,
          nodes: 0,
          depthReached: 0,
          nodesSearched: 0,
          elapsedMs: Date.now() - startedAt,
          validatedLegal: false,
          error: error instanceof Error ? error.message : "Bot move failed."
        });
      }
    }, options.delayMs ?? 0);
  });
}

export function cancelBotMove(requestId: string) {
  const request = pendingRequests.get(requestId);
  if (request) request.cancelled = true;
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

  const searchDepth = Math.max(0, difficulty.depth - 1);
  const searchScore = minimax(next, searchDepth, perspective, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, difficulty, budget);
  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  const riskPenalty = movedPiece && difficulty.skill >= 8 ? hangingPenalty(next, move.to, movedPiece) * (1 - difficulty.riskTolerance) : 0;
  const strategyBonus = difficulty.skill >= 12 ? strategicMoveScore(state, next, move, perspective, difficulty) : 0;
  const replyPenalty = difficulty.skill >= 8 ? opponentReplyPenalty(next, perspective, difficulty, budget) * (1.15 - difficulty.riskTolerance) : 0;
  const noise = difficulty.skill >= 20 ? 0 : deterministicNoise(move) * (22 - difficulty.skill);
  return searchScore + strategyBonus - riskPenalty - replyPenalty + noise;
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
  const captureScore = target?.piece ? (pieceValues[target.piece.code] ?? 100) * 10 - (moving ? (pieceValues[moving.code] ?? 100) : 0) / 8 : 0;
  const developmentScore = moving && ["n", "b", "h", "e", "a", "g"].includes(moving.code) ? 20 : 0;
  const centerScore = Math.max(0, 12 - centerDistance * 2);
  const promotionScore = moving?.code === "p" && (move.to.row === 0 || move.to.row === state.board.length - 1) ? 760 : 0;
  const castlingScore = moving?.code === "k" && Math.abs(move.to.col - move.from.col) === 2 ? 90 : 0;

  return captureScore + promotionScore + castlingScore + developmentScore + centerScore;
}

function strategicMoveScore(state: GameState, next: GameState, move: Move, perspective: PlayerColor, difficulty: BotDifficulty) {
  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  if (!movedPiece) return 0;
  const opponents = opponentColors(next, perspective);
  const attacksAfter = allLegalMovesFor(next, perspective);
  const newThreats = attacksAfter.reduce((total, candidate) => {
    const target = next.board[candidate.to.row]?.[candidate.to.col]?.piece;
    return total + (target && opponents.includes(target.owner) ? (pieceValues[target.code] ?? 100) * 0.12 : 0);
  }, 0);
  const ownDanger = isSquareAttackedBy(next, move.to, opponents) ? (pieceValues[movedPiece.code] ?? 100) * 0.18 : 0;
  const ownSupport = nearbyFriendlySupport(next, move.to, movedPiece.owner) * 18;
  const advancement = advancementScore(state, move, movedPiece.owner, movedPiece.code) * (difficulty.skill / 10);
  const objective = variantObjectiveScore(next, move, movedPiece.owner) * (difficulty.skill / 8);
  const constriction = mobilitySwing(state, next, perspective) * (difficulty.skill / 20);
  const forkPressure = forkPressureScore(next, perspective) * (difficulty.skill / 18);
  const loosePiecePressure = loosePieceScore(next, opponents) * (difficulty.skill / 18);
  const tempo = givesTurnPressure(next, perspective) ? 45 : 0;
  return newThreats + ownSupport + advancement + objective + constriction + forkPressure + loosePiecePressure + tempo - ownDanger;
}

function opponentReplyPenalty(state: GameState, perspective: PlayerColor, difficulty: BotDifficulty, budget: { nodes: number; deadline: number }) {
  if (state.status === "completed" || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) return 0;
  const replies = allLegalMoves(state)
    .map((move) => ({ move, score: staticMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(5, Math.floor(difficulty.beamWidth / 2)));
  let worst = 0;

  for (const { move } of replies) {
    const target = state.board[move.to.row]?.[move.to.col]?.piece;
    const attacker = state.board[move.from.row]?.[move.from.col]?.piece;
    if (target?.owner === perspective) {
      const targetValue = pieceValues[target.code] ?? 100;
      const attackerValue = attacker ? (pieceValues[attacker.code] ?? 100) : 100;
      worst = Math.max(worst, targetValue - attackerValue * 0.18);
    }

    const next = tryMove(state, move);
    budget.nodes += 1;
    if (next?.status === "completed" && next.result !== perspective && next.result !== "draw") {
      worst = Math.max(worst, 50000);
    }
  }

  return worst * (difficulty.skill / 20);
}

function mobilitySwing(previous: GameState, next: GameState, perspective: PlayerColor) {
  const beforeOwn = allLegalMovesFor(previous, perspective).length;
  const beforeOpponent = opponentColors(previous, perspective).reduce((total, color) => total + allLegalMovesFor(previous, color).length, 0);
  const afterOwn = allLegalMovesFor(next, perspective).length;
  const afterOpponent = opponentColors(next, perspective).reduce((total, color) => total + allLegalMovesFor(next, color).length, 0);
  return (afterOwn - beforeOwn) * 2 + (beforeOpponent - afterOpponent) * 3;
}

function forkPressureScore(state: GameState, perspective: PlayerColor) {
  const opponents = opponentColors(state, perspective);
  return allLegalMovesFor(state, perspective).reduce((best, move) => {
    const target = state.board[move.to.row]?.[move.to.col]?.piece;
    if (!target || !opponents.includes(target.owner)) return best;
    const value = pieceValues[target.code] ?? 100;
    const key = serializeMoveTarget(move);
    const duplicatePressure = allLegalMovesFor(state, perspective).filter((candidate) => serializeMoveTarget(candidate) !== key && sameSquare(candidate.from, move.from)).length;
    return Math.max(best, value * 0.08 + duplicatePressure * 8);
  }, 0);
}

function loosePieceScore(state: GameState, opponents: PlayerColor[]) {
  let score = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (!cell.piece || !opponents.includes(cell.piece.owner)) continue;
      const attackers = opponentColors(state, cell.piece.owner);
      const attacked = isSquareAttackedBy(state, cell.square, attackers);
      const defended = nearbyFriendlySupport(state, cell.square, cell.piece.owner) > 0;
      if (attacked && !defended) score += (pieceValues[cell.piece.code] ?? 100) * 0.1;
    }
  }
  return score;
}

function isSquareAttackedBy(state: GameState, square: { row: number; col: number }, attackers: PlayerColor[]) {
  return attackers.some((attacker) => allLegalMovesFor(state, attacker).some((move) => move.to.row === square.row && move.to.col === square.col));
}

function nearbyFriendlySupport(state: GameState, square: { row: number; col: number }, owner: PlayerColor) {
  let support = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (!cell.piece || cell.piece.owner !== owner) continue;
      const distance = Math.abs(cell.square.row - square.row) + Math.abs(cell.square.col - square.col);
      if (distance > 0 && distance <= 2) support += 1;
    }
  }
  return support;
}

function advancementScore(state: GameState, move: Move, owner: PlayerColor, code: string) {
  if (!["p", "s", "d", "w", "t", "l", "e", "r"].includes(code)) return 0;
  const rows = state.board.length;
  const forwardOwners: PlayerColor[] = ["white", "red", "sente"];
  const progress = forwardOwners.includes(owner) ? rows - 1 - move.to.row : move.to.row;
  return Math.max(0, progress) * (code === "p" || code === "s" ? 9 : 5);
}

function variantObjectiveScore(state: GameState, move: Move, owner: PlayerColor) {
  if (state.variantKey === "king-of-the-hill") {
    const centerRows = [Math.floor((state.board.length - 1) / 2), Math.ceil((state.board.length - 1) / 2)];
    const centerCols = [Math.floor(((state.board[0]?.length ?? 1) - 1) / 2), Math.ceil(((state.board[0]?.length ?? 1) - 1) / 2)];
    return centerRows.includes(move.to.row) && centerCols.includes(move.to.col) ? 500 : 0;
  }
  if (state.variantKey === "jungle") {
    const targetRow = owner === "white" ? 0 : state.board.length - 1;
    return Math.max(0, 18 - (Math.abs(move.to.row - targetRow) + Math.abs(move.to.col - 3)) * 3);
  }
  if (state.variantKey === "three-check") {
    return (state.checks[owner] ?? 0) * 80;
  }
  return 0;
}

function givesTurnPressure(state: GameState, perspective: PlayerColor) {
  const opponents = opponentColors(state, perspective);
  const enemyRoyal = opponents.map((color) => findRoyalSquare(state, color)).find(Boolean);
  return enemyRoyal ? attackedAround(state, enemyRoyal, perspective) > 0 : false;
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
  const canBeCaptured = isSquareAttackedBy(state, square, attackers);
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

function isLegalMove(state: GameState, move: Move) {
  return getLegalMoves(state, move.from).some((candidate) => sameSquare(candidate.to, move.to));
}

function windowSafeSetTimeout(callback: () => void, delayMs: number) {
  return setTimeout(callback, delayMs);
}

function deterministicNoise(move: Move) {
  const seed = (move.from.row + 1) * 17 + (move.from.col + 1) * 31 + (move.to.row + 1) * 43 + (move.to.col + 1) * 59;
  return (seed % 11) - 5;
}

function serializeMoveTarget(move: Move) {
  return `${move.from.row},${move.from.col}->${move.to.row},${move.to.col}`;
}

function confidenceFor(score: number | null, depth: number, tier: BotTierKey) {
  const tierFloor: Record<BotTierKey, number> = {
    easy: 0.34,
    normal: 0.45,
    hard: 0.56,
    "very-hard": 0.68,
    grandmaster: 0.82,
    legend: 0.9
  };
  const scoreSignal = Math.min(0.08, Math.abs(score ?? 0) / 24000);
  const depthSignal = Math.min(0.08, depth / 100);
  return Number(Math.min(0.99, tierFloor[tier] + scoreSignal + depthSignal).toFixed(2));
}

function difficultyFor(key: BotDifficultyKey) {
  return botDifficultyLevels.find((level) => level.key === key) ?? botDifficultyLevels[1];
}

function safeUci(state: GameState, move: Move) {
  try {
    return moveToUci(state, move);
  } catch {
    return "";
  }
}
