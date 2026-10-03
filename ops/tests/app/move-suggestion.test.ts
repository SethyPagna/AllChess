import { describe, expect, test } from "vitest";
import { createMoveSuggestion, resolveMoveSuggestion, suggestionSelection } from "@/lib/game/move-suggestion";
import { applyMove, createInitialState, getLegalMoves, type Move } from "@/lib/variants";

describe("playable hints", () => {
  test("an opening hint retains its move and uses readable notation", () => {
    const state = createInitialState("classic");
    const move = getLegalMoves(state, { row: 6, col: 4 }).find(move => move.to.row === 4)!;
    const suggestion = createMoveSuggestion(state, move);
    expect(suggestion.notation).toBe("e4");
    expect(suggestionSelection(suggestion)).toEqual({ square: move.from, handCode: null });
    expect(applyMove(state, resolveMoveSuggestion(state, suggestion)!).board[4][4].piece?.code).toBe("p");
  });

  test.each(["crazyhouse", "shogi", "mini-shogi"])("%s hints select a hand piece and play a legal drop", variant => {
    const state = createInitialState(variant);
    const owner = state.turn;
    state.hands = { ...state.hands, [owner]: { p: 1 } };
    if (variant !== "crazyhouse") state.board.flat().forEach(cell => { if (cell.piece?.owner === owner && cell.piece.code === "p") cell.piece = null; });
    const piece = { id: "hint-hand", code: "p", owner, labelKey: "chess.pawn" };
    const move = getLegalMoves(state, { drop: piece })[0];
    expect(move).toBeDefined();
    const suggestion = createMoveSuggestion(state, move);
    expect(suggestion.kind).toBe("drop");
    expect(suggestion.notation).toMatch(/P[@*]/);
    expect(suggestionSelection(suggestion)).toEqual({ square: null, handCode: "p" });
    const next = applyMove(state, resolveMoveSuggestion(state, suggestion)!);
    expect(next.board[move.to.row][move.to.col].piece).toMatchObject({ code: "p", owner });
    expect(next.hands?.[owner]?.p ?? 0).toBe(0);
  });

  test("Janggi pass hints advance the turn without selecting an off-board cell", () => {
    const state = createInitialState("janggi");
    const move: Move = { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };
    const suggestion = createMoveSuggestion(state, move);
    expect(suggestion.notation).toBe("pass");
    expect(suggestionSelection(suggestion)).toEqual({ square: null, handCode: null });
    const next = applyMove(state, resolveMoveSuggestion(state, suggestion)!);
    expect(next.turn).not.toBe(state.turn);
    expect(next.board).toEqual(state.board);
    expect(next.moves.at(-1)?.kind).toBe("pass");
  });

  test("an explicit knight underpromotion does not turn into a queen", () => {
    const state = createInitialState("classic");
    for (const cell of state.board.flat()) cell.piece = null;
    for (const [row, col, code, owner] of [[7, 7, "k", "white"], [0, 7, "k", "black"], [1, 0, "p", "white"]] as const) {
      state.board[row][col].piece = { id: `${owner}-${code}`, code, owner, labelKey: "chess.pawn" };
    }
    const move = getLegalMoves(state, { row: 1, col: 0 }).find(move => move.promoteTo === "n")!;
    const suggestion = createMoveSuggestion(state, move);
    expect(suggestion.notation).toBe("a8=N");
    expect(applyMove(state, resolveMoveSuggestion(state, suggestion)!).board[0][0].piece?.code).toBe("n");
  });

  test("stale, finished and illegal hints cannot be played", () => {
    const state = createInitialState("classic");
    const move = getLegalMoves(state, { row: 6, col: 4 })[0];
    const suggestion = createMoveSuggestion(state, move);
    expect(resolveMoveSuggestion({ ...state, id: "another-game" }, suggestion)).toBeNull();
    expect(resolveMoveSuggestion({ ...state, ply: state.ply + 2 }, suggestion)).toBeNull();
    expect(resolveMoveSuggestion({ ...state, status: "completed", result: "black", outcomeReason: "timeout" }, suggestion)).toBeNull();
    expect(resolveMoveSuggestion(state, { ...suggestion, kind: "drop" })).toBeNull();
    expect(resolveMoveSuggestion(state, { ...suggestion, kind: "pass" })).toBeNull();
  });
});
