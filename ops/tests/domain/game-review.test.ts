import { describe, expect, test } from "vitest";

import { buildMoveTimeline, summarizeMoves } from "@/lib/game/review";
import { applyMove, createInitialState, type GameState, type Move, type Piece } from "@/lib/variants";

function emptyPosition(variant: string) {
  const state = createInitialState(variant, `review-${variant}`);
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  return state;
}

function put(state: GameState, row: number, col: number, code: string, owner: Piece["owner"]) {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
}

describe("factual move timeline", () => {
  test("never invents move quality from the move index or notation", () => {
    const recorded = Array.from({ length: 12 }, (_, index) => ({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, notation: index === 3 ? "Q0,3x4,7" : `move ${index + 1}` }));
    const moves = buildMoveTimeline(recorded);
    expect(moves.map(move => move.notation)).toEqual(recorded.map(move => move.notation));
    expect(moves.every(move => move.label === null && move.captureCount === null)).toBe(true);
    for (const move of moves) {
      expect(move).not.toHaveProperty("classification");
      expect(move).not.toHaveProperty("score");
      expect(move).not.toHaveProperty("bestLine");
    }
    expect(summarizeMoves(moves)).toMatchObject({ moves: 12, captures: null });
  });

  test("reads en passant captures from positions even though notation omits x", () => {
    const initial = emptyPosition("classic");
    put(initial, 7, 4, "k", "white"); put(initial, 0, 4, "k", "black");
    put(initial, 3, 4, "p", "white"); put(initial, 1, 3, "p", "black"); initial.turn = "black";
    const before = applyMove(initial, { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } });
    const after = applyMove(before, { from: { row: 3, col: 4 }, to: { row: 2, col: 3 } });
    const moves = buildMoveTimeline(after.moves, [initial, before, after]);
    expect(moves[1]).toMatchObject({ captureCount: 1, label: "Capture" });
    expect(summarizeMoves(moves)).toMatchObject({ moves: 2, captures: 1 });
    expect(buildMoveTimeline(after.moves, [after])[1].captureCount).toBeNull();

    // Older saves stored the raw request (explicit kind "move", a promotion flag, other notation);
    // it still identifies the same move, so the capture count survives.
    const legacy = after.moves.map((move, index) => (index === 1 ? { ...move, kind: "move" as const, promotion: false, notation: "exd6 e.p." } : move));
    expect(buildMoveTimeline(legacy, [initial, before, after])[1]).toMatchObject({ captureCount: 1, notation: "exd6 e.p." });
    const different = after.moves.map((move, index) => (index === 1 ? { ...move, to: { row: 2, col: 4 } } : move));
    expect(buildMoveTimeline(different, [initial, before, after])[1].captureCount).toBeNull();
  });

  test("records automatic draughts crowning from the actual resulting piece", () => {
    const before = emptyPosition("english-draughts");
    put(before, 1, 2, "p", "white"); put(before, 6, 1, "p", "black");
    const after = applyMove(before, { from: { row: 1, col: 2 }, to: { row: 0, col: 1 } });
    expect(after.moves[0].promotion).toBeUndefined();
    expect(buildMoveTimeline(after.moves, [before, after])[0]).toMatchObject({ promotion: true, label: "Promotion", captureCount: 0 });
  });

  test("distinguishes Kōnane opening removal from a multiple-stone capture", () => {
    const initial = createInitialState("konane", "review-konane-opening");
    const removed = applyMove(initial, { kind: "remove", from: { row: 0, col: 0 }, to: { row: 0, col: 0 } });
    expect(buildMoveTimeline(removed.moves, [initial, removed])[0]).toMatchObject({ label: "Remove", captureCount: 0 });
    const before = emptyPosition("konane");
    before.variantState = { ...before.variantState, konaneOpening: { removals: 2 } };
    put(before, 0, 0, "p", "black");
    for (const col of [1, 3, 5]) put(before, 0, col, "p", "white");
    const after = applyMove(before, { from: { row: 0, col: 0 }, to: { row: 0, col: 6 } });
    expect(buildMoveTimeline(after.moves, [before, after])[0]).toMatchObject({ captureCount: 3, label: "3 captures" });
  });

  test("retains distinct drop, pass, removal, and explicit promotion events without position data", () => {
    const move: Move = { from: { row: 1, col: 1 }, to: { row: 0, col: 1 } };
    const moves = buildMoveTimeline([
      { ...move, kind: "drop", drop: { id: "hand-pawn", code: "p", owner: "sente", labelKey: "pawn" }, notation: "P*1b" },
      { ...move, kind: "pass", notation: "pass" },
      { ...move, kind: "remove", notation: "remove b2" },
      { ...move, promotion: true, notation: "b7-b8+" }
    ]);
    expect(moves.map(entry => entry.label)).toEqual(["Drop", "Pass", "Remove", "Promotion"]);
    expect(summarizeMoves(moves)).toEqual({ moves: 4, captures: null, promotions: 1, drops: 1, passes: 1, removals: 1 });
  });

  test("does not attach capture facts from a different saved game or replay branch", () => {
    const before = createInitialState("classic", "review-first");
    const after = applyMove(before, { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });
    expect(buildMoveTimeline(after.moves, [{ ...before, id: "review-other" }, after])[0].captureCount).toBeNull();
    const branch = applyMove(before, { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } });
    expect(buildMoveTimeline(after.moves, [before, branch])[0].captureCount).toBeNull();
  });
});
