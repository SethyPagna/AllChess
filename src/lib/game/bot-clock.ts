import { applyMove, type GameState, type Move } from "@/lib/variants";
import { settleTurnClockElapsed } from "@/lib/game/clocks";

type Turn = Pick<GameState, "id" | "ply" | "turn">;
export type TurnFrame = Turn & Pick<GameState, "status" | "outcomeReason">;

export function isSameTurnSnapshot(current: Turn, snapshot: Turn) {
  return current.id === snapshot.id && current.ply === snapshot.ply && current.turn === snapshot.turn;
}

export function settleBotThinkingSnapshot(snapshot: GameState, elapsedMs: number) {
  return settleTurnClockElapsed(snapshot, snapshot, elapsedMs);
}

/** The history frame a bot reply adds, or null when thinking used up the bot's clock and no move is played. */
export function botReplyHistoryFrame(snapshot: GameState, elapsedMs: number) {
  const settled = settleBotThinkingSnapshot(snapshot, elapsedMs);
  return settled.status === "active" ? settled : null;
}

export function applyBotMoveAfterThinking(current: GameState, snapshot: GameState, move: Move, elapsedMs: number) {
  if (!isSameTurnSnapshot(current, snapshot)) return current;

  const clockSettled = settleTurnClockElapsed(current, snapshot, elapsedMs);
  if (clockSettled.status !== "active") return clockSettled;

  return applyMove(clockSettled, move);
}

/** True when `frame` repeats the turn that `flagged` lost on time, as left by a bot reply that landed after the bot's clock ran out. */
export function isFlaggedTurnRepeat(frame: Turn, flagged: TurnFrame) {
  return flagged.status === "completed" && flagged.outcomeReason === "timeout" && isSameTurnSnapshot(flagged, frame);
}

/** Keeps one frame per ply when a bot reply arrived after its clock had already run out. */
export function withoutFlaggedBotFrame(history: GameState[], state: GameState) {
  const last = history.at(-1);
  return last && isFlaggedTurnRepeat(last, state) ? history.slice(0, -1) : history;
}
