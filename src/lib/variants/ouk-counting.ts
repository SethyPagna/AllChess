import type { GameState, PlayerColor } from "./types";

export type OukCountAction = "start-board" | "start-pieces" | "stop" | "claim-draw";
export type OukCount = {
  phase: "board" | "pieces";
  side: "white" | "black";
  count: number;
  limit: number;
  firstMovePending: boolean;
  startedAtPly: number;
};
export type OukCountEvent = { ply: number; actor: PlayerColor; action: OukCountAction };

export function readOukCount(state: GameState): OukCount | null {
  if (state.variantKey !== "ouk-chaktrang") return null;
  const value = state.variantState?.oukCount as OukCount | undefined;
  return value && ["board", "pieces"].includes(value.phase) && ["white", "black"].includes(value.side) && Number.isInteger(value.count) && Number.isInteger(value.limit) ? value : null;
}

function material(state: GameState, side?: PlayerColor) {
  return state.board.flatMap(row => row.flatMap(cell => cell.piece && (!side || cell.piece.owner === side) ? [cell.piece] : []));
}

export function oukPieceCountLimit(state: GameState, chasingSide: PlayerColor) {
  const pieces = material(state, chasingSide);
  const count = (code: string) => pieces.filter(piece => piece.code === code).length;
  if (count("r") >= 2) return 8;
  if (count("r")) return 16;
  if (count("s") >= 2) return 22;
  if (count("n") >= 2) return 32;
  if (count("s")) return 44;
  return 64;
}

/** Explicit claims: captures do not silently start, stop, or restart counting. */
export function getOukCountChoices(state: GameState, actor: PlayerColor) {
  const active = readOukCount(state);
  const own = material(state, actor);
  const all = material(state);
  const playable = state.variantKey === "ouk-chaktrang" && state.status === "active" && ["white", "black"].includes(actor);
  const onTurn = playable && state.turn === actor;
  const bare = own.length === 1 && own[0].code === "k";
  const canUsePieces = bare && all.length > 2 && !all.some(piece => piece.code === "p" && !piece.promoted);
  return {
    board: onTurn && !active && own.length > 0 && own.length <= 3,
    pieces: onTurn && canUsePieces && active?.phase !== "pieces",
    stop: playable && active?.phase === "board" && active.side === actor,
    draw: playable && active?.phase === "board" && active.side !== actor,
    pieceStart: all.length + 1,
    pieceLimit: oukPieceCountLimit(state, actor === "white" ? "black" : "white")
  };
}

export function applyOukCountAction(state: GameState, actor: PlayerColor, action: OukCountAction): GameState {
  const choices = getOukCountChoices(state, actor);
  const allowed = { "start-board": choices.board, "start-pieces": choices.pieces, stop: choices.stop, "claim-draw": choices.draw };
  if (!allowed[action]) throw new Error("That counting action is not available.");
  const next = structuredClone(state);
  const events = (next.variantState?.oukCountEvents ?? []) as OukCountEvent[];
  next.variantState = { ...next.variantState, oukCountEvents: [...events, { ply: state.ply, actor, action }] };
  if (action === "stop") delete next.variantState.oukCount;
  else if (action === "claim-draw") finishDraw(next, "accepted");
  else next.variantState.oukCount = {
    phase: action === "start-board" ? "board" : "pieces",
    side: actor as OukCount["side"],
    count: action === "start-board" ? 1 : choices.pieceStart,
    limit: action === "start-board" ? 64 : choices.pieceLimit,
    firstMovePending: true,
    startedAtPly: state.ply
  } satisfies OukCount;
  return next;
}

/** Announce the starting number on the claimant's first move, then count only their moves. */
export function advanceOukCount(state: GameState, mover: PlayerColor) {
  const count = readOukCount(state);
  if (!count || count.side !== mover) return;
  state.variantState!.oukCount = { ...count, count: count.count + (count.firstMovePending ? 0 : 1), firstMovePending: false };
}

export function settleOukCount(state: GameState): GameState {
  const count = readOukCount(state);
  if (count?.phase === "board" && state.outcomeReason === "checkmate" && state.result === count.side) finishDraw(state, "countermate");
  if (state.status === "completed") return state;
  if (count && !count.firstMovePending && count.count >= count.limit) finishDraw(state, "limit");
  if (material(state).length === 2 && material(state).every(piece => piece.code === "k")) {
    state.status = "completed"; state.result = "draw"; state.outcomeReason = "insufficient-material";
  }
  return state;
}

function finishDraw(state: GameState, reason: "accepted" | "countermate" | "limit") {
  state.status = "completed"; state.result = "draw"; state.outcomeReason = "counting-rule";
  state.variantState = { ...state.variantState, oukCountOutcome: reason };
}

/** A defending bot claims the shorter available count; it never changes a human's claim. */
export function withOukBotCount(state: GameState): GameState {
  if (state.variantKey !== "ouk-chaktrang" || state.status !== "active") return state;
  const actor = state.turn;
  const choices = getOukCountChoices(state, actor);
  const active = readOukCount(state);
  if (active && active.side !== actor) return state;
  const boardRemaining = active ? active.limit - active.count + (active.firstMovePending ? 1 : 0) : 64;
  if (choices.pieces && choices.pieceLimit - choices.pieceStart + 1 < boardRemaining) return applyOukCountAction(state, actor, "start-pieces");
  const weights: Record<string, number> = { k: 0, r: 5, n: 3, s: 2, m: 1.5, p: 1 };
  const score = (side: PlayerColor) => material(state, side).reduce((total, piece) => total + (weights[piece.code] ?? 0), 0);
  if (choices.board && score(actor) < score(actor === "white" ? "black" : "white")) return applyOukCountAction(state, actor, "start-board");
  return state;
}
