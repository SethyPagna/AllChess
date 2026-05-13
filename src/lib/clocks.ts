import type { GameState, PlayerColor } from "@/lib/variants";

export function tickGameClock(state: GameState, elapsedMs: number): GameState {
  if (state.status !== "active" || elapsedMs <= 0) return state;

  const activeClock = state.clocks.find((clock) => clock.color === state.turn);
  if (!activeClock || activeClock.remainingMs <= 0) return state;

  const next: GameState = structuredClone(state);
  const nextClock = next.clocks.find((clock) => clock.color === state.turn);
  if (!nextClock) return state;

  nextClock.remainingMs = Math.max(0, nextClock.remainingMs - elapsedMs);
  if (nextClock.remainingMs === 0) {
    next.status = "completed";
    next.result = opponentOf(next, state.turn);
    next.outcomeReason = "timeout";
  }

  return next;
}

export function formatClock(ms: number) {
  if (ms <= 0) return "∞";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function opponentOf(state: GameState, color: PlayerColor) {
  return state.clocks.find((clock) => clock.color !== color)?.color ?? "draw";
}
