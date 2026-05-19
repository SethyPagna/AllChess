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

  test("persists and cancels matchmaking tickets in D1", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);
    const ticket = {
      ticketId: "ticket-1",
      profileId: "profile-1",
      variantKey: "classic",
      timeControlKey: "rapid",
      ratingRange: [1000, 1400] as [number, number],
      rated: true,
      createdAt: "2026-05-18T00:00:00.000Z"
    };

    await repository.saveMatchmakingTicket(ticket);
    await repository.cancelMatchmakingTicket(ticket.ticketId);

    const insert = calls.find((call) => call.sql.includes("insert into matchmaking_tickets"));
    const update = calls.find((call) => call.sql.includes("update matchmaking_tickets"));
    expect(insert?.values).toEqual(["ticket-1", "profile-1", "classic", "rapid", 1000, 1400, 1, "2026-05-18T00:00:00.000Z"]);
    expect(update?.values).toEqual(["ticket-1"]);
  });

  test("persists normalized rating pools, profile ratings, and rating events", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);

    await repository.upsertRatingPool({
      id: "classic-rapid-rated",
      familyKey: "chess",
      variantKey: "classic",
      timeControlKey: "rapid",
      ratedOnly: true,
      system: "glicko"
    });
    await repository.saveProfileRating({
      profileId: "profile-1",
      poolId: "classic-rapid-rated",
      rating: 1325.4,
      deviation: 75,
      volatility: 0.06,
      gamesPlayed: 42,
      provisional: false
    });
    await repository.saveRatingEvent({
      gameId: "game-1",
      profileId: "profile-1",
      poolId: "classic-rapid-rated",
      beforeRating: 1312.2,
      afterRating: 1325.4,
      delta: 13.2,
      reason: "rated-bot-game"
    });

    const pool = calls.find((call) => call.sql.includes("insert into rating_pools"));
    const rating = calls.find((call) => call.sql.includes("insert into profile_ratings"));
    const event = calls.find((call) => call.sql.includes("insert into rating_events"));
    expect(pool?.values).toEqual(["classic-rapid-rated", "chess", "classic", "rapid", 1, "glicko"]);
    expect(rating?.values).toEqual(["profile-1", "classic-rapid-rated", 1325.4, 75, 0.06, 42, 0]);
    expect(event?.values).toEqual(["game-1", "profile-1", "classic-rapid-rated", 1312.2, 1325.4, 13.2, "rated-bot-game"]);
  });

  test("replaces leaderboard entries with queryable rows", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);

    await repository.replaceLeaderboardEntries({
      leaderboardId: "classic-rapid",
      entries: [
        {
          rank: 1,
          profileId: "profile-1",
          displayName: "Sharp Player",
          rating: 1801,
          gamesPlayed: 88,
          winRate: 0.64,
          streak: 5,
          metadata: { country: "HK" }
        }
      ]
    });

    const clear = calls.find((call) => call.sql.includes("delete from leaderboard_entries"));
    const entry = calls.find((call) => call.sql.includes("insert into leaderboard_entries"));
    expect(clear?.values).toEqual(["classic-rapid"]);
    expect(entry?.values).toEqual(["classic-rapid", 1, "profile-1", "Sharp Player", 1801, 88, 0.64, 5, JSON.stringify({ country: "HK" })]);
  });

  test("loads normalized leaderboard rows with entries", async () => {
    const { db, calls } = createMockD1(
      {},
      {
        "from leaderboards": [
          {
            id: "classic-rapid",
            scope_id: "global",
            game_id: "classic",
            family_key: "chess-family",
            rated_only: 1,
            period: "all-time",
            computed_at: "2026-05-18T00:00:00.000Z"
          }
        ],
        "from leaderboard_entries": [
          {
            rank: 1,
            profile_id: "profile-1",
            display_name: "Sharp Player",
            rating: 1801,
            games_played: 88,
            win_rate: 0.64,
            streak: 5,
            metadata: JSON.stringify({ country: "HK" }),
            computed_at: "2026-05-18T00:00:00.000Z"
          }
        ]
      }
    );
    const repository = createD1GameRepository(db);

    await expect(repository.getLeaderboards()).resolves.toEqual([
      {
        id: "classic-rapid",
        scopeId: "global",
        gameId: "classic",
        familyKey: "chess-family",
        ratedOnly: true,
        period: "all-time",
        computedAt: "2026-05-18T00:00:00.000Z",
        entries: [
          {
            rank: 1,
            profileId: "profile-1",
            displayName: "Sharp Player",
            rating: 1801,
            gamesPlayed: 88,
            winRate: 0.64,
            streak: 5,
            metadata: { country: "HK" },
            computedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      }
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining("from leaderboards"), values: [] }),
        expect.objectContaining({ sql: expect.stringContaining("from leaderboard_entries"), values: ["classic-rapid"] })
      ])
    );
  });

  test("persists profile game stats and result history rows", async () => {
    const { db, calls } = createMockD1();
    const repository = createD1GameRepository(db);

    await repository.upsertProfileGameStats({
      profileId: "profile-1",
      familyKey: "chess-family",
      variantKey: "classic",
      timeControlKey: "rapid",
      mode: "bot",
      gamesPlayed: 12,
      wins: 8,
      losses: 3,
      draws: 1,
      botGames: 12,
      onlineGames: 0,
      localGames: 0,
      ratedGames: 6,
      totalMoves: 742,
      bestRating: 1390
    });
    await repository.saveProfileGameResult({
      id: "result-1",
      profileId: "profile-1",
      gameId: "game-1",
      familyKey: "chess-family",
      variantKey: "classic",
      timeControlKey: "rapid",
      mode: "bot",
      opponentProfileId: "bot-grandmaster",
      opponentType: "bot",
      result: "win",
      outcomeReason: "checkmate",
      rated: true,
      ratingDelta: 14,
      movesPlayed: 63,
      durationMs: 540000,
      completedAt: "2026-05-18T01:00:00.000Z"
    });

    const stats = calls.find((call) => call.sql.includes("insert into profile_game_stats"));
    const result = calls.find((call) => call.sql.includes("insert into profile_game_results"));
    expect(stats?.values).toEqual(["profile-1", "chess-family", "classic", "rapid", "bot", 12, 8, 3, 1, 12, 0, 0, 6, 742, 1390]);
    expect(result?.values).toEqual([
      "result-1",
      "profile-1",
      "game-1",
      "chess-family",
      "classic",
      "rapid",
      "bot",
      "bot-grandmaster",
      "bot",
      "win",
      "checkmate",
      1,
      14,
      63,
      540000,
      "2026-05-18T01:00:00.000Z"
    ]);
  });

  test("loads recent profile result history from normalized rows", async () => {
    const { db, calls } = createMockD1(
      {},
      {
        "from profile_game_results": [
          {
            id: "result-1",
            profile_id: "profile-1",
            game_id: "game-1",
            family_key: "chess-family",
            variant_key: "classic",
            time_control_key: "rapid",
            mode: "bot",
            opponent_profile_id: "bot-grandmaster",
            opponent_type: "bot",
            result: "win",
            outcome_reason: "checkmate",
            rated: 1,
            rating_delta: 14,
            moves_played: 63,
            duration_ms: 540000,
            completed_at: "2026-05-18T01:00:00.000Z",
            created_at: "2026-05-18T00:30:00.000Z"
          }
        ]
      }
    );
    const repository = createD1GameRepository(db);

    await expect(repository.getProfileGameResults("profile-1", 10)).resolves.toEqual([
      {
        id: "result-1",
        profileId: "profile-1",
        gameId: "game-1",
        familyKey: "chess-family",
        variantKey: "classic",
        timeControlKey: "rapid",
        mode: "bot",
        opponentProfileId: "bot-grandmaster",
        opponentType: "bot",
        result: "win",
        outcomeReason: "checkmate",
        rated: true,
        ratingDelta: 14,
        movesPlayed: 63,
        durationMs: 540000,
        completedAt: "2026-05-18T01:00:00.000Z",
        createdAt: "2026-05-18T00:30:00.000Z"
      }
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("from profile_game_results"),
          values: ["profile-1", 10]
        })
      ])
    );
  });

  test("loads distinct recent saved game results", async () => {
    const { db, calls } = createMockD1(
      {},
      {
        "from profile_game_results": [
          {
            id: "result-1",
            profile_id: "profile-1",
            game_id: "game-1",
            family_key: "chess-family",
            variant_key: "classic",
            time_control_key: "rapid",
            mode: "bot",
            opponent_profile_id: "bot-grandmaster",
            opponent_type: "bot",
            result: "win",
            outcome_reason: "checkmate",
            rated: 1,
            rating_delta: 14,
            moves_played: 63,
            duration_ms: 540000,
            completed_at: "2026-05-18T01:00:00.000Z",
            created_at: "2026-05-18T00:30:00.000Z"
          }
        ]
      }
    );
    const repository = createD1GameRepository(db);

    await expect(repository.getRecentGameResults(7)).resolves.toEqual([
      expect.objectContaining({
        id: "result-1",
        gameId: "game-1",
        variantKey: "classic",
        result: "win"
      })
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("group by game_id"),
          values: [7]
        })
      ])
    );
  });

  test("loads profile game stat summaries from normalized rows", async () => {
    const { db, calls } = createMockD1(
      {},
      {
        "from profile_game_stats": [
          {
            profile_id: "profile-1",
            family_key: "chess-family",
            variant_key: "classic",
            time_control_key: "rapid",
            mode: "bot",
            games_played: 12,
            wins: 8,
            losses: 3,
            draws: 1,
            bot_games: 12,
            online_games: 0,
            local_games: 0,
            rated_games: 6,
            total_moves: 742,
            best_rating: 1390,
            updated_at: "2026-05-18T02:00:00.000Z"
          }
        ]
      }
    );
    const repository = createD1GameRepository(db);

    await expect(repository.getProfileGameStats("profile-1")).resolves.toEqual([
      {
        profileId: "profile-1",
        familyKey: "chess-family",
        variantKey: "classic",
        timeControlKey: "rapid",
        mode: "bot",
        gamesPlayed: 12,
        wins: 8,
        losses: 3,
        draws: 1,
        botGames: 12,
        onlineGames: 0,
        localGames: 0,
        ratedGames: 6,
        totalMoves: 742,
        bestRating: 1390,
        updatedAt: "2026-05-18T02:00:00.000Z"
      }
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("from profile_game_stats"),
          values: ["profile-1"]
        })
      ])
    );
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
