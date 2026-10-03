import { describe, expect, test } from "vitest";

import { chooseBotMove } from "@/lib/bot/runtime";
import { moveToUci, uciToLegalMove } from "@/lib/bot/stockfish-engine";
import { applyAuthoritativeRoomMove, createRoomSnapshot } from "@/lib/realtime/rooms";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, type GameState, type PlayerColor } from "@/lib/variants";

type Placement = [row: number, col: number, code: string, owner: PlayerColor];

function position(variantKey: string, pieces: Placement[], turn: PlayerColor = "white"): GameState {
  const state = createInitialState(variantKey, `${variantKey}-promotion`);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  for (const [row, col, code, owner] of pieces) state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: `chess.${code}` };
  state.turn = turn;
  return state;
}

const a7 = { row: 1, col: 0 };
const a8 = { row: 0, col: 0 };
const classicPromotion = () => position("classic", [[1, 0, "p", "white"], [7, 7, "k", "white"], [0, 7, "k", "black"]]);

describe("Western promotion choices", () => {
  test("classic offers queen, rook, bishop and knight, queen first", () => {
    const moves = getLegalMoves(classicPromotion(), a7);

    expect(moves).toEqual(["q", "r", "b", "n"].map((promoteTo) => ({ from: a7, to: a8, promotion: true, promoteTo })));
  });

  test.each(["q", "r", "b", "n"])("classic promotion to %s places that piece and records the choice", (promoteTo) => {
    const next = applyMove(classicPromotion(), { from: a7, to: a8, promoteTo });

    expect(next.board[0][0].piece).toMatchObject({ code: promoteTo, owner: "white", promoted: true });
    expect(next.board[1][0].piece).toBeNull();
    expect(next.moves.at(-1)).toMatchObject({ from: a7, to: a8, promotion: true, promoteTo });
    expect(next.moves.at(-1)?.notation).toBe(promoteTo === "q" ? "P1,0-0,0" : `P1,0-0,0=${promoteTo.toUpperCase()}`);
  });

  test("a promotion request without promoteTo defaults to a queen", () => {
    for (const request of [{ from: a7, to: a8 }, { from: a7, to: a8, promotion: true }]) {
      const next = applyMove(classicPromotion(), request);
      expect(next.board[0][0].piece).toMatchObject({ code: "q", promoted: true });
      expect(next.moves.at(-1)).toMatchObject({ promotion: true, promoteTo: "q" });
    }
    expect(findLegalMove(classicPromotion(), { from: a7, to: a8 })).toMatchObject({ promoteTo: "q" });
  });

  test("capturing promotions and uppercase choices resolve to the requested piece", () => {
    const state = position("classic", [[1, 1, "p", "white"], [0, 0, "r", "black"], [7, 7, "k", "white"], [0, 7, "k", "black"]]);
    const next = applyMove(state, { from: { row: 1, col: 1 }, to: a8, promoteTo: "N" });

    expect(next.board[0][0].piece).toMatchObject({ code: "n", owner: "white" });
    expect(next.captured).toEqual([expect.objectContaining({ code: "r", owner: "black" })]);
  });

  test("rejects promotion pieces the variant does not allow and choices on ordinary moves", () => {
    expect(() => applyMove(classicPromotion(), { from: a7, to: a8, promoteTo: "k" })).toThrow("errors.invalidMove");
    expect(() => applyMove(classicPromotion(), { from: a7, to: a8, promoteTo: "p" })).toThrow("errors.invalidMove");
    expect(() => applyMove(classicPromotion(), { from: { row: 7, col: 7 }, to: { row: 7, col: 6 }, promoteTo: "q" })).toThrow("errors.invalidMove");
    expect(findLegalMove(classicPromotion(), { from: a7, to: a8, promoteTo: "x" })).toBeNull();
  });

  test("antichess pawns may also promote to a king", () => {
    const state = position("antichess", [[1, 0, "p", "white"], [3, 7, "p", "black"]]);

    expect(getLegalMoves(state, a7).map((move) => move.promoteTo)).toEqual(["q", "r", "b", "n", "k"]);
    const next = applyMove(state, { from: a7, to: a8, promoteTo: "k" });
    expect(next.board[0][0].piece).toMatchObject({ code: "k", owner: "white", promoted: true });
  });

  test("crazyhouse returns a captured underpromoted piece to hand as a pawn", () => {
    let state = position("crazyhouse", [[1, 0, "p", "white"], [0, 1, "r", "black"], [7, 4, "k", "white"], [0, 4, "k", "black"]]);
    state = applyMove(state, { from: a7, to: a8, promoteTo: "n" });
    expect(state.board[0][0].piece).toMatchObject({ code: "n", promoted: true });

    state = applyMove(state, { from: { row: 0, col: 1 }, to: a8 });

    expect(state.hands?.black).toEqual({ p: 1 });
    expect(state.captured.at(-1)).toMatchObject({ code: "n", promoted: true });
  });

  test("single-choice historical promotions keep their piece and reject a requested choice", () => {
    const state = position("chaturanga", [[1, 0, "p", "white"], [7, 7, "k", "white"], [0, 7, "k", "black"]]);

    expect(getLegalMoves(state, a7)).toEqual([{ from: a7, to: a8 }]);
    expect(applyMove(state, { from: a7, to: a8 }).board[0][0].piece?.code).toBe("m");
    expect(() => applyMove(state, { from: a7, to: a8, promoteTo: "q" })).toThrow("errors.invalidMove");
  });

  test("UCI promotion suffixes map to promoteTo and back", () => {
    const state = classicPromotion();

    expect(uciToLegalMove(state, "a7a8n")).toMatchObject({ from: a7, to: a8, promotion: true, promoteTo: "n" });
    expect(uciToLegalMove(state, "a7a8r")).toMatchObject({ promoteTo: "r" });
    expect(uciToLegalMove(state, "a7a8")).toMatchObject({ promoteTo: "q" });
    expect(uciToLegalMove(state, "a7a8k")).toBeNull();
    expect(moveToUci(state, { from: a7, to: a8, promotion: true, promoteTo: "b" })).toBe("a7a8b");
    expect(moveToUci(state, { from: a7, to: a8, promotion: true })).toBe("a7a8q");
  });

  test("room moves carry the promotion choice", () => {
    const snapshot = createRoomSnapshot({ state: classicPromotion() });
    const result = applyAuthoritativeRoomMove(snapshot, { from: a7, to: a8, promoteTo: "r" });

    expect(result.ok).toBe(true);
    expect(result.snapshot.state.board[0][0].piece?.code).toBe("r");
    expect(applyAuthoritativeRoomMove(snapshot, { from: a7, to: a8, promoteTo: "k" }).ok).toBe(false);
  });

  test("the internal bot finds a knight underpromotion that mates", () => {
    // Nf8 mates the h7 king; a queen or rook on f8 does not even give check.
    const state = position("classic", [
      [1, 5, "p", "white"],
      [7, 0, "k", "white"],
      [1, 7, "k", "black"],
      [1, 6, "p", "black"],
      [2, 7, "p", "black"],
      [0, 6, "n", "black"],
      [0, 7, "r", "black"]
    ]);
    const move = chooseBotMove(state, "normal", { engine: "internal" });

    expect(move).toMatchObject({ from: { row: 1, col: 5 }, to: { row: 0, col: 5 }, promoteTo: "n" });
    expect(applyMove(state, move)).toMatchObject({ status: "completed", result: "white", outcomeReason: "checkmate" });
  });
});
