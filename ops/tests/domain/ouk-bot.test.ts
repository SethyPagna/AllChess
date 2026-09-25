import { describe, expect, test } from "vitest";
import { chooseBotMoveSafe, createBotSearchStateKey } from "@/lib/bot/runtime";
import { applyMove, createInitialState } from "@/lib/variants";
import { createOukEndgame } from "@/lib/variants/ouk-endgames";
import { applyOukCountAction, readOukCount, withOukBotCount } from "@/lib/variants/ouk-counting";
import { prepareOukBotTurn } from "@/lib/bot/ouk-counting";

describe("Cambodian bot rules integration", () => {
  test("a bot preserves a mate instead of starting or continuing a board-count draw", () => {
    const state = createOukEndgame("countermate");
    expect(prepareOukBotTurn(state)).toBe(state);
    const counted = applyOukCountAction(state, "white", "start-board");
    const prepared = prepareOukBotTurn(counted);
    expect(readOukCount(prepared)).toBeNull();
    expect(applyMove(prepared, { from: { row: 2, col: 1 }, to: { row: 2, col: 0 } }).result).toBe("white");
  });
  test("opening and counted endgame moves remain legal across difficulty anchors", () => {
    for (const state of [createInitialState("ouk-chaktrang"), withOukBotCount(createOukEndgame("two-rooks"))]) {
      for (const level of ["elo-100-200", "elo-1400-1500", "elo-2800-2900", "elo-3900-4000"] as const) {
        const result = chooseBotMoveSafe(state, level, { engine: "internal", maxSearchTimeMs: 16 });
        expect(result.reason).toBe("ok");
        if (!result.move) throw new Error(`No Cambodian move at ${level}`);
        expect(result.validatedLegal).toBe(true);
        expect(() => applyMove(state, result.move!)).not.toThrow();
      }
    }
  });
  test("counting claims and limits distinguish search-cache positions", () => {
    const state = createOukEndgame("two-rooks");
    const board = applyOukCountAction(state, "white", "start-board");
    const pieces = applyOukCountAction(state, "white", "start-pieces");
    expect(new Set([state, board, pieces].map(createBotSearchStateKey)).size).toBe(3);
  });
  test("a bot keeps a nearly finished board count instead of restarting a longer piece count", () => {
    const state = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-board");
    state.variantState!.oukCount = { ...readOukCount(state), count: 63, firstMovePending: false };
    expect(withOukBotCount(state)).toBe(state);
  });
});
