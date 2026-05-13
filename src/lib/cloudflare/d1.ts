import type { D1Database } from "@cloudflare/workers-types";

import type { GameState, Move } from "@/lib/variants";
import type { LiveStats, RoomSnapshot } from "@/lib/realtime/types";

export type CreateGameInput = {
  state: GameState;
  privateRoom?: boolean;
  createdBy?: string | null;
};

export type RecordMoveInput = {
  gameId: string;
  state: GameState;
  move: Move;
};

export type GameRepository = {
  createGame(input: CreateGameInput): Promise<{ id: string; mode: "d1" }>;
  createRoom(input: { snapshot: RoomSnapshot; hostId?: string | null; roomCode?: string | null }): Promise<{ id: string; mode: "d1"; roomCode: string }>;
  getLiveStats(): Promise<LiveStats>;
  recordMove(input: RecordMoveInput): Promise<{ id: string; mode: "d1" }>;
  saveAnalysis(input: {
    id: string;
    gameId: string;
    provider: string;
    model: string;
    summary: string;
    report: unknown;
    requestedBy?: string | null;
  }): Promise<void>;
};

export function createD1GameRepository(db: D1Database): GameRepository {
  return {
    async createGame(input) {
      const privateCode = input.privateRoom ? createRoomCode() : null;
      await db
        .prepare(
          `insert into games (
            id, variant_key, status, result, board_state, current_turn, private_code, created_by
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.state.id,
          input.state.variantKey,
          input.privateRoom ? "waiting" : "active",
          "unfinished",
          JSON.stringify(input.state),
          input.state.turn,
          privateCode,
          input.createdBy ?? null
        )
        .run();

      if (privateCode) {
        await db
          .prepare(
            `insert into rooms (id, host_id, game_id, variant_key, room_code, is_private)
             values (?, ?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), input.createdBy ?? null, input.state.id, input.state.variantKey, privateCode, 1)
          .run();
      }

      return { id: input.state.id, mode: "d1" };
    },

    async createRoom(input) {
      const roomCode = input.roomCode ?? createRoomCode();
      await db
        .prepare(
          `insert into games (
            id, variant_key, status, result, board_state, current_turn, private_code, created_by, time_control
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.snapshot.gameId,
          input.snapshot.variantKey,
          input.snapshot.status,
          "unfinished",
          JSON.stringify(input.snapshot.state),
          input.snapshot.state.turn,
          roomCode,
          input.hostId ?? null,
          JSON.stringify({ key: "rapid" })
        )
        .run();

      await db
        .prepare(
          `insert into rooms (
            id, host_id, game_id, variant_key, room_code, is_private, status, spectator_count, rated, time_control_key, visibility, chat_policy
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.snapshot.roomId,
          input.hostId ?? null,
          input.snapshot.gameId,
          input.snapshot.variantKey,
          roomCode,
          1,
          input.snapshot.status,
          input.snapshot.spectators,
          input.snapshot.rated ? 1 : 0,
          "rapid",
          "private",
          input.snapshot.chatPolicy
        )
        .run();

      return { id: input.snapshot.roomId, mode: "d1", roomCode };
    },

    async getLiveStats() {
      const rooms = await db
        .prepare(
          `select
            count(*) as activeRooms,
            sum(case when status = 'active' then 1 else 0 end) as activeGames,
            coalesce(sum(spectator_count), 0) as spectators
           from rooms
           where status in ('waiting', 'active')`
        )
        .bind()
        .first<{ activeRooms?: number; activeGames?: number; spectators?: number }>();

      return {
        playersOnline: Number(rooms?.activeRooms ?? 0) * 2,
        activeRooms: Number(rooms?.activeRooms ?? 0),
        activeGames: Number(rooms?.activeGames ?? 0),
        spectators: Number(rooms?.spectators ?? 0),
        botGames: 0,
        source: "durable-object"
      };
    },

    async recordMove(input) {
      const lastMove = input.state.moves[input.state.moves.length - 1];
      await db
        .prepare(
          `update games
           set board_state = ?, current_turn = ?, status = ?, result = ?, completed_at = case when ? = 'completed' then datetime('now') else completed_at end
           where id = ?`
        )
        .bind(JSON.stringify(input.state), input.state.turn, input.state.status, input.state.result ?? "unfinished", input.state.status, input.gameId)
        .run();

      await db
        .prepare(
          `insert into moves (game_id, ply, move, notation, board_state_after)
           values (?, ?, ?, ?, ?)`
        )
        .bind(input.gameId, input.state.ply, JSON.stringify(input.move), lastMove?.notation ?? "", JSON.stringify(input.state))
        .run();

      return { id: input.gameId, mode: "d1" };
    },

    async saveAnalysis(input) {
      await db
        .prepare(
          `insert into analysis_reports (id, game_id, requested_by, provider, model, summary, report)
           values (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(input.id, input.gameId, input.requestedBy ?? null, input.provider, input.model, input.summary, JSON.stringify(input.report))
        .run();
    }
  };
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}
