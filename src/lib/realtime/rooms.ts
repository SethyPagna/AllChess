import { applyMove, createInitialState, getLegalMoves, sameSquare, type GameState, type Move } from "@/lib/variants";
import { getCatalogStats } from "@/lib/catalog";
import type { LiveStats, MatchmakingMatch, MatchmakingTicket, RoomSnapshot } from "@/lib/realtime/types";

export function createRoomSnapshot(input: {
  roomId?: string;
  gameId?: string;
  variantKey?: string;
  state?: GameState;
  rated?: boolean;
  spectators?: number;
} = {}): RoomSnapshot {
  const state = input.state ?? createInitialState(input.variantKey ?? "classic", input.gameId);
  return {
    roomId: input.roomId ?? crypto.randomUUID(),
    gameId: state.id,
    variantKey: state.variantKey,
    status: state.status,
    players: state.clocks.map((clock, index) => ({
      profileId: `seat-${index + 1}`,
      displayName: index === 0 ? "Player 1" : "Player 2",
      color: clock.color,
      role: "player",
      connected: false,
      ratingAtStart: 1200
    })),
    spectators: input.spectators ?? 0,
    clocks: state.clocks,
    state,
    moveVersion: state.ply,
    rated: input.rated ?? false,
    chatPolicy: "players"
  };
}

export function applyAuthoritativeRoomMove(snapshot: RoomSnapshot, move: Move) {
  const legal = isAuthoritativeMoveLegal(snapshot.state, move);
  if (!legal) {
    return { ok: false as const, reason: "Illegal move for current room state.", snapshot };
  }
  const nextState = applyMove(snapshot.state, move);
  return {
    ok: true as const,
    snapshot: {
      ...snapshot,
      state: nextState,
      status: nextState.status,
      clocks: nextState.clocks,
      moveVersion: nextState.ply
    }
  };
}

function isAuthoritativeMoveLegal(state: GameState, move: Move) {
  if (move.kind === "pass") {
    try {
      applyMove(state, move);
      return true;
    } catch {
      return false;
    }
  }

  return getLegalMoves(state, move.kind === "drop" && move.drop ? { drop: move.drop } : move.from).some((candidate) => movesMatch(candidate, move));
}

function movesMatch(candidate: Move, requested: Move) {
  if (!sameSquare(candidate.to, requested.to)) return false;
  if ((candidate.kind ?? "move") !== (requested.kind ?? "move")) return false;
  if (candidate.kind === "drop" || requested.kind === "drop") return candidate.drop?.code === requested.drop?.code && candidate.drop?.owner === requested.drop?.owner;
  if (!sameSquare(candidate.from, requested.from)) return false;
  if (requested.promotion === true) return candidate.promotion === true;
  if (requested.promotion === false) return candidate.promotion !== true;
  return true;
}

export function createMatchmakingTicket(input: {
  profileId?: string;
  variantKey?: string;
  timeControlKey?: string;
  rating?: number;
  rated?: boolean;
} = {}): MatchmakingTicket {
  const rating = input.rating ?? 1200;
  return {
    ticketId: crypto.randomUUID(),
    profileId: input.profileId ?? `guest-${crypto.randomUUID()}`,
    variantKey: input.variantKey ?? "classic",
    timeControlKey: input.timeControlKey ?? "rapid",
    ratingRange: [Math.max(100, rating - 200), rating + 200],
    rated: input.rated ?? false,
    createdAt: new Date().toISOString()
  };
}

export function areMatchmakingTicketsCompatible(left: MatchmakingTicket, right: MatchmakingTicket) {
  if (left.profileId === right.profileId) return false;
  if (left.variantKey !== right.variantKey) return false;
  if (left.timeControlKey !== right.timeControlKey) return false;
  if (left.rated !== right.rated) return false;
  return rangesOverlap(left.ratingRange, right.ratingRange);
}

export function createMatchmakingMatch(ticket: MatchmakingTicket, opponent: MatchmakingTicket): MatchmakingMatch {
  const pairId = [ticket.ticketId, opponent.ticketId].sort().map((id) => id.slice(0, 8)).join("-");
  return {
    type: "match_found",
    roomId: `match-${pairId}`,
    ticketId: ticket.ticketId
  };
}

function rangesOverlap(left: [number, number], right: [number, number]) {
  return Math.max(left[0], right[0]) <= Math.min(left[1], right[1]);
}

export function createDemoLiveStats(overrides: Partial<LiveStats> = {}): LiveStats {
  return {
    playersOnline: 0,
    activeRooms: 0,
    activeGames: 0,
    spectators: 0,
    botGames: 0,
    source: "demo",
    catalog: getCatalogStats(),
    byFamily: {},
    ...overrides
  };
}
