import { describe, expect, test } from "vitest";

import { describeGameOutcome } from "@/lib/game-outcome";
import { applyMove, createInitialState } from "@/lib/variants";

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
  });
});
