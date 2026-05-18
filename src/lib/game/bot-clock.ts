import { applyMove, type GameState, type Move } from "@/lib/variants";
import { settleTurnClockElapsed } from "@/lib/game/clocks";

export function isSameTurnSnapshot(current: GameState, snapshot: GameState) {
  return current.id === snapshot.id && current.ply === snapshot.ply && current.turn === snapshot.turn;
}

export function settleBotThinkingSnapshot(snapshot: GameState, elapsedMs: number) {
  return settleTurnClockElapsed(snapshot, snapshot, elapsedMs);
}

export function applyBotMoveAfterThinking(current: GameState, snapshot: GameState, move: Move, elapsedMs: number) {
  if (!isSameTurnSnapshot(current, snapshot)) return current;

  const clockSettled = settleTurnClockElapsed(current, snapshot, elapsedMs);
  if (clockSettled.status !== "active") return clockSettled;

  return applyMove(clockSettled, move);
}
