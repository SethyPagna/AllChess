import { describe, expect, test } from "vitest";

import { describeGameOutcome } from "@/lib/game/outcome";
import { tickGameClock } from "@/lib/game/clocks";
import { applyMove, createInitialState, type GameState, type PlayerColor } from "@/lib/variants";

function position(variantKey: string, turn: PlayerColor, placements: [number, number, string, PlayerColor][]): GameState {
  const state = createInitialState(variantKey, `outcome-${variantKey}`);
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  for (const [row, col, code, owner] of placements) {
    state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
  }
  return { ...state, turn };
}

function shatranjStalemate() {
  const before = position("shatranj", "white", [[0, 0, "k", "black"], [5, 6, "p", "black"], [2, 1, "k", "white"], [0, 3, "f", "white"], [7, 7, "r", "white"], [6, 6, "p", "white"]]);
  return applyMove(before, { from: { row: 0, col: 3 }, to: { row: 1, col: 2 } });
}

describe("game outcome descriptions", () => {
  test("describes checkmate wins with a clear headline and reason", () => {
    let state = createInitialState("classic", "mate-outcome");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const completed = applyMove(state, { from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    const outcome = describeGameOutcome(completed, "white");

    expect(outcome).toMatchObject({
      winner: "white",
      result: "win",
      reason: "checkmate",
      headline: "You won by checkmate",
      completedAtPly: 1
    });
    expect(outcome?.context.join(" ")).toContain("escape, capture, or block");
  });

  test("describes draws without celebration", () => {
    const state = {
      ...createInitialState("classic", "draw-outcome"),
      status: "completed" as const,
      result: "draw" as const,
      outcomeReason: "stalemate" as const,
      ply: 42
    };

    expect(describeGameOutcome(state, "white")).toMatchObject({
      winner: null,
      result: "draw",
      reason: "stalemate",
      celebrate: false,
      headline: "Draw by stalemate"
    });
    expect(describeGameOutcome(state, "white")?.context.join(" ")).toContain("not currently in check");
  });

  test("describes timeout losses from the viewer perspective", () => {
    const state = {
      ...createInitialState("classic", "timeout-outcome"),
      status: "completed" as const,
      result: "black" as const,
      outcomeReason: "timeout" as const,
      ply: 17
    };

    expect(describeGameOutcome(state, "white")).toMatchObject({
      winner: "black",
      result: "loss",
      reason: "timeout",
      headline: "You lost on time",
      celebrate: false
    });
    expect(describeGameOutcome(state, "white")?.context.join(" ")).toContain("clock reached zero");
  });

  test("describes bare-king draws with useful context", () => {
    const state = {
      ...createInitialState("classic", "bare-kings-outcome"),
      status: "completed" as const,
      result: "draw" as const,
      outcomeReason: "insufficient-material" as const,
      ply: 55
    };

    const outcome = describeGameOutcome(state, "white");

    expect(outcome).toMatchObject({
      winner: null,
      result: "draw",
      reason: "insufficient-material",
      headline: "Draw by insufficient material"
    });
    expect(outcome?.context.join(" ")).toContain("only the two kings");
  });

  test("explains a Shatranj stalemate as a win for the opponent", () => {
    const completed = shatranjStalemate();
    expect(completed).toMatchObject({ status: "completed", result: "white", outcomeReason: "no-legal-moves" });

    const outcome = describeGameOutcome(completed, "black");
    expect(outcome).toMatchObject({ result: "loss", winner: "white", headline: "You lost by no legal moves" });
    expect(outcome?.context[0]).toContain("Black is stalemated");
    expect(outcome?.context[0]).toContain("White wins");
    expect(outcome?.context[0]).not.toMatch(/draw|instead of standard stalemate/);
  });

  test.each(["white", "black"] as const)("stalemate context respects the recorded winner for the %s viewer", viewer => {
    const completed: GameState = { ...shatranjStalemate(), outcomeReason: "stalemate" };
    const outcome = describeGameOutcome(completed, viewer);
    expect(outcome).toMatchObject({ winner: "white", result: viewer === "white" ? "win" : "loss" });
    expect(outcome?.context[0]).toContain("White wins");
    expect(outcome?.context[0]).not.toContain("draw");
  });

  test("no-move context identifies the blocked Antichess side as the winner", () => {
    const before = position("antichess", "black", [[1, 0, "p", "white"], [0, 0, "n", "black"], [1, 7, "p", "black"]]);
    const completed = applyMove(before, { from: { row: 1, col: 7 }, to: { row: 2, col: 7 } });
    expect(completed).toMatchObject({ status: "completed", result: "white", outcomeReason: "no-legal-moves", turn: "white" });
    const outcome = describeGameOutcome(completed, "white");
    expect(outcome?.context[0]).toContain("White has no legal move");
    expect(outcome?.context[0]).toContain("White wins");
  });

  test("Three-check material context explains bare kings without declaring lone minors drawn", () => {
    const minor = position("three-check", "white", [[7, 4, "k", "white"], [3, 1, "b", "white"], [0, 4, "k", "black"], [2, 0, "n", "black"]]);
    const playable = applyMove(minor, { from: { row: 3, col: 1 }, to: { row: 2, col: 0 } });
    expect(playable.status).toBe("active");
    expect(describeGameOutcome(playable)).toBeNull();

    const bare = position("three-check", "black", [[7, 4, "k", "white"], [3, 1, "b", "white"], [2, 0, "k", "black"]]);
    const completed = applyMove(bare, { from: { row: 2, col: 0 }, to: { row: 3, col: 1 } });
    expect(completed).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
    const context = describeGameOutcome(completed)?.context[0];
    expect(context).toContain("only the two kings");
    expect(context).toContain("deliver a check");
    expect(context).not.toMatch(/bishop|knight/);
  });

  test("Three-check drawn timeout explains that the bare king cannot deliver a check", () => {
    const before = position("three-check", "black", [[7, 4, "k", "white"], [0, 4, "k", "black"], [0, 3, "q", "black"]]);
    before.clocks = before.clocks.map(clock => clock.color === "black" ? { ...clock, remainingMs: 500 } : clock);
    const completed = tickGameClock(before, 1000);
    expect(completed).toMatchObject({ status: "completed", result: "draw", outcomeReason: "timeout" });
    const outcome = describeGameOutcome(completed, "white");
    expect(outcome?.headline).toBe("Draw by time");
    expect(outcome?.context[0]).toContain("cannot deliver a check");
  });
});
