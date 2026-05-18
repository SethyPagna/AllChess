import { describe, expect, test, vi } from "vitest";

import { createInitialState } from "@/lib/variants";
import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

function createMoveApiD1(boardState: unknown) {
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
              if (sql.includes("select board_state from games")) return { board_state: JSON.stringify(boardState) };
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("game move API", () => {
  test("uses D1 board state instead of trusting a submitted client state", async () => {
    const authoritativeState = createInitialState("classic", "d1-game");
    const submittedState = createInitialState("shogi", "client-state");
    const { db, calls } = createMoveApiD1(authoritativeState);
    runtime.env = { ALLCHESS_D1: db };

    const { POST } = await import("@/app/api/games/[id]/move/route");
    const response = await POST(
      new Request("http://allchess.test/api/games/d1-game/move", {
        method: "POST",
        body: JSON.stringify({
          state: submittedState,
          move: { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }
        })
      }),
      { params: Promise.resolve({ id: "d1-game" }) }
    );

    await expect(response.json()).resolves.toMatchObject({
      mode: "d1",
      state: { id: "d1-game", variantKey: "classic", ply: 1 }
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("select board_state from games where id = ?"),
          values: ["d1-game"]
        })
      ])
    );
  });
});
