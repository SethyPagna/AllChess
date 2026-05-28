import { applyMove, getLegalMoves, sameSquare, type GameState, type Move, type PlayerColor } from "@/lib/variants";
import { lookupBotKnowledge, type BotKnowledgeSource, type BotMoveExplanation } from "@/lib/bot/training";
import { isStockfishRuntimeReady, moveToUci, requestStockfishMove, shouldUseStockfish, warmStockfishRuntime, type BotEngineMode } from "@/lib/bot/stockfish-engine";
import { botDifficultyLevels, MAX_BOT_REPLY_MS, type BotDifficulty, type BotDifficultyKey, type BotPlayStyle } from "@/lib/bot/config";
import type { BotStrengthBand, BotTierKey } from "@/lib/bot/strength";

const MIN_BOT_SEARCH_MS = 8;
const MAX_GLOBAL_TRANSPOSITIONS = 6000;
const BOT_REPLY_SAFETY_MS = 120;
const MAX_TERMINAL_THREAT_CANDIDATES = 32;
const MAX_TERMINAL_THREAT_REPLIES = 40;
const TERMINAL_THREAT_FILTER_VARIANTS = new Set(["classic", "chess960", "king-of-the-hill", "three-check"]);

export { botDifficultyLevels, MAX_BOT_REPLY_MS };
export type { BotDifficulty, BotDifficultyKey, BotPlayStyle };
export type { BotTierKey } from "@/lib/bot/strength";

export type BotSearchEfficiency = {
  cacheHits: number;
  cachedPositions: number;
  moveGenerationCalls: number;
  nodes: number;
  transpositionEntries: number;
  transpositionHits: number;
};

