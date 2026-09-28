import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, type GameState, type PlayerColor } from "@/lib/variants";

type Placement = [row: number, col: number, code: string, owner: PlayerColor];

const PASS = { kind: "pass" as const, from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };

function position(variantKey: string, turn: PlayerColor, placements: Placement[], extra: Partial<GameState> = {}): GameState {
  const state = createInitialState(variantKey, `game-ends-${variantKey}`);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  for (const [row, col, code, owner] of placements) {
    state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: "chess.pawn" };
  }
  return { ...state, turn, ...extra };
}

function play(state: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number) {
  return applyMove(state, { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
}

function outcome(state: GameState) {
  return { status: state.status, result: state.result, outcomeReason: state.outcomeReason };
}

describe("shatranj endings", () => {
  test("stalemating the opponent wins", () => {
    // Black Ka8 with a blocked pawn; White Kb6, Fd8, Rh1, Pg2. Fd8-c7 leaves Black no move and no check.
    const before = position("shatranj", "white", [[0, 0, "k", "black"], [5, 6, "p", "black"], [2, 1, "k", "white"], [0, 3, "f", "white"], [7, 7, "r", "white"], [6, 6, "p", "white"]]);

    expect(outcome(play(before, 0, 3, 1, 2))).toEqual({ status: "completed", result: "white", outcomeReason: "no-legal-moves" });
  });

  test("a bared king may bare the mover back for a draw", () => {
    // White Ke1 Rd3, Black Ke8 Rd7: Rxd7 bares Black, but Kxd7 bares White on the reply.
    const before = position("shatranj", "white", [[7, 4, "k", "white"], [5, 3, "r", "white"], [0, 4, "k", "black"], [1, 3, "r", "black"]]);
    const bared = play(before, 5, 3, 1, 3);

    expect(outcome(bared)).toEqual({ status: "active", result: undefined, outcomeReason: undefined });
    expect(getLegalMoves(bared, { row: 0, col: 4 })).toContainEqual({ from: { row: 0, col: 4 }, to: { row: 1, col: 3 } });
    expect(outcome(play(bared, 0, 4, 1, 3))).toEqual({ status: "completed", result: "draw", outcomeReason: "objective" });
    expect(outcome(play(bared, 0, 4, 0, 5))).toEqual({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("baring wins at once when the bared king cannot bare back", () => {
    const guarded = position("shatranj", "white", [[2, 4, "k", "white"], [5, 3, "r", "white"], [0, 4, "k", "black"], [1, 3, "r", "black"]]);
    expect(outcome(play(guarded, 5, 3, 1, 3))).toEqual({ status: "completed", result: "white", outcomeReason: "objective" });

    const twoPieces = position("shatranj", "white", [[7, 4, "k", "white"], [5, 3, "r", "white"], [7, 0, "n", "white"], [0, 4, "k", "black"], [1, 3, "r", "black"]]);
    expect(outcome(play(twoPieces, 5, 3, 1, 3))).toEqual({ status: "completed", result: "white", outcomeReason: "objective" });

    // Nxh8 bares Black and also leaves the lone king without a move: the bare-king win applies.
    const stalemated = position("shatranj", "white", [[0, 0, "k", "black"], [0, 7, "a", "black"], [2, 1, "k", "white"], [1, 2, "f", "white"], [2, 6, "n", "white"]]);
    expect(outcome(play(stalemated, 2, 6, 0, 7))).toEqual({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("chaturanga keeps the immediate bare-king win", () => {
    const before = position("chaturanga", "white", [[7, 4, "k", "white"], [5, 3, "r", "white"], [0, 4, "k", "black"], [1, 3, "r", "black"]]);
    expect(outcome(play(before, 5, 3, 1, 3))).toEqual({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("both shahs and both fers start on shared files", () => {
    const state = createInitialState("shatranj", "shatranj-setup");
    const codes = (row: number) => state.board[row].map((cell) => cell.piece?.code ?? ".").join("");

    expect(codes(0)).toBe("rnafkanr");
    expect(codes(7)).toBe("rnafkanr");
    expect(state.board[0][4].piece).toMatchObject({ code: "k", owner: "black" });
    expect(state.board[7][4].piece).toMatchObject({ code: "k", owner: "white" });
  });
});

describe("janggi has no stalemate", () => {
  test("a side with no board move but a legal pass must pass", () => {
    // Red G(9,5) with rooks on (1,8), (6,0) and (5,0) against a lone Blue general on (0,3).
    const before = position("janggi", "red", [[9, 5, "g", "red"], [1, 8, "r", "red"], [6, 0, "r", "red"], [5, 0, "r", "red"], [0, 3, "g", "blue"]]);
    const boxedIn = play(before, 6, 0, 6, 4);

    expect(outcome(boxedIn)).toEqual({ status: "active", result: undefined, outcomeReason: undefined });
    expect(boxedIn.turn).toBe("blue");
    expect(getLegalMoves(boxedIn, { row: 0, col: 3 })).toEqual([]);

    const passed = applyMove(boxedIn, PASS);
    expect(passed.turn).toBe("red");
    expect(outcome(play(passed, 5, 0, 5, 3))).toEqual({ status: "completed", result: "red", outcomeReason: "checkmate" });
    expect(outcome(applyMove(passed, PASS))).toEqual({ status: "completed", result: "red", outcomeReason: "scoring" });
  });
});

describe("konane opening end", () => {
  test("the side left without a jump after the second removal loses", () => {
    const before = position("konane", "white", [[3, 3, "p", "black"], [3, 4, "p", "white"], [3, 5, "p", "black"], [6, 6, "p", "white"]], {
      variantState: { konaneProfile: "nps-v1", konaneOpening: { removals: 1, firstRemoved: { row: 0, col: 0 } } }
    });
    const after = applyMove(before, { kind: "remove", from: { row: 6, col: 6 }, to: { row: 6, col: 6 } });

    expect(after.variantState?.konaneOpening).toMatchObject({ removals: 2 });
    expect(outcome(after)).toEqual({ status: "completed", result: "white", outcomeReason: "no-legal-moves" });
  });

  test("a normal opening stays active after both removals", () => {
    const black = applyMove(createInitialState("konane", "konane-open"), { kind: "remove", from: { row: 0, col: 0 }, to: { row: 0, col: 0 } });
    expect(black.status).toBe("active");
    const white = applyMove(black, { kind: "remove", from: { row: 7, col: 0 }, to: { row: 7, col: 0 } });
    expect(white.status).toBe("active");
    expect(white.turn).toBe("black");
  });
});

describe.each(["shogi", "mini-shogi"])("%s stalemate", (variantKey) => {
  test.each(["sente", "gote"] as const)("%s wins when the opponent has no legal board move or drop", (mover) => {
    const lastRow = createInitialState(variantKey).board.length - 1;
    const defender = mover === "sente" ? "gote" : "sente";
    const row = (value: number) => mover === "sente" ? value : lastRow - value;
    const before = position(variantKey, mover, [[row(0), 0, "k", defender], [row(2), 1, "k", mover], [row(2), 3, "b", mover]]);
    const after = applyMove(before, { from: { row: row(2), col: 3 }, to: { row: row(1), col: 2 }, promotion: false });

    expect(after.checks[defender] ?? 0).toBe(0);
    expect(getLegalMoves({ ...after, status: "active" }, { row: row(0), col: 0 })).toEqual([]);
    expect(outcome(after)).toEqual({ status: "completed", result: mover, outcomeReason: "no-legal-moves" });
  });

  test("a legal drop keeps a side with no board moves in play", () => {
    const before = position(variantKey, "sente", [[0, 0, "k", "gote"], [2, 1, "k", "sente"], [2, 3, "b", "sente"]], { hands: { sente: {}, gote: { p: 1 } } });
    const after = applyMove(before, { from: { row: 2, col: 3 }, to: { row: 1, col: 2 }, promotion: false });

    expect(getLegalMoves(after, { row: 0, col: 0 })).toEqual([]);
    expect(after.status).toBe("active");
    expect(applyMove(after, { kind: "drop", from: { row: -1, col: -1 }, to: { row: 3, col: 4 }, drop: { id: "gote-hand-p", owner: "gote", code: "p", labelKey: "chess.pawn" } }).status).toBe("active");
  });
});
