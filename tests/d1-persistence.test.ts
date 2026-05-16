import { describe, expect, test } from "vitest";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { createInitialState } from "@/lib/variants";
import type { D1Database } from "@cloudflare/workers-types";

function createMockD1() {
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
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("D1 persistence", () => {
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
  });
});
