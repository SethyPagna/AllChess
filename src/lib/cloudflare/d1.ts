import type { D1Database } from "@cloudflare/workers-types";

import { getCatalogStats } from "@/lib/catalog";
import type { GameState, Move, PlayerClock, PlayerColor } from "@/lib/variants";
import type { ChatPolicy, LiveStats, MatchmakingTicket, RoomPlayer, RoomSnapshot, RoomStatus } from "@/lib/realtime/types";

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

export type SaveBotBenchmarkInput = {
  id: string;
  variantKey: string;
  tier: string;
  benchmarkVersion: string;
  gamesPlayed: number;
  score: number;
  illegalMoves: number;
  summary: unknown;
};

export type GameRepository = {
  createGame(input: CreateGameInput): Promise<{ id: string; mode: "d1" }>;
  createRoom(input: { snapshot: RoomSnapshot; hostId?: string | null; roomCode?: string | null }): Promise<{ id: string; mode: "d1"; roomCode: string }>;
  getGameState(gameId: string): Promise<GameState | null>;
  getRoomSnapshot(roomIdOrCode: string): Promise<RoomSnapshot | null>;
  getLiveStats(): Promise<LiveStats>;
  recordMove(input: RecordMoveInput): Promise<{ id: string; mode: "d1" }>;
  saveMatchmakingTicket(ticket: MatchmakingTicket): Promise<void>;
  cancelMatchmakingTicket(ticketId: string): Promise<void>;
  saveBotBenchmark(input: SaveBotBenchmarkInput): Promise<void>;
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

      await persistNormalizedGameStart(db, input.state, input.createdBy ?? null);

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

      await persistNormalizedGameStart(db, input.snapshot.state, input.hostId ?? null, input.snapshot.players);

      return { id: input.snapshot.roomId, mode: "d1", roomCode };
    },

    async getGameState(gameId) {
      const row = await db.prepare("select board_state from games where id = ?").bind(gameId).first<{ board_state?: string }>();
      if (!row?.board_state) return null;
      return JSON.parse(row.board_state) as GameState;
    },

    async getRoomSnapshot(roomIdOrCode) {
      const room = await db
        .prepare(
          `select
            r.id as room_id,
            r.game_id,
            r.variant_key,
            r.status,
            r.spectator_count,
            r.rated,
            r.chat_policy,
            g.board_state
           from rooms r
           join games g on g.id = r.game_id
           where r.id = ? or r.room_code = ?`
        )
        .bind(roomIdOrCode, roomIdOrCode)
        .first<RoomSnapshotRow>();
      if (!room?.board_state) return null;

      const state = JSON.parse(room.board_state) as GameState;
      const participants = await db
        .prepare(
          `select profile_id, participant_type, seat, display_name, connected, rating_at_start
           from game_participants
           where game_id = ? and participant_type <> 'spectator'
           order by joined_at`
        )
        .bind(room.game_id)
        .all<RoomParticipantRow>();

      return {
        roomId: room.room_id,
        gameId: room.game_id,
        variantKey: room.variant_key,
        status: normalizeRoomStatus(room.status, state.status),
        players: createRoomPlayers(state, participants.results ?? []),
        spectators: Number(room.spectator_count ?? 0),
        clocks: state.clocks,
        state,
        moveVersion: state.ply,
        rated: Boolean(room.rated),
        chatPolicy: normalizeChatPolicy(room.chat_policy)
      };
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
        playersOnline: 0,
        activeRooms: Number(rooms?.activeRooms ?? 0),
        activeGames: Number(rooms?.activeGames ?? 0),
        spectators: Number(rooms?.spectators ?? 0),
        botGames: 0,
        source: "durable-object",
        catalog: getCatalogStats(),
        byFamily: {}
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

      const actor = getMoveActor(input.state, input.move);
      await ensureParticipants(db, input.gameId, input.state, actor ? [{ color: actor }] : undefined);
      await persistNormalizedMove(db, input.gameId, input.state, input.move, actor, lastMove?.notation ?? "");
      await persistPosition(db, input.gameId, input.state);
      await persistClocks(db, input.gameId, input.state, actor);

      return { id: input.gameId, mode: "d1" };
    },

    async saveMatchmakingTicket(ticket) {
      await db
        .prepare(
          `insert into matchmaking_tickets (
            ticket_id, profile_id, variant_key, time_control_key, rating_min, rating_max, rated, status, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, 'queued', ?, datetime('now'))
          on conflict(ticket_id) do update set
            profile_id = excluded.profile_id,
            variant_key = excluded.variant_key,
            time_control_key = excluded.time_control_key,
            rating_min = excluded.rating_min,
            rating_max = excluded.rating_max,
            rated = excluded.rated,
            status = 'queued',
            updated_at = datetime('now')`
        )
        .bind(
          ticket.ticketId,
          ticket.profileId,
          ticket.variantKey,
          ticket.timeControlKey,
          ticket.ratingRange[0],
          ticket.ratingRange[1],
          ticket.rated ? 1 : 0,
          ticket.createdAt
        )
        .run();
    },

    async cancelMatchmakingTicket(ticketId) {
      await db
        .prepare(
          `update matchmaking_tickets
           set status = 'cancelled', updated_at = datetime('now')
           where ticket_id = ? and status = 'queued'`
        )
        .bind(ticketId)
        .run();
    },

    async saveBotBenchmark(input) {
      await db
        .prepare(
          `insert into bot_benchmark_runs (
            id, variant_key, tier, benchmark_version, games_played, score, illegal_moves, summary
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.id,
          input.variantKey,
          input.tier,
          input.benchmarkVersion,
          input.gamesPlayed,
          input.score,
          input.illegalMoves,
          JSON.stringify(input.summary)
        )
        .run();
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

type ParticipantSeed = {
  color: PlayerColor;
  profileId?: string | null;
  displayName?: string;
  role?: "player" | "spectator" | "bot";
  connected?: boolean;
  ratingAtStart?: number;
};

type RoomSnapshotRow = {
  room_id: string;
  game_id: string;
  variant_key: string;
  status?: string;
  spectator_count?: number;
  rated?: number;
  chat_policy?: string;
  board_state: string;
};

type RoomParticipantRow = {
  profile_id?: string | null;
  participant_type: string;
  seat: PlayerColor;
  display_name?: string | null;
  connected?: number;
  rating_at_start?: number | null;
};

async function persistNormalizedGameStart(db: D1Database, state: GameState, createdBy?: string | null, roomPlayers?: ParticipantSeed[]) {
  const participants = state.clocks.map((clock, index) => {
    const roomPlayer = roomPlayers?.find((player) => player.color === clock.color);
    return {
      color: clock.color,
      profileId: index === 0 ? createdBy : null,
      displayName: roomPlayer?.displayName ?? displayNameForSeat(clock.color),
      role: roomPlayer?.role,
      connected: roomPlayer?.connected,
      ratingAtStart: roomPlayer?.ratingAtStart
    } satisfies ParticipantSeed;
  });

  await ensureParticipants(db, state.id, state, participants);
  await persistPosition(db, state.id, state);
  await persistClocks(db, state.id, state);
}

async function ensureParticipants(db: D1Database, gameId: string, state: GameState, seeds?: ParticipantSeed[]) {
  const participantSeeds: ParticipantSeed[] = seeds ?? state.clocks.map((clock) => ({ color: clock.color }));
  for (const participant of participantSeeds) {
    const participantType = participant.role === "bot" ? "bot" : participant.profileId ? "user" : "local-human";
    await db
      .prepare(
        `insert or ignore into game_participants (
          id, game_id, profile_id, participant_type, seat, display_name, is_bot, rating_at_start, connected
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        participantId(gameId, participant.color),
        gameId,
        participant.profileId ?? null,
        participantType,
        participant.color,
        participant.displayName ?? displayNameForSeat(participant.color),
        participantType === "bot" ? 1 : 0,
        participant.ratingAtStart ?? null,
        participant.connected ? 1 : 0
      )
      .run();
  }
}

