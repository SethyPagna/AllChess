import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, type GameState } from "@/lib/variants";
import { applyMakrukCountAction, getMakrukCountChoices, initializeMakrukPieceCount, makrukHonorLimit, readMakrukHonorCount, replayMakrukCountActions, withMakrukBotCount } from "@/lib/variants/makruk-counting";
import { createMakrukEndgame } from "@/lib/variants/makruk-endgames";
import { prepareMakrukBotTurn } from "@/lib/bot/makruk-counting";

const move = (state: GameState, r1: number, c1: number, r2: number, c2: number) => applyMove(state, { from: { row: r1, col: c1 }, to: { row: r2, col: c2 } });
const mate = (state: GameState) => move(state, 2, 1, 2, 0);

describe("Makruk published honor-count profile", () => {
  test("new games use a versioned profile and never silently claim board honor", () => {
    expect(createInitialState("makruk").variantState?.makrukProfile).toBe("honor-v1");
    const state = createMakrukEndgame("board-honor");
    expect(readMakrukHonorCount(move(state, 7, 0, 7, 1))).toBeNull();
    expect(getMakrukCountChoices(state, "white").board).toBe(true);
    expect(() => applyMakrukCountAction(state, "black", "start-board")).toThrow();
    expect(() => applyMakrukCountAction(createInitialState("makruk"), "white", "start-board")).toThrow();
    expect(() => applyMakrukCountAction(createInitialState("classic"), "white", "start-board")).toThrow();
    delete state.variantState;
    expect(() => applyMakrukCountAction(state, "white", "start-board")).toThrow();
  });

  test.each([["rr", 8], ["r", 16], ["ss", 22], ["nn", 32], ["s", 44], ["n", 64], ["mmm", 64], ["ssnn", 22], ["rnn", 16]])("material %s has fixed limit %i", (codes, limit) => {
    const state = createMakrukEndgame("two-rooks");
    state.board.forEach(row => row.forEach(cell => { if (cell.piece?.owner === "black" && cell.piece.code !== "k") cell.piece = null; }));
    [...codes].forEach((code, col) => { state.board[0][col].piece = { id: `black-${col}`, code, labelKey: code, owner: "black" }; });
    expect(makrukHonorLimit(state, "black")).toBe(limit);
  });

  test("only the escaping moves count, 8 is playable and 9 draws against two rooks", () => {
    let state = createMakrukEndgame("two-rooks");
    expect(readMakrukHonorCount(state)).toMatchObject({ count: 5, limit: 8, firstMovePending: true });
    for (let i = 0; i < 4; i++) {
      state = move(state, 7, i % 2, 7, 1 - i % 2);
      expect(readMakrukHonorCount(state)?.count).toBe(5 + i);
      expect(state.status).toBe("active");
      state = move(state, 3, 3 + i % 2, 3, 4 - i % 2);
      expect(readMakrukHonorCount(state)?.count).toBe(5 + i);
    }
    state = move(state, 7, 0, 7, 1);
    expect(state).toMatchObject({ status: "completed", result: "draw", outcomeReason: "counting-rule" });
    expect(readMakrukHonorCount(state)?.count).toBe(9);
  });

  test("capturing a rook never restarts or lengthens a piece count", () => {
    let state = createMakrukEndgame("two-rooks");
    state.board[6][1].piece = state.board[2][7].piece; state.board[2][7].piece = null;
    state = move(state, 7, 0, 6, 1);
    expect(readMakrukHonorCount(state)).toMatchObject({ phase: "pieces", count: 5, limit: 8, startedAtPly: 0 });
    expect(makrukHonorLimit(state, "black")).toBe(16);
    expect(() => applyMakrukCountAction(state, "white", "stop")).toThrow();
    expect(() => applyMakrukCountAction(state, "black", "claim-draw")).toThrow();
  });

  test("piece honor waits until every unpromoted pawn is gone, then starts automatically", () => {
    let state = createMakrukEndgame("two-rooks");
    delete state.variantState!.makrukHonorCount;
    state.board[2][7].piece = null;
    state.board[4][1].piece = { id: "last-pawn", code: "p", owner: "black", labelKey: "p" };
    state.turn = "black";
    expect(initializeMakrukPieceCount(state)).toBe(false);
    expect(getMakrukCountChoices(state, "black").board).toBe(false);
    state = move(state, 4, 1, 5, 1);
    expect(state.board[5][1].piece).toMatchObject({ code: "m", promoted: true });
    expect(readMakrukHonorCount(state)).toMatchObject({ side: "white", count: 5, limit: 16, firstMovePending: true });
  });

  test("piece honor overrides board honor when the escaping player loses their last piece", () => {
    let state = createMakrukEndgame("board-honor");
    state.board[6][7].piece = state.board[0][7].piece; state.board[0][7].piece = null;
    state = applyMakrukCountAction(state, "white", "start-board");
    state = move(state, 7, 0, 7, 1); state = move(state, 6, 7, 6, 2);
    expect(readMakrukHonorCount(state)).toMatchObject({ phase: "pieces", side: "white", count: 4, limit: 16, firstMovePending: true });
  });

  test("board honor can stop off-turn, restart at one, and be accepted only by the opponent", () => {
    let state = applyMakrukCountAction(createMakrukEndgame("board-honor"), "white", "start-board");
    state = move(state, 7, 0, 7, 1);
    expect(() => applyMakrukCountAction(state, "black", "stop")).toThrow();
    expect(() => applyMakrukCountAction(state, "white", "claim-draw")).toThrow();
    state = applyMakrukCountAction(state, "white", "stop");
    expect(readMakrukHonorCount(state)).toBeNull();
    state = applyMakrukCountAction(state, "black", "start-board");
    expect(readMakrukHonorCount(state)).toMatchObject({ side: "black", count: 1, firstMovePending: true });
    const result = applyMakrukCountAction(state, "white", "claim-draw");
    expect(result).toMatchObject({ result: "draw", outcomeReason: "counting-rule", variantState: { makrukCountOutcome: "accepted" } });
    expect(() => applyMakrukCountAction(result, "black", "stop")).toThrow();
  });

  test("board count ends at 65 rather than 64", () => {
    let state = applyMakrukCountAction(createMakrukEndgame("board-honor"), "white", "start-board");
    state.variantState!.makrukHonorCount = { ...readMakrukHonorCount(state), count: 63, firstMovePending: false };
    state = move(state, 7, 0, 7, 1); expect(state.status).toBe("active");
    expect(readMakrukHonorCount(state)?.count).toBe(64);
    state = move(state, 1, 5, 1, 4); expect(readMakrukHonorCount(state)?.count).toBe(64);
    state = move(state, 7, 1, 7, 0); expect(state.result).toBe("draw");
    expect(readMakrukHonorCount(state)?.count).toBe(65);
  });

  test("a counting player's mate draws unless they stop first; a chaser's mate still wins", () => {
    const state = createMakrukEndgame("countermate");
    expect(mate(state).result).toBe("white");
    const counted = applyMakrukCountAction(state, "white", "start-board");
    expect(mate(counted)).toMatchObject({ result: "draw", variantState: { makrukCountOutcome: "countermate" } });
    expect(mate(applyMakrukCountAction(counted, "white", "stop")).result).toBe("white");
    counted.variantState!.makrukHonorCount = { ...readMakrukHonorCount(counted), side: "black", count: 64, firstMovePending: false };
    expect(mate(counted)).toMatchObject({ result: "white", outcomeReason: "checkmate" });
  });

  test("defending bots claim board honor and mating bots stop or avoid a claim", () => {
    expect(readMakrukHonorCount(withMakrukBotCount(createMakrukEndgame("board-honor")))?.side).toBe("white");
    const mating = createMakrukEndgame("countermate");
    expect(prepareMakrukBotTurn(mating)).toBe(mating);
    const prepared = prepareMakrukBotTurn(applyMakrukCountAction(mating, "white", "start-board"));
    expect(readMakrukHonorCount(prepared)).toBeNull(); expect(mate(prepared).result).toBe("white");
    const count = createMakrukEndgame("two-rooks"); expect(prepareMakrukBotTurn(count)).toBe(count);
  });

  test("room review replays same-ply start/stop/restart events before advancing the board", () => {
    const initial = createMakrukEndgame("board-honor");
    let counted = applyMakrukCountAction(initial, "white", "start-board");
    counted = applyMakrukCountAction(counted, "white", "stop");
    counted = applyMakrukCountAction(counted, "white", "start-board");
    const next = move(counted, 7, 0, 7, 1);
    const frame = replayMakrukCountActions(initial, next);
    expect(frame.variantState).toEqual(counted.variantState);
    expect(move(frame, 7, 0, 7, 1).variantState).toEqual(next.variantState);
  });
});
