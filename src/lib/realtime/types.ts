import type { PlayerClock, PlayerColor, GameState, Move } from "@/lib/variants";

export type RoomStatus = "waiting" | "active" | "completed" | "abandoned";
export type ChatPolicy = "disabled" | "players" | "spectators" | "everyone";
export type SeatRole = "player" | "spectator" | "bot";

export type RoomPlayer = {
  profileId: string;
  displayName: string;
  color: PlayerColor;
  role: SeatRole;
  connected: boolean;
  ratingAtStart?: number;
};

export type RoomSnapshot = {
  roomId: string;
  gameId: string;
  variantKey: string;
  status: RoomStatus;
  players: RoomPlayer[];
  spectators: number;
  clocks: PlayerClock[];
  state: GameState;
  moveVersion: number;
  rated: boolean;
  chatPolicy: ChatPolicy;
};

export type MatchmakingTicket = {
  ticketId: string;
  profileId: string;
  variantKey: string;
  timeControlKey: string;
  ratingRange: [number, number];
  rated: boolean;
  createdAt: string;
};

export type LiveStats = {
  playersOnline: number;
  activeRooms: number;
  activeGames: number;
  spectators: number;
  botGames: number;
  source: "durable-object" | "demo";
};

export type ClientRealtimeMessage =
  | { type: "join_room"; roomId: string; profileId?: string }
  | { type: "join_queue"; ticket: MatchmakingTicket }
  | { type: "leave_queue"; ticketId: string }
  | { type: "make_move"; roomId: string; move: Move; expectedMoveVersion: number }
  | { type: "resign"; roomId: string; profileId?: string }
  | { type: "offer_draw"; roomId: string; profileId?: string }
  | { type: "accept_draw"; roomId: string; profileId?: string }
  | { type: "spectate"; roomId: string; profileId?: string }
  | { type: "chat"; roomId: string; text: string }
  | { type: "ping"; sentAt: number };

export type ServerRealtimeMessage =
  | { type: "room_snapshot"; snapshot: RoomSnapshot }
  | { type: "move_applied"; snapshot: RoomSnapshot; move: Move }
  | { type: "move_rejected"; reason: string; expectedMoveVersion: number }
  | { type: "clock_sync"; clocks: PlayerClock[]; serverTime: string }
  | { type: "match_found"; roomId: string; ticketId: string }
  | { type: "player_joined"; roomId: string; player: RoomPlayer }
  | { type: "spectator_count"; roomId: string; spectators: number }
  | { type: "game_finished"; snapshot: RoomSnapshot }
  | { type: "bot_thinking"; roomId: string; color: PlayerColor }
  | { type: "pong"; sentAt: number; serverTime: string };
