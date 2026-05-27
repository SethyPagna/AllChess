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

export function settleTurnClockElapsed(current: GameState, reference: GameState, elapsedMs: number): GameState {
  if (current.status !== "active" || reference.status !== "active" || elapsedMs <= 0) return current;

  const activeColor = reference.turn;
  const referenceClock = reference.clocks.find((clock) => clock.color === activeColor);
  const currentClock = current.clocks.find((clock) => clock.color === activeColor);
  if (!referenceClock || !currentClock || referenceClock.remainingMs <= 0) return current;

  const expectedRemainingMs = Math.max(0, referenceClock.remainingMs - elapsedMs);
  if (currentClock.remainingMs <= expectedRemainingMs) return current;

  const next: GameState = structuredClone(current);
  const nextClock = next.clocks.find((clock) => clock.color === activeColor);
  if (!nextClock) return current;

  nextClock.remainingMs = expectedRemainingMs;
  if (nextClock.remainingMs === 0) {
    next.status = "completed";
    next.result = opponentOf(next, activeColor);
    next.outcomeReason = "timeout";
  }

  return next;
}

export function formatClock(ms: number, options: { untimed?: boolean } = {}) {
  if (options.untimed) return "∞";
  if (ms <= 0) return "0:00";
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
