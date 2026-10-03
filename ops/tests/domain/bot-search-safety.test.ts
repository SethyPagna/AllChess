import { afterEach, describe, expect, test, vi } from "vitest";

import { allLegalMoves, chooseBotMoveSafe, getBotSearchTimeMs, requestBotMove, type BotTierKey } from "@/lib/bot/runtime";
import { applyMove, createInitialState, getVariant, type GameState, type PlayerColor } from "@/lib/variants";

function position(variantKey: string, rows: string[], turn: PlayerColor = "white", hands?: GameState["hands"]) {
  const state = createInitialState(variantKey, "bot-search-safety");
  const [first, second] = getVariant(variantKey).players;
  for (const [row, cells] of state.board.entries()) {
    for (const [col, cell] of cells.entries()) {
      const token = rows[row]?.[col] ?? ".";
      const owner = token === token.toUpperCase() ? first : second;
      cell.piece = token === "." ? null : { id: `${owner}-${token}-${row}-${col}`, code: token.toLowerCase(), owner, labelKey: "chess.pawn" };
    }
  }
  state.turn = turn;
  if (hands) state.hands = hands;
  return state;
}

function winningReplies(state: GameState, loser: PlayerColor) {
  return allLegalMoves(state).filter((move) => {
    const next = applyMove(state, move);
    return next.status === "completed" && next.result !== loser && next.result !== "draw";
  });
}

function wideShogiInterposition() {
  return position("shogi", ["........k", ".........", ".........", "..n......", "NN.......", "K.......r", "NN.......", ".........", "........."], "sente", { sente: { p: 1, l: 1, n: 1, s: 1, g: 1, b: 1, r: 1 }, gote: {} });
}

afterEach(() => vi.restoreAllMocks());

describe("bot search safety", () => {
  test.each(["classic", "king-of-the-hill", "crazyhouse"])("%s never prefers an unsearched queen sacrifice to searched quiet moves", (variantKey) => {
    const state = position(variantKey, ["......k.", ".....ppp", "....p...", "...n....", "........", "........", "P....PPP", "...Q..K."]);
    for (const tier of ["normal", "grandmaster", "legend"] as BotTierKey[]) {
      const result = chooseBotMoveSafe(state, tier, { engine: "internal", maxSearchTimeMs: 100 });
      expect(result.move, tier).not.toMatchObject({ from: { row: 7, col: 3 }, to: { row: 3, col: 3 } });
      expect(result.reason).toBe("ok");
    }
  });

  test.each(["classic", "crazyhouse", "three-check"])("%s declines a promotion that allows mate in one", (variantKey) => {
    const state = position(variantKey, ["........", ".P.....k", "........", "........", "...r....", "........", ".....PPP", "......K."]);
    for (const tier of ["grandmaster", "legend"] as BotTierKey[]) {
      const result = chooseBotMoveSafe(state, tier, { engine: "internal", maxSearchTimeMs: 200 });
      expect(result.move).not.toBeNull();
      expect(winningReplies(applyMove(state, result.move!), "white"), tier).toEqual([]);
    }
  });

  test("a pawn push is not protection for a checking knight drop", () => {
    const state = position("crazyhouse", ["....rk..", "........", "........", "....P...", "........", "........", "........", "K......."], "white", { white: { n: 1 }, black: {} });
    const result = chooseBotMoveSafe(state, "legend", { engine: "internal", maxSearchTimeMs: 8 });
    expect(result.move).not.toMatchObject({ kind: "drop", to: { row: 2, col: 4 } });
  });

  test("a forced interposition is safe at both ends of the difficulty ladder", () => {
    const state = position("crazyhouse", [".......k", "........", "........", "........", "........", "..n.....", "PP......", "K......r"], "white", { white: { n: 1, b: 1, r: 1, q: 1 }, black: {} });
    for (const tier of ["elo-100-200", "legend"] as BotTierKey[]) {
      const result = chooseBotMoveSafe(state, tier, { engine: "internal", maxSearchTimeMs: 200 });
      expect(result.move?.kind).toBe("drop");
      expect(winningReplies(applyMove(state, result.move!), "white"), tier).toEqual([]);
    }
  });

  test.each<BotTierKey>(["elo-100-200", "legend"])("%s finds a safe interposition among more than 48 drops within a short search", (tier) => {
    const state = wideShogiInterposition();
    const moves = allLegalMoves(state);
    expect(moves).toHaveLength(49);
    expect(moves.every((move) => move.kind === "drop" && move.to.row === 5)).toBe(true);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = chooseBotMoveSafe(state, tier, { engine: "internal", maxSearchTimeMs: 300 });
      expect(result.move).toMatchObject({ kind: "drop", to: { row: 5 } });
      expect(winningReplies(applyMove(state, result.move!), "sente")).toEqual([]);
    }
  });

  test("an expired search retains drop ordering for a safe forced-interposition fallback", () => {
    const state = wideShogiInterposition();
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 100));
    const result = chooseBotMoveSafe(state, "legend", { engine: "internal", maxSearchTimeMs: 50 });
    expect(result.reason).toBe("ok");
    if (result.reason !== "ok") throw new Error("Expected a legal fallback.");
    expect(result.nodesSearched).toBe(0);
    expect(winningReplies(applyMove(state, result.move), "sente")).toEqual([]);
  });

  test("an expired search does not start scoring every remaining root", () => {
    const state = position("crazyhouse", ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "....K..."], "white", { white: { r: 1, b: 1, n: 1, q: 1 }, black: {} });
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 100));
    const result = chooseBotMoveSafe(state, "normal", { engine: "internal", maxSearchTimeMs: 50 });
    expect(result.reason).toBe("ok");
    if (result.reason !== "ok") throw new Error("Expected a legal fallback.");
    expect(result.nodesSearched).toBeLessThanOrEqual(1);
    expect(() => applyMove(state, result.move)).not.toThrow();
  });

  test.each<BotTierKey>(["normal", "legend"])("%s suppresses the think delay and returns while the clock is low", async (tier) => {
    const state = position("king-of-the-hill", ["......k.", ".....ppp", "....p...", "...n....", "........", "........", "P....PPP", "...Q..K."]);
    state.clocks = state.clocks.map((clock) => ({ ...clock, remainingMs: clock.color === "white" ? 1500 : 60000, incrementMs: 0 }));
    const timers = vi.spyOn(globalThis, "setTimeout");
    const result = await requestBotMove(state, tier, { engine: "internal", delayMs: 80 });
    expect(result.status).toBe("ok");
    expect(timers.mock.calls[0]?.[1]).toBe(0);
    expect(result.elapsedMs).toBeLessThan(750);
  });

  test("clock budgets use the mover's time, reserve flag safety, and preserve untimed search", () => {
    const state = createInitialState("classic", "clock-budget");
    state.clocks = [{ color: "white", remainingMs: 1500, incrementMs: 0 }, { color: "black", remainingMs: 60000, incrementMs: 0 }];
    expect(getBotSearchTimeMs(state, "legend")).toBe(50);
    expect(getBotSearchTimeMs(state, "legend", 1)).toBe(1);
    expect(getBotSearchTimeMs({ ...state, turn: "black" }, "legend")).toBe(2000);
    state.clocks[0].incrementMs = 20000;
    expect(getBotSearchTimeMs(state, "legend")).toBe(1380);
    state.clocks[0].remainingMs = 0;
    expect(getBotSearchTimeMs(state, "legend")).toBe(1);
    state.clocks = state.clocks.map((clock) => ({ ...clock, remainingMs: 0, incrementMs: 0 }));
    expect(getBotSearchTimeMs(state, "legend")).toBe(2600);
  });
});