async function persistNormalizedMove(db: D1Database, gameId: string, state: GameState, move: Move, actor: PlayerColor | null, notation: string) {
  const captured = state.captured.at(-1);
  const actorClock = actor ? findClock(state.clocks, actor) : null;
  await db
    .prepare(
      `insert into game_moves (
        game_id, ply, actor_participant_id, move_kind, from_row, from_col, to_row, to_col, promotion,
        drop_code, drop_owner, drop_label_key, move_json, notation, remaining_ms_after, is_capture, captured_piece_code
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      gameId,
      state.ply,
      actor ? participantId(gameId, actor) : null,
      move.kind ?? "move",
      move.from?.row ?? null,
      move.from?.col ?? null,
      move.to?.row ?? null,
      move.to?.col ?? null,
      move.promotion ? 1 : 0,
      move.drop?.code ?? null,
      move.drop?.owner ?? null,
      move.drop?.labelKey ?? null,
      JSON.stringify(move),
      notation,
      actorClock?.remainingMs ?? null,
      captured ? 1 : 0,
      captured?.code ?? null
    )
    .run();
}

async function persistPosition(db: D1Database, gameId: string, state: GameState) {
  await db
    .prepare(
      `insert or replace into game_positions (
        game_id, ply, state_json, fen_like_state, position_hash, turn, status, result, outcome_reason,
        halfmove_clock, repetition_key, clocks_json, captured_json, hands_json, variant_state_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      gameId,
      state.ply,
      JSON.stringify(state),
      null,
      createPositionHash(state),
      state.turn,
      state.status,
      state.result ?? null,
      state.outcomeReason ?? null,
      state.halfmoveClock,
      createRepetitionKey(state),
      JSON.stringify(state.clocks),
      JSON.stringify(state.captured),
      state.hands ? JSON.stringify(state.hands) : null,
      state.variantState ? JSON.stringify(state.variantState) : null
    )
    .run();
}

async function persistClocks(db: D1Database, gameId: string, state: GameState, movedBy?: PlayerColor | null) {
  for (const clock of state.clocks) {
    const id = participantId(gameId, clock.color);
    await db
      .prepare(
        `insert into game_clocks (
          game_id, participant_id, seat, remaining_ms, base_ms, increment_ms, updated_at
        ) values (?, ?, ?, ?, ?, ?, datetime('now'))
        on conflict(game_id, participant_id) do update set
          remaining_ms = excluded.remaining_ms,
          increment_ms = excluded.increment_ms,
          updated_at = datetime('now')`
      )
      .bind(gameId, id, clock.color, clock.remainingMs, clock.remainingMs, clock.incrementMs)
      .run();
  }

  if (!movedBy) return;
  const movedClock = findClock(state.clocks, movedBy);
  await db
    .prepare(
      `insert into clock_events (game_id, participant_id, event_type, remaining_ms, payload)
       values (?, ?, 'move', ?, ?)`
    )
    .bind(gameId, participantId(gameId, movedBy), movedClock?.remainingMs ?? null, JSON.stringify({ ply: state.ply, turn: state.turn }))
    .run();
}

function getMoveActor(state: GameState, move: Move) {
  if (move.kind === "drop" && move.drop?.owner) return move.drop.owner;
  const piece = state.board[move.to.row]?.[move.to.col]?.piece;
  return piece?.owner ?? previousTurnFromClocks(state);
}

function previousTurnFromClocks(state: GameState) {
  if (state.clocks.length !== 2) return null;
  return state.clocks.find((clock) => clock.color !== state.turn)?.color ?? null;
}

function findClock(clocks: PlayerClock[], color: PlayerColor) {
  return clocks.find((clock) => clock.color === color) ?? null;
}

function participantId(gameId: string, color: PlayerColor) {
  return `${gameId}:${color}`;
}

function displayNameForSeat(color: PlayerColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function createRoomPlayers(state: GameState, participants: RoomParticipantRow[]): RoomPlayer[] {
  if (participants.length > 0) {
    return participants.map((participant, index) => ({
      profileId: participant.profile_id ?? `seat-${index + 1}`,
      displayName: participant.display_name ?? displayNameForSeat(participant.seat),
      color: participant.seat,
      role: participant.participant_type === "bot" ? "bot" : "player",
      connected: Boolean(participant.connected),
      ratingAtStart: participant.rating_at_start ?? undefined
    }));
  }

  return state.clocks.map((clock, index) => ({
    profileId: `seat-${index + 1}`,
    displayName: displayNameForSeat(clock.color),
    color: clock.color,
    role: "player",
    connected: false
  }));
}

function normalizeRoomStatus(status: string | undefined, fallback: GameState["status"]): RoomStatus {
  if (status === "waiting" || status === "active" || status === "completed" || status === "abandoned") return status;
  return fallback === "waiting" || fallback === "active" || fallback === "completed" ? fallback : "active";
}

function normalizeChatPolicy(policy: string | undefined): ChatPolicy {
  if (policy === "disabled" || policy === "players" || policy === "spectators" || policy === "everyone") return policy;
  return "players";
}

function createPositionHash(state: GameState) {
  const pieces = state.board
    .flat()
    .filter((cell) => cell.piece)
    .map((cell) => `${cell.square.row},${cell.square.col}:${cell.piece?.owner}:${cell.piece?.code}:${cell.piece?.promoted ? 1 : 0}`)
    .sort()
    .join("|");
  return `${state.variantKey}|turn:${state.turn}|${pieces}|hands:${JSON.stringify(state.hands ?? {})}`;
}

function createRepetitionKey(state: GameState) {
  return `${state.variantKey}|turn:${state.turn}|hash:${createPositionHash(state)}`;
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
