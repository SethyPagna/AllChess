import type { GameState, PlayerColor } from "./types";

export type MakrukCountAction = "start-board" | "stop" | "claim-draw";
export type MakrukHonorCount = { phase: "board" | "pieces"; side: "white" | "black"; count: number; limit: number; firstMovePending: boolean; startedAtPly: number };
type CountEvent = { ply: number; actor: PlayerColor; action: MakrukCountAction | "start-pieces" };

export const usesMakrukHonorCount = (state: GameState) => state.variantKey === "makruk" && state.variantState?.makrukProfile === "honor-v1";
export function readMakrukHonorCount(state: GameState): MakrukHonorCount | null {
  if (!usesMakrukHonorCount(state)) return null;
  const value = state.variantState?.makrukHonorCount as MakrukHonorCount | undefined;
  return value && ["board", "pieces"].includes(value.phase) && ["white", "black"].includes(value.side) && Number.isInteger(value.count) && value.count >= 1 && Number.isInteger(value.limit) && value.limit >= 1 && typeof value.firstMovePending === "boolean" ? value : null;
}
const material = (state: GameState, side?: PlayerColor) => state.board.flatMap(row => row.flatMap(cell => cell.piece && (!side || cell.piece.owner === side) ? [cell.piece] : []));
const opposite = (side: PlayerColor) => side === "white" ? "black" : "white";
export const makrukCountVersion = (state: GameState) => Array.isArray(state.variantState?.makrukCountEvents) ? state.variantState.makrukCountEvents.length : 0;

export function makrukHonorLimit(state: GameState, chasingSide: PlayerColor) {
  const pieces = material(state, chasingSide);
  const count = (code: string) => pieces.filter(piece => piece.code === code).length;
  if (count("r") >= 2) return 8;
  if (count("r")) return 16;
  if (count("s") >= 2) return 22;
  if (count("n") >= 2) return 32;
  if (count("s")) return 44;
  return 64;
}

function bareSide(state: GameState): "white" | "black" | null {
  const all = material(state);
  if (all.length <= 2 || all.some(piece => piece.code === "p" && !piece.promoted)) return null;
  for (const side of ["white", "black"] as const) {
    const own = all.filter(piece => piece.owner === side);
    if (own.length === 1 && own[0].code === "k") return side;
  }
  return null;
}

function record(state: GameState, actor: PlayerColor, action: CountEvent["action"]) {
  const events = Array.isArray(state.variantState?.makrukCountEvents) ? state.variantState.makrukCountEvents as CountEvent[] : [];
  state.variantState = { ...state.variantState, makrukCountEvents: [...events, { ply: state.ply, actor, action }] };
}

/** Called after a move establishes eligibility, or when constructing an endgame exercise. */
export function initializeMakrukPieceCount(state: GameState): boolean {
  if (!usesMakrukHonorCount(state) || state.status !== "active" || readMakrukHonorCount(state)?.phase === "pieces") return false;
  const side = bareSide(state);
  if (!side) return false;
  record(state, side, "start-pieces");
  state.variantState!.makrukHonorCount = { phase: "pieces", side, count: material(state).length + 1, limit: makrukHonorLimit(state, opposite(side)), firstMovePending: true, startedAtPly: state.ply } satisfies MakrukHonorCount;
  return true;
}

export function getMakrukCountChoices(state: GameState, actor: PlayerColor) {
  const active = readMakrukHonorCount(state), all = material(state);
  const playable = usesMakrukHonorCount(state) && state.status === "active" && ["white", "black"].includes(actor);
  return {
    board: playable && state.turn === actor && !active && !bareSide(state) && all.length > 2 && !all.some(piece => piece.code === "p" && !piece.promoted),
    stop: playable && active?.phase === "board" && active.side === actor,
    draw: playable && active?.phase === "board" && active.side !== actor
  };
}

export function applyMakrukCountAction(state: GameState, actor: PlayerColor, action: MakrukCountAction): GameState {
  const choices = getMakrukCountChoices(state, actor);
  if (!({ "start-board": choices.board, stop: choices.stop, "claim-draw": choices.draw })[action]) throw new Error("That honor-count action is not available.");
  const next = structuredClone(state); record(next, actor, action);
  if (action === "stop") delete next.variantState!.makrukHonorCount;
  else if (action === "claim-draw") finishDraw(next, "accepted");
  else next.variantState!.makrukHonorCount = { phase: "board", side: actor as "white" | "black", count: 1, limit: 64, firstMovePending: true, startedAtPly: state.ply } satisfies MakrukHonorCount;
  return next;
}

/** Rebuild a room's review frames without losing claims made between board moves. */
export function replayMakrukCountActions(position: GameState, source: GameState): GameState {
  if (!usesMakrukHonorCount(source)) return position;
  const events = (source.variantState?.makrukCountEvents ?? []) as CountEvent[];
  for (const event of events) {
    if (event.ply === position.ply && event.action !== "start-pieces") position = applyMakrukCountAction(position, event.actor, event.action);
  }
  return position;
}

export function advanceMakrukHonorCount(state: GameState, mover: PlayerColor) {
  if (initializeMakrukPieceCount(state)) return;
  const count = readMakrukHonorCount(state);
  if (count?.side === mover) state.variantState!.makrukHonorCount = { ...count, count: count.count + (count.firstMovePending ? 0 : 1), firstMovePending: false };
}

export function settleMakrukHonorCount(state: GameState): GameState {
  if (!usesMakrukHonorCount(state)) return state;
  const count = readMakrukHonorCount(state);
  if (count?.phase === "board" && state.outcomeReason === "checkmate" && state.result === count.side) finishDraw(state, "countermate");
  if (state.status === "completed") return state;
  // The published profile allows count 8 against two rooks; count 9 ends the game.
  if (count && count.count > count.limit) finishDraw(state, "limit");
  const all = material(state);
  if (all.length === 2 && all.every(piece => piece.code === "k")) {
    state.status = "completed"; state.result = "draw"; state.outcomeReason = "insufficient-material";
  }
  return state;
}

function finishDraw(state: GameState, reason: "accepted" | "countermate" | "limit") {
  state.status = "completed"; state.result = "draw"; state.outcomeReason = "counting-rule";
  state.variantState = { ...state.variantState, makrukCountOutcome: reason };
}

/** Material is a bot heuristic; the human decides whether to claim the board's honor. */
export function withMakrukBotCount(state: GameState): GameState {
  if (!getMakrukCountChoices(state, state.turn).board) return state;
  const weights: Record<string, number> = { k: 0, r: 5, n: 3, s: 2.5, m: 1.5, p: 1 };
  const score = (side: PlayerColor) => material(state, side).reduce((sum, piece) => sum + (weights[piece.code] ?? 0), 0);
  return score(state.turn) < score(opposite(state.turn)) ? applyMakrukCountAction(state, state.turn, "start-board") : state;
}