export type BotMoveResult = {
  requestId: string;
  status: "ok" | "no-legal-moves" | "cancelled" | "failed";
  engine: "stockfish" | "internal";
  tier: BotTierKey;
  strength: BotStrengthBand;
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
  legalValidated: boolean;
  depth: number;
  nodes: number;
  depthReached: number;
  nodesSearched: number;
  elapsedMs: number;
  validatedLegal: boolean;
  searchEfficiency?: BotSearchEfficiency;
  knowledgeSource?: BotKnowledgeSource;
  explanation?: BotMoveExplanation;
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

const pendingRequests = new Map<string, { cancelled: boolean }>();
const globalTranspositionCache = new Map<string, { depth: number; score: number }>();

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

type SearchBudget = {
  cacheHits: number;
  deadline: number;
  legalMovesCache: Map<string, Move[]>;
  moveGenerationCalls: number;
  nodes: number;
  transpositionCache: Map<string, { depth: number; score: number }>;
  transpositionHits: number;
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
  | {
      move: Move;
      reason: "ok";
      score: number;
      depthReached: number;
      nodesSearched: number;
      elapsedMs: number;
      validatedLegal: true;
      searchEfficiency: BotSearchEfficiency;
    }
  | { move: null; reason: "no-legal-moves" } {
  const startedAt = Date.now();
  const difficulty = botDifficultyLevels.find((level) => level.key === difficultyKey) ?? botDifficultyLevels[1];
  const searchTimeMs = boundedSearchTime(options.maxSearchTimeMs ?? difficulty.moveTimeMs, difficulty.moveTimeMs);
  const budget = createSearchBudget(startedAt, searchTimeMs);
  const legalMoves = allLegalMovesCached(state, budget);
  if (!legalMoves.length) {
    return { move: null, reason: "no-legal-moves" };
  }

  const perspective = state.turn;
  const terminalWin = legalMoves
    .map((move) => ({ move, next: tryMove(state, move) }))
    .find(({ next }) => next?.status === "completed" && next.result === perspective);
  if (terminalWin) {
    return {
      move: terminalWin.move,
      reason: "ok",
      score: 100000 - state.ply,
      depthReached: 1,
      nodesSearched: legalMoves.length,
      elapsedMs: Date.now() - startedAt,
      validatedLegal: true,
      searchEfficiency: searchEfficiencyFromBudget(budget)
    };
  }

  if (difficulty.skill >= 18) {
    const decisivePromotion = legalMoves.find((move) => {
      const piece = state.board[move.from.row]?.[move.from.col]?.piece;
      return piece?.code === "p" && (move.to.row === 0 || move.to.row === state.board.length - 1);
    });
    if (decisivePromotion) {
      return {
        move: decisivePromotion,
        reason: "ok",
        score: 18000,
        depthReached: 1,
        nodesSearched: legalMoves.length,
        elapsedMs: Date.now() - startedAt,
        validatedLegal: true,
        searchEfficiency: searchEfficiencyFromBudget(budget)
      };
    }
  }

  const candidateMoves = movesThatAvoidImmediateTerminalReply(state, legalMoves, perspective, difficulty, budget);
  const ranked = candidateMoves
    .map((move) => ({ move, score: evaluateMove(state, move, difficulty, perspective, budget) }))
    .sort((a, b) => b.score - a.score);

  const selected = selectRankedMove(ranked, difficulty);
  const depthReached = Math.max(1, Math.min(difficulty.depth, difficulty.depth - (Date.now() >= budget.deadline ? 1 : 0)));

  if (difficulty.key === "easy") {
    return {
      move: selected.move,
      reason: "ok",
      score: selected.score,
      depthReached,
      nodesSearched: budget.nodes,
      elapsedMs: Date.now() - startedAt,
      validatedLegal: true,
      searchEfficiency: searchEfficiencyFromBudget(budget)
    };
  }

  return {
    move: selected.move,
    reason: "ok",
    score: selected.score,
    depthReached,
    nodesSearched: budget.nodes,
    elapsedMs: Date.now() - startedAt,
    validatedLegal: true,
    searchEfficiency: searchEfficiencyFromBudget(budget)
  };
}

export function requestBotMove(state: GameState, difficultyKey: BotDifficultyKey = "normal", options: BotMoveOptions = {}): Promise<BotMoveResult> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const requestState = { cancelled: false };
  pendingRequests.set(requestId, requestState);
  const startedAt = Date.now();
  const tierConfig = difficultyFor(difficultyKey);
  const searchTimeMs = boundedSearchTime(options.maxSearchTimeMs ?? tierConfig.moveTimeMs, tierConfig.moveTimeMs);
  const hardDeadline = startedAt + Math.max(MIN_BOT_SEARCH_MS, Math.min(searchTimeMs, MAX_BOT_REPLY_MS - BOT_REPLY_SAFETY_MS));
  const remainingSearchMs = () => Math.max(MIN_BOT_SEARCH_MS, hardDeadline - Date.now());

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
          strength: tierConfig.strength,
          move: null,
          principalVariation: [],
          pv: [],
          reason: "cancelled",
          score: null,
          evaluation: null,
          confidence: 0,
          benchmarkVersion: tierConfig.benchmarkVersion,
          legal: false,
          legalValidated: false,
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
        const knowledge = lookupBotKnowledge(state, difficultyKey);
        if (knowledge && !requestState.cancelled) {
          if (knowledge.entry.confidence >= tierConfig.knowledgeMinimumConfidence) {
            finish({
              requestId,
              status: "ok",
              engine: "internal",
              tier: difficultyKey,
              strength: tierConfig.strength,
              move: knowledge.move,
              uciMove: knowledge.entry.moveUci,
              principalVariation: knowledge.principalVariation,
              pv: knowledge.principalVariation,
              reason: "ok",
              score: null,
              evaluation: null,
              confidence: knowledge.entry.confidence,
              benchmarkVersion: knowledge.entry.benchmarkVersion,
              legal: true,
              legalValidated: true,
              depth: 0,
              nodes: 1,
              depthReached: 0,
              nodesSearched: 1,
              elapsedMs: Date.now() - startedAt,
              validatedLegal: true,
              searchEfficiency: emptySearchEfficiency(1),
              knowledgeSource: knowledge.entry.source,
              explanation: knowledge.entry.explanation
            });
            return;
          }
        }

        if (shouldUseStockfish(state, options.engine ?? "auto")) {
          if (isStockfishRuntimeReady()) {
            const playedMoves = state.moves.map((move) => moveToUci(state, move));
            const stockfish = await requestStockfishMove(state, difficultyKey, playedMoves, remainingSearchMs());
            if (stockfish && !requestState.cancelled) {
              finish({
                requestId,
                status: "ok",
                engine: "stockfish",
                tier: difficultyKey,
                strength: tierConfig.strength,
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
                legalValidated: true,
                depth: stockfish.depthReached,
                nodes: stockfish.nodesSearched,
                depthReached: stockfish.depthReached,
                nodesSearched: stockfish.nodesSearched,
                elapsedMs: Date.now() - startedAt,
                validatedLegal: true,
                searchEfficiency: emptySearchEfficiency(stockfish.nodesSearched),
                knowledgeSource: "engine-search",
                explanation: explanationForMove("engine-search", state, stockfish.move, stockfish.evaluation, difficultyKey)
              });
              return;
            }
          } else {
            warmStockfishRuntime();
          }
        }

        const result = chooseBotMoveSafe(state, difficultyKey, { ...options, maxSearchTimeMs: remainingSearchMs() });
        if (!result.move) {
          finish({
            requestId,
            status: "no-legal-moves",
            engine: "internal",
            tier: difficultyKey,
            strength: tierConfig.strength,
            move: null,
            principalVariation: [],
            pv: [],
            reason: "no-legal-moves",
            score: null,
            evaluation: null,
            confidence: 0,
            benchmarkVersion: tierConfig.benchmarkVersion,
            legal: false,
            legalValidated: false,
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
          strength: tierConfig.strength,
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
          legalValidated: validatedLegal,
          depth: result.depthReached,
          nodes: result.nodesSearched,
          depthReached: result.depthReached,
          nodesSearched: result.nodesSearched,
          elapsedMs: Date.now() - startedAt,
          validatedLegal,
          searchEfficiency: result.searchEfficiency,
          knowledgeSource: "internal-search",
          explanation: validatedLegal ? explanationForMove("internal-search", state, result.move, result.score, difficultyKey) : undefined,
          error: validatedLegal ? undefined : "Bot selected an illegal move."
        });
      } catch (error) {
        finish({
          requestId,
          status: "failed",
          engine: "internal",
          tier: difficultyKey,
          strength: tierConfig.strength,
          move: null,
          principalVariation: [],
          pv: [],
          reason: "failed",
          score: null,
          evaluation: null,
          confidence: 0,
          benchmarkVersion: tierConfig.benchmarkVersion,
          legal: false,
          legalValidated: false,
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

export function allLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];

  for (const row of state.board) {
    for (const cell of row) {
      moves.push(...getLegalMoves(state, cell.square));
    }
  }

  return moves;
}

function createSearchBudget(startedAt: number, searchTimeMs: number): SearchBudget {
  return {
    cacheHits: 0,
    deadline: startedAt + searchTimeMs,
    legalMovesCache: new Map(),
    moveGenerationCalls: 0,
    nodes: 0,
    transpositionCache: new Map(),
    transpositionHits: 0
  };
}

function emptySearchEfficiency(nodes: number = 0): BotSearchEfficiency {
  return {
    cacheHits: 0,
    cachedPositions: 0,
    moveGenerationCalls: 0,
    nodes,
    transpositionEntries: 0,
    transpositionHits: 0
  };
}

function searchEfficiencyFromBudget(budget: SearchBudget): BotSearchEfficiency {
  return {
    cacheHits: budget.cacheHits,
    cachedPositions: budget.legalMovesCache.size,
    moveGenerationCalls: budget.moveGenerationCalls,
    nodes: budget.nodes,
    transpositionEntries: budget.transpositionCache.size,
    transpositionHits: budget.transpositionHits
  };
}

function allLegalMovesCached(state: GameState, budget: SearchBudget) {
  const key = searchStateKey(state);
  const cached = budget.legalMovesCache.get(key);
  if (cached) {
    budget.cacheHits += 1;
    return cached;
  }

  const moves = allLegalMoves(state);
  budget.moveGenerationCalls += 1;
  budget.legalMovesCache.set(key, moves);
  return moves;
}

function searchStateKey(state: GameState) {
  const board = state.board
    .map((row) => row.map((cell) => (cell.piece ? `${cell.piece.owner[0]}${cell.piece.code}${cell.piece.promoted ? "+" : ""}` : "--")).join(""))
    .join("/");
  return `${state.variantKey}|${state.turn}|${state.status}|${state.result ?? ""}|${state.ply}|${board}`;
}

function transpositionKey(state: GameState, perspective: PlayerColor, depth: number) {
  return `${searchStateKey(state)}|perspective:${perspective}|depth:${depth}`;
}

function evaluateMove(
  state: GameState,
  move: Move,
  difficulty: BotDifficulty,
  perspective: PlayerColor,
  budget: SearchBudget
) {
  if (difficulty.key === "easy") {
    return beginnerMoveScore(state, move, perspective, difficulty, budget);
  }

  const next = tryMove(state, move);
  if (!next) return Number.NEGATIVE_INFINITY;
  if (next.status === "completed") {
    return evaluateState(next, perspective, budget);
  }

  const searchDepth = Math.max(0, difficulty.depth - 1);
  const searchScore = minimax(next, searchDepth, perspective, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, difficulty, budget);
  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  const riskPenalty = movedPiece && difficulty.skill >= 6 ? hangingPenalty(next, move.to, movedPiece) * (1 - difficulty.riskTolerance) : 0;
  const tradePenalty = movedPiece && difficulty.skill < 18 ? badTradePenalty(state, next, move, movedPiece, budget) * (1 - difficulty.riskTolerance) : 0;
  const strategyBonus = difficulty.skill >= 9 ? strategicMoveScore(state, next, move, perspective, difficulty, budget) : 0;
  const rescueBonus = movedPiece && difficulty.skill >= 6 ? escapeOrCounterScore(state, next, move, movedPiece, difficulty, budget) : 0;
  const replyPenalty = difficulty.skill >= 6 ? opponentReplyPenalty(next, perspective, difficulty, budget) * (1.15 - difficulty.riskTolerance) : 0;
  const noise = difficulty.skill >= 20 ? 0 : deterministicNoise(move) * (22 - difficulty.skill);
  return searchScore + strategyBonus + rescueBonus - riskPenalty - tradePenalty - replyPenalty + noise;
}

function selectRankedMove(ranked: Array<{ move: Move; score: number }>, difficulty: BotDifficulty) {
  if (difficulty.key !== "easy") return ranked[0];
  const bestScore = ranked[0]?.score ?? 0;
  const safeMoves = ranked.filter((entry) => entry.score >= bestScore - 28);
  return safeMoves[0] ?? ranked[0];
}

function movesThatAvoidImmediateTerminalReply(
  state: GameState,
  legalMoves: Move[],
  perspective: PlayerColor,
  difficulty: BotDifficulty,
  budget: SearchBudget
) {
  if (!TERMINAL_THREAT_FILTER_VARIANTS.has(state.variantKey) || difficulty.skill < 8 || difficulty.skill > 14 || legalMoves.length > MAX_TERMINAL_THREAT_CANDIDATES) return legalMoves;

  let lowestThreatCount = Number.POSITIVE_INFINITY;
  const lowestThreatMoves: Move[] = [];
  const saferMoves = legalMoves.filter((move) => {
    const next = tryMove(state, move);
    if (!next) return false;
    if (next.status === "completed") return next.result === perspective || next.result === "draw";
    const terminalReplyCount = countImmediateTerminalReplies(next, perspective, difficulty, budget);
    if (terminalReplyCount < lowestThreatCount) {
      lowestThreatCount = terminalReplyCount;
      lowestThreatMoves.length = 0;
    }
    if (terminalReplyCount === lowestThreatCount) lowestThreatMoves.push(move);
    return terminalReplyCount === 0;
  });

  return saferMoves.length ? saferMoves : lowestThreatMoves.length ? lowestThreatMoves : legalMoves;
}

function countImmediateTerminalReplies(state: GameState, perspective: PlayerColor, difficulty: BotDifficulty, budget: SearchBudget) {
  if (state.status === "completed") return state.result !== "draw" && state.result !== perspective ? 1 : 0;

  const legalReplies = allLegalMovesCached(state, budget);
  const repliesToScan =
    legalReplies.length <= MAX_TERMINAL_THREAT_REPLIES
      ? legalReplies
      : legalReplies
          .map((move) => ({ move, score: staticMoveScore(state, move) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, difficulty.replyCheckWidth)
          .map(({ move }) => move);

  return repliesToScan.reduce((total, reply) => {
    const next = tryMove(state, reply);
    return total + (next?.status === "completed" && next.result !== "draw" && next.result !== perspective ? 1 : 0);
  }, 0);
}

function beginnerMoveScore(state: GameState, move: Move, perspective: PlayerColor, difficulty: BotDifficulty, budget: SearchBudget) {
  const next = tryMove(state, move);
  if (!next) return Number.NEGATIVE_INFINITY;
  if (next.status === "completed") return evaluateState(next, perspective, budget);

  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  const staticScore = staticMoveScore(state, move);
  const movedValue = movedPiece ? pieceValues[movedPiece.code] ?? 100 : 100;
  const immediateDanger = movedPiece ? hangingPenalty(next, move.to, movedPiece) * 0.9 : 0;
  const tradeRisk = movedPiece ? badTradePenalty(state, next, move, movedPiece, budget) * 0.8 : 0;
  const support = movedPiece ? nearbyFriendlySupport(next, move.to, movedPiece.owner) * 20 : 0;
  const objective = movedPiece ? variantObjectiveScore(next, move, movedPiece.owner) * 0.65 : 0;
  const rescue = movedPiece ? escapeOrCounterScore(state, next, move, movedPiece, difficulty, budget) * 0.55 : 0;
  const replyPenalty = opponentReplyPenalty(next, perspective, difficulty, budget) * 0.72;
  const naiveNoise = deterministicNoise(move) * 2;
  const retreatBonus = movedPiece && movedValue >= 500 && immediateDanger === 0 ? 26 : 0;

  return staticScore + support + objective + rescue + retreatBonus - immediateDanger - tradeRisk - replyPenalty + naiveNoise;
}

function minimax(
  state: GameState,
  depth: number,
  perspective: PlayerColor,
  alpha: number,
  beta: number,
  difficulty: BotDifficulty,
  budget: SearchBudget
): number {
  const cacheKey = transpositionKey(state, perspective, depth);
  const cached = budget.transpositionCache.get(cacheKey);
  if (cached && cached.depth >= depth) {
    budget.transpositionHits += 1;
    return cached.score;
  }
  const globalCached = getGlobalTransposition(cacheKey, depth);
  if (globalCached) {
    budget.transpositionHits += 1;
    budget.transpositionCache.set(cacheKey, globalCached);
    return globalCached.score;
  }

  budget.nodes += 1;
  if (state.status === "completed" || depth <= 0 || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) {
    const score = quiescence(state, difficulty.quiescenceDepth, perspective, alpha, beta, difficulty, budget);
    rememberTransposition(budget, cacheKey, depth, score);
    return score;
  }

  const moves = allLegalMovesCached(state, budget)
    .map((move) => ({ move, score: moveOrderingScore(state, move, difficulty, budget) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, difficulty.beamWidth);

  if (!moves.length) return evaluateState(state, perspective, budget);

  const maximizing = state.turn === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  let pruned = false;

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
    if (beta <= alpha) {
      pruned = true;
      break;
    }
  }

  if (!pruned) rememberTransposition(budget, cacheKey, depth, best);
  return best;
}

function getGlobalTransposition(key: string, minimumDepth: number) {
  const cached = globalTranspositionCache.get(key);
  if (!cached || cached.depth < minimumDepth) return null;
  globalTranspositionCache.delete(key);
  globalTranspositionCache.set(key, cached);
  return cached;
}

function rememberTransposition(budget: SearchBudget, key: string, depth: number, score: number) {
  const entry = { depth, score };
  budget.transpositionCache.set(key, entry);
  globalTranspositionCache.set(key, entry);
  while (globalTranspositionCache.size > MAX_GLOBAL_TRANSPOSITIONS) {
    const oldestKey = globalTranspositionCache.keys().next().value;
    if (!oldestKey) break;
    globalTranspositionCache.delete(oldestKey);
  }
}

function quiescence(
  state: GameState,
  depth: number,
  perspective: PlayerColor,
  alpha: number,
  beta: number,
  difficulty: BotDifficulty,
  budget: SearchBudget
): number {
  let best = evaluateState(state, perspective, budget);
  if (depth <= 0 || state.status === "completed" || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) return best;

  const tacticalMoves = allLegalMovesCached(state, budget)
    .filter((move) => isCapture(state, move) || staticMoveScore(state, move) >= 700)
    .map((move) => ({ move, score: moveOrderingScore(state, move, difficulty, budget) }))
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

function evaluateState(state: GameState, perspective: PlayerColor, budget?: SearchBudget) {
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

  const activeMobility = (budget ? allLegalMovesCached(state, budget) : allLegalMoves(state)).length * (state.turn === perspective ? 5 : -5);
  const position = positionalScore(state, perspective);
  const royalSafety = royalSafetyScore(state, perspective);
  const tacticalPressure = tacticalStateScore(state, perspective, budget);
  const endgamePlan = endgameConversionScore(state, perspective, budget);
  return material + activeMobility + position + royalSafety + tacticalPressure + endgamePlan;
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

function moveOrderingScore(state: GameState, move: Move, difficulty: BotDifficulty, budget: SearchBudget) {
  const staticScore = staticMoveScore(state, move);
  if (difficulty.skill < 8) return staticScore;

  const movingPiece = state.board[move.from.row]?.[move.from.col]?.piece;
  const targetPiece = state.board[move.to.row]?.[move.to.col]?.piece;
  if (!movingPiece || !targetPiece || targetPiece.owner === movingPiece.owner || Date.now() >= budget.deadline) return staticScore;

  const next = tryMove(state, move);
  if (!next) return Number.NEGATIVE_INFINITY;

  const tradeAwareness = difficulty.skill >= 14 ? 1.1 : 0.75;
  return staticScore - badTradePenalty(state, next, move, movingPiece, budget) * (tradeAwareness - difficulty.riskTolerance);
}

function strategicMoveScore(state: GameState, next: GameState, move: Move, perspective: PlayerColor, difficulty: BotDifficulty, budget: SearchBudget) {
  const movedPiece = next.board[move.to.row]?.[move.to.col]?.piece;
  if (!movedPiece) return 0;
  const opponents = opponentColors(next, perspective);
  const attacksAfter = allLegalMovesFor(next, perspective, budget);
  const newThreats = attacksAfter.reduce((total, candidate) => {
    const target = next.board[candidate.to.row]?.[candidate.to.col]?.piece;
    return total + (target && opponents.includes(target.owner) ? (pieceValues[target.code] ?? 100) * 0.12 : 0);
  }, 0);
  const ownDanger = isSquareAttackedBy(next, move.to, opponents) ? (pieceValues[movedPiece.code] ?? 100) * 0.18 : 0;
  const ownSupport = nearbyFriendlySupport(next, move.to, movedPiece.owner) * 18;
  const advancement = advancementScore(state, move, movedPiece.owner, movedPiece.code) * (difficulty.skill / 10);
  const objective = variantObjectiveScore(next, move, movedPiece.owner) * (difficulty.skill / 8);
  const constriction = mobilitySwing(state, next, perspective, budget) * (difficulty.skill / 20);
  const forkPressure = forkPressureScore(next, perspective, budget) * (difficulty.skill / 18);
  const loosePiecePressure = loosePieceScore(next, opponents, budget) * (difficulty.skill / 18);
  const tempo = givesTurnPressure(next, perspective) ? 45 : 0;
  const deepPlan =
    difficulty.skill >= 14
      ? deepStrategicPlanScore(state, next, move, perspective, difficulty, budget)
      : 0;
  return newThreats + ownSupport + advancement + objective + constriction + forkPressure + loosePiecePressure + tempo + deepPlan - ownDanger;
}

function escapeOrCounterScore(
  state: GameState,
  next: GameState,
  move: Move,
  movedPiece: { code: string; owner: PlayerColor },
  difficulty: BotDifficulty,
  budget: SearchBudget
) {
  const attackers = opponentColors(state, movedPiece.owner);
  const wasAttacked = isSquareAttackedBy(state, move.from, attackers, budget);
  if (!wasAttacked) return 0;

  const value = pieceValues[movedPiece.code] ?? 100;
  const target = state.board[move.to.row]?.[move.to.col]?.piece;
  const capturedValue = target && attackers.includes(target.owner) ? pieceValues[target.code] ?? 100 : 0;
  const stillAttacked = isSquareAttackedBy(next, move.to, opponentColors(next, movedPiece.owner), budget);
  const safeLanding = stillAttacked ? -value * 0.28 : value * 0.34;
  const counterattack = capturedValue ? capturedValue * (difficulty.skill >= 14 ? 0.42 : 0.28) : 0;
  const support = nearbyFriendlySupport(next, move.to, movedPiece.owner) * 12;

  return safeLanding + counterattack + support;
}

function opponentReplyPenalty(state: GameState, perspective: PlayerColor, difficulty: BotDifficulty, budget: SearchBudget) {
  if (state.status === "completed" || budget.nodes >= difficulty.nodeBudget || Date.now() >= budget.deadline) return 0;
  const replies = allLegalMovesCached(state, budget)
    .map((move) => ({ move, score: staticMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, difficulty.replyCheckWidth);
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
    } else if (next && difficulty.skill >= 14) {
      const recovery = bestCounterplayScore(next, perspective, difficulty, budget);
      worst = Math.max(0, worst - recovery * 0.2);
    }
  }

  return worst * (difficulty.skill / 20);
}

function deepStrategicPlanScore(
  state: GameState,
  next: GameState,
  move: Move,
  perspective: PlayerColor,
  difficulty: BotDifficulty,
  budget: SearchBudget
) {
  const pressureGain = tacticalStateScore(next, perspective, budget) - tacticalStateScore(state, perspective, budget);
  const kingNetGain = kingNetScore(next, perspective, budget) - kingNetScore(state, perspective, budget);
  const conversionGain = endgameConversionScore(next, perspective, budget) - endgameConversionScore(state, perspective, budget);
  const sacrificeCompensation = sacrificeCompensationScore(state, next, move, perspective, difficulty, budget);
  const drawResource = drawSavingResourceScore(state, next, perspective, budget);
  const scale = difficulty.key === "legend" ? 1.2 : difficulty.key === "grandmaster" ? 1.05 : 0.8;

  return (pressureGain * 0.55 + kingNetGain * 0.85 + conversionGain * 0.65 + sacrificeCompensation + drawResource) * scale;
}

function tacticalStateScore(state: GameState, perspective: PlayerColor, budget?: SearchBudget) {
  const ownProfile = threatProfile(state, perspective, budget);
  const opponentProfile = opponentColors(state, perspective).reduce(
    (total, color) => addThreatProfiles(total, threatProfile(state, color, budget)),
    emptyThreatProfile()
  );

  return (
    ownProfile.captureValue * 0.2 +
    ownProfile.looseTargetValue * 0.42 +
    ownProfile.supportedTargetValue * 0.18 +
    ownProfile.kingPressure * 26 -
    opponentProfile.captureValue * 0.22 -
    opponentProfile.looseTargetValue * 0.5 -
    opponentProfile.supportedTargetValue * 0.14 -
    opponentProfile.kingPressure * 31
  );
}

function threatProfile(state: GameState, color: PlayerColor, budget?: SearchBudget) {
  const profile = emptyThreatProfile();
  const opponents = opponentColors(state, color);
  const enemyRoyal = opponents.map((opponent) => findRoyalSquare(state, opponent)).find(Boolean);

  for (const move of allLegalMovesFor(state, color, budget)) {
    const target = state.board[move.to.row]?.[move.to.col]?.piece;
    if (target && opponents.includes(target.owner)) {
      const targetValue = pieceValues[target.code] ?? 100;
      profile.captureValue += targetValue;
      if (nearbyFriendlySupport(state, move.to, target.owner) === 0) {
        profile.looseTargetValue += targetValue;
      } else {
        profile.supportedTargetValue += targetValue;
      }
    }
    if (enemyRoyal && squareDistance(move.to, enemyRoyal) <= 1) {
      profile.kingPressure += 1;
    }
  }

  return profile;
}

function emptyThreatProfile() {
  return {
    captureValue: 0,
    kingPressure: 0,
    looseTargetValue: 0,
    supportedTargetValue: 0
  };
}

function addThreatProfiles(left: ReturnType<typeof emptyThreatProfile>, right: ReturnType<typeof emptyThreatProfile>) {
  return {
    captureValue: left.captureValue + right.captureValue,
    kingPressure: left.kingPressure + right.kingPressure,
    looseTargetValue: left.looseTargetValue + right.looseTargetValue,
    supportedTargetValue: left.supportedTargetValue + right.supportedTargetValue
  };
}

function kingNetScore(state: GameState, perspective: PlayerColor, budget?: SearchBudget) {
  const enemyRoyal = opponentColors(state, perspective).map((color) => findRoyalSquare(state, color)).find(Boolean);
  const ownRoyal = findRoyalSquare(state, perspective);
  const enemyNet = enemyRoyal ? royalNetPressure(state, enemyRoyal, perspective, budget) : 0;
  const ownNet = ownRoyal ? royalNetPressure(state, ownRoyal, opponentColors(state, perspective)[0] ?? perspective, budget) : 0;
  return enemyNet - ownNet * 1.2;
}

function royalNetPressure(state: GameState, royal: { row: number; col: number }, attacker: PlayerColor, budget?: SearchBudget) {
  const attackSquares = new Set(allLegalMovesFor(state, attacker, budget).map((move) => `${move.to.row}:${move.to.col}`));
  let pressure = 0;
  for (let row = royal.row - 1; row <= royal.row + 1; row += 1) {
    for (let col = royal.col - 1; col <= royal.col + 1; col += 1) {
      if (row === royal.row && col === royal.col) continue;
      if (row < 0 || col < 0 || row >= state.board.length || col >= (state.board[0]?.length ?? 0)) continue;
      if (attackSquares.has(`${row}:${col}`)) pressure += 28;
      const occupant = state.board[row]?.[col]?.piece;
      if (occupant && occupant.owner !== attacker) pressure += 10;
    }
  }
  return pressure;
}

function endgameConversionScore(state: GameState, perspective: PlayerColor, budget?: SearchBudget) {
  const material = materialOnlyScore(state, perspective);
  const passedPawns = passedPawnScore(state, perspective);
  const mobility = allLegalMovesFor(state, perspective, budget).length;
  const opponentMobility = opponentColors(state, perspective).reduce((total, color) => total + allLegalMovesFor(state, color, budget).length, 0);
  const squeeze = Math.max(0, mobility - opponentMobility) * (material >= 0 ? 5 : 2);
  const drawFortress = material < -350 && opponentMobility <= 4 ? 120 : 0;
  return passedPawns + squeeze + drawFortress;
}

function sacrificeCompensationScore(
  state: GameState,
  next: GameState,
  move: Move,
  perspective: PlayerColor,
  difficulty: BotDifficulty,
  budget: SearchBudget
) {
  const materialDelta = materialOnlyScore(next, perspective) - materialOnlyScore(state, perspective);
  if (materialDelta >= -160) return 0;

  const pressureGain = tacticalStateScore(next, perspective, budget) - tacticalStateScore(state, perspective, budget);
  const kingPressure = kingNetScore(next, perspective, budget);
  const objective = variantObjectiveScore(next, move, perspective);
  const compensation = pressureGain * 0.65 + kingPressure * 0.8 + objective;
  const requiredCompensation = Math.abs(materialDelta) * (difficulty.key === "legend" ? 0.55 : 0.7);
  return compensation > requiredCompensation ? compensation - requiredCompensation : materialDelta * 0.35;
}

function drawSavingResourceScore(state: GameState, next: GameState, perspective: PlayerColor, budget: SearchBudget) {
  if (materialOnlyScore(state, perspective) > -450) return 0;
  const beforeOpponentMoves = opponentColors(state, perspective).reduce((total, color) => total + allLegalMovesFor(state, color, budget).length, 0);
  const afterOpponentMoves = opponentColors(next, perspective).reduce((total, color) => total + allLegalMovesFor(next, color, budget).length, 0);
  const reducedMobility = Math.max(0, beforeOpponentMoves - afterOpponentMoves) * 18;
  return reducedMobility + (next.status === "completed" && next.result === "draw" ? 2000 : 0);
}

function bestCounterplayScore(state: GameState, perspective: PlayerColor, difficulty: BotDifficulty, budget: SearchBudget) {
  if (state.turn !== perspective || Date.now() >= budget.deadline || budget.nodes >= difficulty.nodeBudget) return 0;
  return allLegalMovesCached(state, budget)
    .map((move) => staticMoveScore(state, move) + tacticalMovePressure(state, move, perspective, budget))
    .sort((a, b) => b - a)
    .at(0) ?? 0;
}

function tacticalMovePressure(state: GameState, move: Move, perspective: PlayerColor, budget: SearchBudget) {
  const next = tryMove(state, move);
  if (!next) return 0;
  return Math.max(0, tacticalStateScore(next, perspective, budget) - tacticalStateScore(state, perspective, budget));
}

function mobilitySwing(previous: GameState, next: GameState, perspective: PlayerColor, budget: SearchBudget) {
  const beforeOwn = allLegalMovesFor(previous, perspective, budget).length;
  const beforeOpponent = opponentColors(previous, perspective).reduce((total, color) => total + allLegalMovesFor(previous, color, budget).length, 0);
  const afterOwn = allLegalMovesFor(next, perspective, budget).length;
  const afterOpponent = opponentColors(next, perspective).reduce((total, color) => total + allLegalMovesFor(next, color, budget).length, 0);
  return (afterOwn - beforeOwn) * 2 + (beforeOpponent - afterOpponent) * 3;
}

function forkPressureScore(state: GameState, perspective: PlayerColor, budget: SearchBudget) {
  const opponents = opponentColors(state, perspective);
  const moves = allLegalMovesFor(state, perspective, budget);
  const moveCountBySource = new Map<string, number>();
  for (const move of moves) {
    const key = serializeMoveSource(move);
    moveCountBySource.set(key, (moveCountBySource.get(key) ?? 0) + 1);
  }

  return moves.reduce((best, move) => {
    const target = state.board[move.to.row]?.[move.to.col]?.piece;
    if (!target || !opponents.includes(target.owner)) return best;
    const value = pieceValues[target.code] ?? 100;
    const duplicatePressure = Math.max(0, (moveCountBySource.get(serializeMoveSource(move)) ?? 0) - 1);
    return Math.max(best, value * 0.08 + duplicatePressure * 8);
  }, 0);
}

function loosePieceScore(state: GameState, opponents: PlayerColor[], budget: SearchBudget) {
  let score = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (!cell.piece || !opponents.includes(cell.piece.owner)) continue;
      const attackers = opponentColors(state, cell.piece.owner);
      const attacked = isSquareAttackedBy(state, cell.square, attackers, budget);
      const defended = nearbyFriendlySupport(state, cell.square, cell.piece.owner) > 0;
      if (attacked && !defended) score += (pieceValues[cell.piece.code] ?? 100) * 0.1;
    }
  }
  return score;
}

function isSquareAttackedBy(state: GameState, square: { row: number; col: number }, attackers: PlayerColor[], budget?: SearchBudget) {
  return attackers.some((attacker) => allLegalMovesFor(state, attacker, budget).some((move) => move.to.row === square.row && move.to.col === square.col));
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

function materialOnlyScore(state: GameState, perspective: PlayerColor) {
  return state.board.reduce((total, row) => {
    return (
      total +
      row.reduce((rowTotal, cell) => {
        if (!cell.piece) return rowTotal;
        const value = pieceValues[cell.piece.code] ?? 100;
        return rowTotal + (cell.piece.owner === perspective ? value : -value);
      }, 0)
    );
  }, 0);
}

function passedPawnScore(state: GameState, perspective: PlayerColor) {
  let score = 0;
  for (const row of state.board) {
    for (const cell of row) {
      const piece = cell.piece;
      if (!piece || piece.owner !== perspective || !["p", "s"].includes(piece.code)) continue;
      const direction = ["white", "red", "sente"].includes(piece.owner) ? -1 : 1;
      const promotionDistance = direction < 0 ? cell.square.row : state.board.length - 1 - cell.square.row;
      const blockers = opponentColors(state, perspective).some((opponent) =>
        state.board.some((scanRow) =>
          scanRow.some((scanCell) => {
            const occupant = scanCell.piece;
            if (!occupant || occupant.owner !== opponent || !["p", "s"].includes(occupant.code)) return false;
            const sameOrAdjacentFile = Math.abs(scanCell.square.col - cell.square.col) <= 1;
            const inFront = direction < 0 ? scanCell.square.row < cell.square.row : scanCell.square.row > cell.square.row;
            return sameOrAdjacentFile && inFront;
          })
        )
      );
      if (!blockers) score += Math.max(0, 7 - promotionDistance) * 22;
    }
  }
  return score;
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

function badTradePenalty(
  previous: GameState,
  next: GameState,
  move: Move,
  movedPiece: { code: string; owner: PlayerColor },
  budget: SearchBudget
) {
  const captured = previous.board[move.to.row]?.[move.to.col]?.piece;
  if (!captured || captured.owner === movedPiece.owner) return 0;

  const attackers = opponentColors(next, movedPiece.owner);
  if (!isSquareAttackedBy(next, move.to, attackers, budget)) return 0;

  const movedValue = pieceValues[movedPiece.code] ?? 100;
  const capturedValue = pieceValues[captured.code] ?? 100;
  return Math.max(0, movedValue - capturedValue) * 0.8;
}

function allLegalMovesFor(state: GameState, color: PlayerColor, budget?: SearchBudget) {
  const colorState = state.turn === color ? state : { ...state, turn: color };
  return budget ? allLegalMovesCached(colorState, budget) : allLegalMoves(colorState);
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

function serializeMoveSource(move: Move) {
  return `${move.from.row},${move.from.col}`;
}

function squareDistance(left: { row: number; col: number }, right: { row: number; col: number }) {
  return Math.max(Math.abs(left.row - right.row), Math.abs(left.col - right.col));
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

function explanationForMove(source: BotKnowledgeSource, state: GameState, move: Move, score: number | null, tier: BotTierKey): BotMoveExplanation {
  const moving = state.board[move.from.row]?.[move.from.col]?.piece;
  const target = state.board[move.to.row]?.[move.to.col]?.piece;
  const captureValue = target ? pieceValues[target.code] ?? 100 : 0;
  const tierPrefix = tier === "grandmaster" || tier === "legend" ? "Deep tier" : "Search";
  const attackers = moving ? opponentColors(state, moving.owner) : [];
  const wasAttacked = moving ? isSquareAttackedBy(state, move.from, attackers) : false;
  const next = tryMove(state, move);
  const remainsAttacked = moving && next ? isSquareAttackedBy(next, move.to, opponentColors(next, moving.owner)) : false;
  const movingLabel = moving?.code ? pieceLabel(moving.code) : "piece";
  const plan = planForMove({ captureValue, movingLabel, targetCode: target?.code, tierPrefix, wasAttacked });
  const threat = target
    ? `It removes an opposing ${pieceLabel(target.code)} and looks for follow-up pressure.`
    : "It increases mobility, central control, or variant-objective pressure without relying on a single tactic.";
  const risk = riskForMove({
    movingLabel,
    remainsAttacked,
    score,
    terminalThreatDefense: terminalThreatDefenseText(state, next, moving?.owner, tier),
    tradeSafety: tradeSafetyText({ moving: moving ?? undefined, next, target: target ?? undefined, move }),
    wasAttacked
  });
  const fallbackGoal = score !== null && score < -600 ? "If the advantage cannot be recovered, steer toward draw or stalemate-saving resources." : "If the opponent parries the main idea, keep development and defended pieces intact.";
  return { plan, threat: `${source}: ${threat}`, risk, fallbackGoal };
}

function planForMove({
  captureValue,
  movingLabel,
  targetCode,
  tierPrefix,
  wasAttacked
}: {
  captureValue: number;
  movingLabel: string;
  targetCode?: string;
  tierPrefix: string;
  wasAttacked: boolean;
}) {
  if (wasAttacked && targetCode) {
    return `${tierPrefix} turns an attacked ${movingLabel} into a counterattack, taking a ${pieceLabel(targetCode)} worth ${captureValue}.`;
  }
  if (wasAttacked) {
    return `${tierPrefix} rescues an attacked ${movingLabel} while checking the opponent's replies.`;
  }
  if (targetCode) {
    return `${tierPrefix} chooses a capture worth ${captureValue} while checking the reply tree before committing.`;
  }
  return `${tierPrefix} improves ${movingLabel} activity and keeps legal replies under review.`;
}

function riskForMove({
  movingLabel,
  remainsAttacked,
  score,
  terminalThreatDefense,
  tradeSafety,
  wasAttacked
}: {
  movingLabel: string;
  remainsAttacked: boolean;
  score: number | null;
  terminalThreatDefense?: string;
  tradeSafety?: string;
  wasAttacked: boolean;
}) {
  if (tradeSafety) return tradeSafety;
  if (terminalThreatDefense) return terminalThreatDefense;
  if (wasAttacked && !remainsAttacked) return `Risk reduced: the ${movingLabel} leaves immediate danger instead of staying loose.`;
  if (wasAttacked && remainsAttacked) return `Risk accepted: the ${movingLabel} is still tactically exposed, so the bot expects compensation.`;
  if (score !== null && score < -250) return "The position is worse, so the bot favors damage control and avoids forcing a losing race.";
  return "The move was filtered for immediate hanging-piece and terminal-state blunders.";
}

function terminalThreatDefenseText(state: GameState, next: GameState | null, perspective: PlayerColor | undefined, tier: BotTierKey) {
  const difficulty = difficultyFor(tier);
  if (!next || !perspective || !TERMINAL_THREAT_FILTER_VARIANTS.has(state.variantKey) || difficulty.skill < 8 || difficulty.skill > 14) return undefined;

  const explanationBudgetMs = Math.min(MAX_BOT_REPLY_MS, Math.max(160, Math.min(240, difficulty.moveTimeMs)));
  const beforeThreatState = { ...state, turn: next.turn };
  const beforeThreats = countImmediateTerminalReplies(beforeThreatState, perspective, difficulty, createSearchBudget(Date.now(), explanationBudgetMs));
  const afterThreats = countImmediateTerminalReplies(next, perspective, difficulty, createSearchBudget(Date.now(), explanationBudgetMs));
  if (afterThreats >= beforeThreats) return undefined;

  return `Threat defense: reduced opponent one-move winning replies from ${beforeThreats} to ${afterThreats}.`;
}

function tradeSafetyText({
  move,
  moving,
  next,
  target
}: {
  move: Move;
  moving?: { code: string; owner: PlayerColor };
  next: GameState | null;
  target?: { code: string; owner: PlayerColor } | null;
}) {
  if (!moving || !target || !next || target.owner === moving.owner) return undefined;

  const movingValue = pieceValues[moving.code] ?? 100;
  const targetValue = pieceValues[target.code] ?? 100;
  const canBeRecaptured = isSquareAttackedBy(next, move.to, opponentColors(next, moving.owner));
  if (!canBeRecaptured) return `Trade checked: the ${pieceLabel(target.code)} capture is not immediately recaptured.`;
  if (targetValue >= movingValue) return `Trade checked: recapture is possible, but the exchange wins at least equal value.`;

  return `Trade risk checked: the ${pieceLabel(moving.code)} would be worth more than the captured ${pieceLabel(target.code)}, so this needed compensation.`;
}

function pieceLabel(code: string) {
  const labels: Record<string, string> = {
    a: "advisor",
    b: "bishop",
    c: "cannon",
    d: "dog",
    e: "elephant",
    g: "general",
    h: "horse",
    k: "king",
    l: "lance",
    n: "knight",
    p: "pawn",
    q: "queen",
    r: "rook",
    s: "soldier",
    t: "tiger",
    w: "wolf"
  };
  return labels[code] ?? "piece";
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

function boundedSearchTime(requestedMs: number, tierMs: number) {
  return Math.max(MIN_BOT_SEARCH_MS, Math.min(requestedMs, tierMs, MAX_BOT_REPLY_MS));
}
