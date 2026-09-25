import { expect, test } from "vitest";
import { chooseBotMoveSafe, createBotSearchStateKey } from "@/lib/bot/runtime";
import { lookupBotKnowledge } from "@/lib/bot/training";
import { applyMove, createInitialState } from "@/lib/variants";
import { createMakrukEndgame } from "@/lib/variants/makruk-endgames";
import { applyMakrukCountAction, readMakrukHonorCount } from "@/lib/variants/makruk-counting";

test("Makruk opening and honor-count endings remain legal at four difficulty anchors", () => {
  for (const state of [createInitialState("makruk"), createMakrukEndgame("two-rooks"), applyMakrukCountAction(createMakrukEndgame("board-honor"), "white", "start-board")]) {
    for (const level of ["elo-100-200", "elo-1400-1500", "elo-2800-2900", "elo-3900-4000"] as const) {
      const result = chooseBotMoveSafe(state, level, { engine: "internal", maxSearchTimeMs: 16 });
      expect(result.reason).toBe("ok");
      if (result.reason !== "ok") throw new Error("Expected a legal bot move.");
      expect(result.validatedLegal).toBe(true);
      expect(result.move).toBeTruthy(); expect(() => applyMove(state, result.move!)).not.toThrow();
    }
  }
});

test("honor claims and deadlines distinguish search keys and bypass static knowledge", () => {
  const state = createMakrukEndgame("board-honor");
  const counted = applyMakrukCountAction(state, "white", "start-board");
  const ending = structuredClone(counted);
  ending.variantState!.makrukHonorCount = { ...readMakrukHonorCount(ending), count: 64, firstMovePending: false };
  expect(new Set([state, counted, ending].map(createBotSearchStateKey)).size).toBe(3);
  expect(lookupBotKnowledge(counted, "easy")).toBeNull();
});
