import { describe, expect, test } from "vitest";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { createInitialState } from "@/lib/variants";
import type { D1Database } from "@cloudflare/workers-types";

function createMockD1(firstRows: Record<string, unknown> = {}, allRows: Record<string, unknown[]> = {}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async run() {
              return { success: true };
            },
            async first() {
              const key = Object.keys(firstRows).find((rowKey) => sql.includes(rowKey));
              return key ? firstRows[key] : null;
            },
            async all() {
              const key = Object.keys(allRows).find((rowKey) => sql.includes(rowKey));
              return { results: key ? allRows[key] : [] };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("D1 persistence", () => {
  test("loads authoritative game state from D1 before move application", async () => {
    const state = createInitialState("classic", "authoritative-game");
    const { db, calls } = createMockD1({ "select board_state from games": { board_state: JSON.stringify(state) } });
    const repository = createD1GameRepository(db);

    await expect(repository.getGameState(state.id)).resolves.toMatchObject({ id: state.id, variantKey: "classic" });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("select board_state from games where id = ?"),
          values: [state.id]
        })
      ])
    );
  });

  test("reconstructs room snapshots from D1 room, game, and participant rows", async () => {
    const state = createInitialState("classic", "room-game");
    const { db, calls } = createMockD1(
      {
        "from rooms r": {
          room_id: "room-1",
          game_id: state.id,
          variant_key: "classic",
          status: "active",
          spectator_count: 3,
          rated: 1,
          chat_policy: "everyone",
          board_state: JSON.stringify(state)
        }
      },
      {
        "from game_participants": [
          { profile_id: "p-white", participant_type: "user", seat: "white", display_name: "White Player", connected: 1, rating_at_start: 1210 },
          { profile_id: "bot-black", participant_type: "bot", seat: "black", display_name: "AllChess Bot", connected: 1, rating_at_start: 1600 }
        ]
      }
    );
    const repository = createD1GameRepository(db);

    await expect(repository.getRoomSnapshot("room-1")).resolves.toMatchObject({
      roomId: "room-1",
      gameId: state.id,
      variantKey: "classic",
      spectators: 3,
      rated: true,
      chatPolicy: "everyone",
      players: [
        { profileId: "p-white", displayName: "White Player", color: "white", role: "player", connected: true, ratingAtStart: 1210 },
        { profileId: "bot-black", displayName: "AllChess Bot", color: "black", role: "bot", connected: true, ratingAtStart: 1600 }
      ]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from rooms r"), values: ["room-1", "room-1"] }),
        expect.objectContaining({ sql: expect.stringContaining("from game_participants"), values: [state.id] })
      ])
    );
  });

  test("persists compact bot benchmark summaries to D1", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);

    await repository.saveBotBenchmark({
      id: "bench-1",
      variantKey: "classic",
      tier: "legend",
      benchmarkVersion: "bench-v1",
      gamesPlayed: 12,
      score: 9.5,
      illegalMoves: 0,
      summary: { suite: "smoke", positions: 12, claimStatus: "verified" }
    });

    const benchmarkInsert = calls.find((call) => call.sql.includes("insert into bot_benchmark_runs"));
    expect(benchmarkInsert?.values).toEqual([
      "bench-1",
      "classic",
      "legend",
      "bench-v1",
      12,
      9.5,
      0,
      JSON.stringify({ suite: "smoke", positions: 12, claimStatus: "verified" })
    ]);
  });

  test("stores native GameState fields in game and move snapshots", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);
    const state = {
      ...createInitialState("shogi", "native-state"),
      hands: { sente: { p: 1 }, gote: { b: 1 } },
      variantState: { repetition: ["start"], impasseProfile: "allchess-default" },
      review: { summaryId: "review-1", completedAt: "2026-05-16T00:00:00.000Z" }
    };

    await repository.createGame({ state });
    await repository.recordMove({
      gameId: state.id,
      state,
      move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }
    });

    const gameInsert = calls.find((call) => call.sql.includes("insert into games"));
    const gameUpdate = calls.find((call) => call.sql.includes("update games"));
    const moveInsert = calls.find((call) => call.sql.includes("insert into moves"));
    const normalizedParticipants = calls.filter((call) => call.sql.includes("insert or ignore into game_participants"));
    const normalizedMove = calls.find((call) => call.sql.includes("insert into game_moves"));
    const normalizedPosition = calls.find((call) => call.sql.includes("insert or replace into game_positions") && call.values[1] === state.ply);
    const normalizedClocks = calls.filter((call) => call.sql.includes("insert into game_clocks"));
    const clockEvent = calls.find((call) => call.sql.includes("insert into clock_events"));

    expect(JSON.parse(gameInsert?.values[4] as string)).toMatchObject({
      hands: state.hands,
      variantState: state.variantState,
      review: state.review
    });
    expect(JSON.parse(gameUpdate?.values[0] as string)).toMatchObject({
      hands: state.hands,
      variantState: state.variantState,
      review: state.review
    });
    expect(JSON.parse(moveInsert?.values[4] as string)).toMatchObject({
      hands: state.hands,
      variantState: state.variantState,
      review: state.review
    });
    expect(normalizedParticipants).toHaveLength(state.clocks.length + 1);
    expect(normalizedMove?.values[0]).toBe(state.id);
    expect(normalizedMove?.values[1]).toBe(state.ply);
    expect(normalizedMove?.values[2]).toMatch(/^native-state:/);
    expect(normalizedMove?.values[12]).toBe(JSON.stringify({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }));
    expect(JSON.parse(normalizedPosition?.values[2] as string)).toMatchObject({
      hands: state.hands,
      variantState: state.variantState,
      review: state.review
    });
    expect(normalizedClocks.length).toBeGreaterThanOrEqual(state.clocks.length * 2);
    expect(clockEvent?.values[0]).toBe(state.id);
    expect(clockEvent?.values[1]).toMatch(/^native-state:/);
  });
});
