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

export type StockfishSearchResult = {
  move: Move;
  uciMove: string;
  principalVariation: string[];
  depthReached: number;
  nodesSearched: number;
  evaluation: number | null;
};

const configs: Record<BotDifficultyKey, StockfishDifficultyConfig> = {
  easy: { limitStrength: true, elo: 900, skillLevel: 2, moveTimeMs: 120, depth: 2 },
  normal: { limitStrength: true, elo: 1400, skillLevel: 6, moveTimeMs: 250, depth: 4 },
  hard: { limitStrength: true, elo: 1900, skillLevel: 10, moveTimeMs: 500, depth: 7 },
  "very-hard": { limitStrength: true, elo: 2300, skillLevel: 14, moveTimeMs: 900, depth: 10 },
  grandmaster: { limitStrength: true, elo: 2850, skillLevel: 18, moveTimeMs: 1800, depth: 16 },
  legend: { limitStrength: false, elo: 3400, skillLevel: 20, moveTimeMs: 3200, depth: 22 }
};

export function shouldUseStockfish(state: GameState, engine: BotEngineMode = "auto") {
  if (engine === "internal") return false;
  if (engine === "stockfish") return true;
  return state.variantKey === "classic" || state.variantKey === "chess960";
}

export function getStockfishDifficultyConfig(key: BotDifficultyKey) {
  return configs[key] ?? configs.normal;
}

export function buildStockfishCommands(state: GameState, difficultyKey: BotDifficultyKey, playedMoves: string[] = []) {
  const config = getStockfishDifficultyConfig(difficultyKey);
  const commands = [
    "uci",
    `setoption name UCI_LimitStrength value ${config.limitStrength ? "true" : "false"}`,
    `setoption name Skill Level value ${config.skillLevel}`,
    "setoption name Threads value 1",
    "setoption name Hash value 32"
  ];
  if (config.limitStrength) commands.push(`setoption name UCI_Elo value ${config.elo}`);
  if (state.variantKey === "chess960") commands.push("setoption name UCI_Chess960 value true");
  commands.push("ucinewgame");
  commands.push(playedMoves.length ? `position startpos moves ${playedMoves.join(" ")}` : "position startpos");
  commands.push(`go movetime ${config.moveTimeMs} depth ${config.depth}`);
  return commands;
}

export async function requestStockfishMove(state: GameState, difficultyKey: BotDifficultyKey, playedMoves: string[], timeoutMs: number): Promise<StockfishSearchResult | null> {
  if (!canCreateWorker()) return null;

  const commands = buildStockfishCommands(state, difficultyKey, playedMoves);
  const worker = new Worker("/engines/stockfish/stockfish-18-lite-single.js");

  return await new Promise((resolve) => {
    let finished = false;
    let depthReached = 0;
    let nodesSearched = 0;
    let evaluation: number | null = null;
    let principalVariation: string[] = [];
    const timer = setTimeout(() => finish(null), Math.max(timeoutMs + 800, 1500));

    const finish = (result: StockfishSearchResult | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };

    worker.addEventListener("message", (event) => {
      const line = String(event.data ?? "");
      if (line.startsWith("info ")) {
        const depth = line.match(/\bdepth\s+(\d+)/);
        const nodes = line.match(/\bnodes\s+(\d+)/);
        const cp = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mate = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const pv = line.match(/\bpv\s+(.+)$/);
        if (depth) depthReached = Number(depth[1]);
        if (nodes) nodesSearched = Number(nodes[1]);
        if (cp) evaluation = Number(cp[1]);
        if (mate) evaluation = Number(mate[1]) > 0 ? 100000 : -100000;
        if (pv) principalVariation = pv[1].split(/\s+/).filter(Boolean);
      }
      if (!line.startsWith("bestmove ")) return;
      const uciMove = line.split(/\s+/)[1] ?? "";
      const move = uciToLegalMove(state, uciMove);
      finish(move ? { move, uciMove, principalVariation, depthReached, nodesSearched, evaluation } : null);
    });

    worker.addEventListener("error", () => finish(null));
    for (const command of commands) worker.postMessage(command);
  });
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

function canCreateWorker() {
  return typeof Worker !== "undefined";
}
