import { applyMove, createInitialState, getLegalMoves, sameSquare, type GameState, type Move } from "@/lib/variants";
import { getCatalogStats } from "@/lib/catalog";
import type { LiveStats, MatchmakingTicket, RoomSnapshot } from "@/lib/realtime/types";

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
  const legal = getLegalMoves(snapshot.state, move.from).some((candidate) => sameSquare(candidate.to, move.to));
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
