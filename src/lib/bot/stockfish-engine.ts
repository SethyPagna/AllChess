import { getLegalMoves, type GameState, type Move } from "@/lib/variants";
import { getBotStrengthBand, type BotTierKey } from "@/lib/bot/strength";

export type BotEngineMode = "auto" | "stockfish" | "internal";
export type BotDifficultyKey = BotTierKey;

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
  easy: { limitStrength: true, elo: getBotStrengthBand("easy").stockfishUciElo, skillLevel: 4, moveTimeMs: 220, depth: 4 },
  normal: { limitStrength: true, elo: getBotStrengthBand("normal").stockfishUciElo, skillLevel: 8, moveTimeMs: 420, depth: 6 },
  hard: { limitStrength: true, elo: getBotStrengthBand("hard").stockfishUciElo, skillLevel: 12, moveTimeMs: 760, depth: 9 },
  "very-hard": { limitStrength: true, elo: getBotStrengthBand("very-hard").stockfishUciElo, skillLevel: 16, moveTimeMs: 1300, depth: 12 },
  grandmaster: { limitStrength: true, elo: getBotStrengthBand("grandmaster").stockfishUciElo, skillLevel: 18, moveTimeMs: 1700, depth: 15 },
  legend: { limitStrength: false, elo: getBotStrengthBand("legend").stockfishUciElo, skillLevel: 20, moveTimeMs: 2400, depth: 20 }
};

const stockfishScriptPath = "/engines/stockfish/stockfish-18-lite-single.js";
const stockfishWasmPath = "/engines/stockfish/stockfish-18-lite-single.wasm";

type StockfishRuntime = {
  ccall: (name: string, returnType: null, argTypes: string[], args: string[], options?: { async?: boolean }) => unknown;
  listener?: (line: string) => void;
};

type StockfishScriptElement = HTMLScriptElement & {
  _exports?: (options: {
    locateFile: (path: string) => string;
    listener: (line: string) => void;
  }) => Promise<StockfishRuntime>;
};

let stockfishRuntimePromise: Promise<StockfishRuntime> | null = null;

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
  if (!canUseStockfishRuntime()) return null;

  const commands = buildStockfishCommands(state, difficultyKey, playedMoves);
  const runtime = await getStockfishRuntime().catch(() => null);
  if (!runtime) return null;

  return await new Promise((resolve) => {
    let finished = false;
    let depthReached = 0;
    let nodesSearched = 0;
    let evaluation: number | null = null;
    let principalVariation: string[] = [];
    const timer = setTimeout(() => finish(null), Math.min(Math.max(timeoutMs + 350, 1500), 2950));

    const finish = (result: StockfishSearchResult | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      runtime.listener = undefined;
      resolve(result);
    };

    runtime.listener = (line) => {
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
    };

    for (const command of commands) sendStockfishCommand(runtime, command);
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

function canUseStockfishRuntime() {
  return typeof document !== "undefined";
}

async function getStockfishRuntime() {
  stockfishRuntimePromise ??= loadStockfishRuntime();
  return stockfishRuntimePromise;
}

async function loadStockfishRuntime() {
  const factory = await loadStockfishFactory();
  return await factory({
    locateFile: (path: string) => (path.includes(".wasm") ? stockfishWasmPath : path),
    listener: () => undefined
  });
}

async function loadStockfishFactory() {
  const existing = document.querySelector<StockfishScriptElement>(`script[data-allchess-stockfish="true"]`);
  if (existing?._exports) return existing._exports;

  const script = (existing ?? document.createElement("script")) as StockfishScriptElement;
  script.dataset.allchessStockfish = "true";
  script.src = stockfishScriptPath;
  if (!existing) document.head.appendChild(script);

  await new Promise<void>((resolve, reject) => {
    if (script._exports) {
      resolve();
      return;
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Stockfish script failed to load.")), { once: true });
  });

  if (!script._exports) throw new Error("Stockfish factory was not exported by the engine script.");
  return script._exports;
}

function sendStockfishCommand(runtime: StockfishRuntime, command: string) {
  runtime.ccall("command", null, ["string"], [command], { async: /^go\b/.test(command) });
}
