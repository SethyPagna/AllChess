import type { D1Database } from "@cloudflare/workers-types";

import type { GameState, Move } from "@/lib/variants";

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
