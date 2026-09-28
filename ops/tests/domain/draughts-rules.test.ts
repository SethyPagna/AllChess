import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState, type Move, type Piece } from "@/lib/variants";

type Variant = "english-draughts" | "international-draughts" | "turkish-draughts";

function empty(variant: Variant, turn: Piece["owner"] = "white") {
  const state = createInitialState(variant, `draughts-rules-${variant}`);
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  state.turn = turn;
  return state;
}
function put(state: GameState, row: number, col: number, code: "p" | "x", owner: Piece["owner"]) {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code, ...(code === "x" ? { promoted: true } : {}) };
}
const text = (move: Move) => `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
const legal = (state: GameState, row: number, col: number) => getLegalMoves(state, { row, col }).map(text).sort();
const allLegal = (state: GameState) => state.board.flat().filter(cell => cell.piece?.owner === state.turn).flatMap(cell => legal(state, cell.square.row, cell.square.col)).sort();
function play(state: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number) {
  return applyMove(state, { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
}
const continuation = (state: GameState) => state.variantState?.draughtsContinuation ?? null;

describe("flying draughts kings", () => {
  test("an international king never lands on an enemy it cannot jump", () => {
    const state = empty("international-draughts");
    put(state, 5, 4, "x", "white");
    put(state, 1, 0, "p", "black");
    put(state, 0, 9, "p", "black");

    expect(legal(state, 5, 4)).toEqual([
      "5,4-1,8", "5,4-2,1", "5,4-2,7", "5,4-3,2", "5,4-3,6", "5,4-4,3", "5,4-4,5",
      "5,4-6,3", "5,4-6,5", "5,4-7,2", "5,4-7,6", "5,4-8,1", "5,4-8,7", "5,4-9,0", "5,4-9,8"
    ]);
    expect(() => play(state, 5, 4, 1, 0)).toThrow("errors.invalidMove");
    expect(() => play(state, 5, 4, 0, 9)).toThrow("errors.invalidMove");

    const backed = empty("international-draughts");
    put(backed, 5, 4, "x", "white");
    put(backed, 3, 2, "p", "black");
    put(backed, 2, 1, "p", "black");
    expect(legal(backed, 5, 4)).toContain("5,4-4,3");
    expect(legal(backed, 5, 4)).not.toContain("5,4-3,2");
    expect(() => play(backed, 5, 4, 3, 2)).toThrow("errors.invalidMove");
  });

  test("a Turkish king never lands on an edge man or a backed man", () => {
    const state = empty("turkish-draughts");
    put(state, 4, 4, "x", "white");
    put(state, 4, 0, "p", "black");
    put(state, 2, 4, "p", "black");
    put(state, 1, 4, "p", "black");

    expect(legal(state, 4, 4)).toEqual(["4,4-3,4", "4,4-4,1", "4,4-4,2", "4,4-4,3", "4,4-4,5", "4,4-4,6", "4,4-4,7", "4,4-5,4", "4,4-6,4", "4,4-7,4"]);
    expect(() => play(state, 4, 4, 4, 0)).toThrow("errors.invalidMove");
    expect(() => play(state, 4, 4, 2, 4)).toThrow("errors.invalidMove");
    const quiet = play(state, 4, 4, 4, 1);
    expect(quiet.captured).toEqual([]);
    expect(quiet.turn).toBe("black");
    expect(continuation(quiet)).toBeNull();
  });

  test.each<Variant>(["english-draughts", "international-draughts", "turkish-draughts"])("%s self-play lands only on empty squares and never strands the side to move", variant => {
    let seed = variant.length * 7919;
    const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let state = createInitialState(variant, `draughts-sweep-${variant}`);
    const problems: string[] = [];
    for (let ply = 0; ply < 120 && state.status === "active"; ply++) {
      const moves = state.board.flat().flatMap(cell => cell.piece?.owner === state.turn ? getLegalMoves(state, cell.square) : []);
      if (!moves.length) problems.push(`ply ${ply}: no legal move in an active game`);
      for (const move of moves) if (state.board[move.to.row][move.to.col].piece) problems.push(`ply ${ply}: ${text(move)} lands on a piece`);
      const locked = continuation(state) as { row: number; col: number } | null;
      if (locked && moves.some(move => move.from.row !== locked.row || move.from.col !== locked.col)) problems.push(`ply ${ply}: another piece moves mid-capture`);
      if (!moves.length) break;
      state = applyMove(state, moves[Math.floor(random() * moves.length)]);
    }
    expect(problems).toEqual([]);
    expect(state.captured.length).toBeGreaterThan(0);
  }, 60_000);
});

describe("english draughts captures", () => {
  test("capturing is compulsory but the player may choose a shorter capture with another man", () => {
    const state = empty("english-draughts");
    put(state, 6, 1, "p", "white");
    put(state, 5, 2, "p", "black");
    put(state, 3, 4, "p", "black");
    put(state, 6, 5, "p", "white");
    put(state, 5, 6, "p", "black");
    put(state, 5, 0, "p", "white");

    expect(allLegal(state)).toEqual(["6,1-4,3", "6,5-4,7"]);
    const shorter = play(state, 6, 5, 4, 7);
    expect(shorter.captured).toHaveLength(1);
    expect(shorter.turn).toBe("black");
  });

  test("a king may choose the shorter branch of its own capture", () => {
    const state = empty("english-draughts");
    put(state, 4, 3, "x", "white");
    put(state, 3, 2, "p", "black");
    put(state, 5, 4, "p", "black");
    put(state, 5, 6, "p", "black");

    expect(legal(state, 4, 3)).toEqual(["4,3-2,1", "4,3-6,5"]);
    expect(play(state, 4, 3, 2, 1).turn).toBe("black");
  });

  test("a continuing jump may take the shorter branch, which then ends the turn", () => {
    const state = empty("english-draughts");
    put(state, 7, 2, "p", "white");
    put(state, 6, 3, "p", "black");
    put(state, 4, 3, "p", "black");
    put(state, 4, 5, "p", "black");
    put(state, 2, 5, "p", "black");

    const first = play(state, 7, 2, 5, 4);
    expect(first.turn).toBe("white");
    expect(legal(first, 5, 4)).toEqual(["5,4-3,2", "5,4-3,6"]);
    const done = play(first, 5, 4, 3, 2);
    expect(done.turn).toBe("black");
    expect(continuation(done)).toBeNull();
  });

  test("a man jumping into the king row is crowned and its move ends", () => {
    const state = empty("english-draughts");
    put(state, 2, 1, "p", "white");
    put(state, 1, 2, "p", "black");
    put(state, 1, 4, "p", "black");

    const crowned = play(state, 2, 1, 0, 3);
    expect(crowned.board[0][3].piece).toMatchObject({ code: "x", promoted: true });
    expect(crowned.turn).toBe("black");
    expect(continuation(crowned)).toBeNull();
  });
});

describe("international draughts captures", () => {
  test("a man passing the crowning row mid-capture stays a man and must continue", () => {
    const state = empty("international-draughts");
    put(state, 2, 5, "p", "white");
    put(state, 1, 4, "p", "black");
    put(state, 1, 2, "p", "black");
    put(state, 6, 3, "p", "white");
    put(state, 5, 4, "p", "black");
    put(state, 9, 0, "p", "black");

    expect(allLegal(state)).toEqual(["2,5-0,3"]);
    const passing = play(state, 2, 5, 0, 3);
    expect(passing.board[0][3].piece).toMatchObject({ code: "p" });
    expect(passing.board[0][3].piece?.promoted).toBeFalsy();
    expect(passing.turn).toBe("white");
    expect(allLegal(passing)).toEqual(["0,3-2,1"]);
    const done = play(passing, 0, 3, 2, 1);
    expect(done.board[2][1].piece).toMatchObject({ code: "p" });
    expect(done.captured).toHaveLength(2);
    expect(done.turn).toBe("black");
  });

  test("a man ending its capture on the crowning row is crowned and stops", () => {
    const state = empty("international-draughts");
    put(state, 2, 3, "p", "white");
    put(state, 1, 4, "p", "black");
    put(state, 3, 8, "p", "black");

    const crowned = play(state, 2, 3, 0, 5);
    expect(crowned.board[0][5].piece).toMatchObject({ code: "x", promoted: true });
    expect(crowned.turn).toBe("black");
    expect(continuation(crowned)).toBeNull();
  });

  test("a king capture touching either crowning row counts in full for the majority rule", () => {
    const white = empty("international-draughts");
    put(white, 2, 3, "x", "white");
    put(white, 1, 4, "p", "black");
    put(white, 2, 7, "p", "black");
    put(white, 4, 7, "p", "black");
    put(white, 8, 1, "p", "white");
    put(white, 7, 2, "p", "black");
    put(white, 5, 4, "p", "black");
    expect(allLegal(white)).toEqual(["2,3-0,5"]);

    const black = empty("international-draughts", "black");
    put(black, 7, 6, "x", "black");
    put(black, 8, 5, "p", "white");
    put(black, 7, 2, "p", "white");
    put(black, 5, 2, "p", "white");
    put(black, 1, 8, "p", "black");
    put(black, 2, 7, "p", "white");
    put(black, 4, 5, "p", "white");
    expect(allLegal(black)).toEqual(["7,6-9,4"]);
  });

  test("pieces taken earlier in the sequence block the king and cannot be jumped again", () => {
    const state = empty("international-draughts");
    put(state, 6, 3, "x", "white");
    put(state, 4, 5, "p", "black");
    put(state, 1, 6, "p", "black");
    put(state, 1, 4, "p", "black");
    put(state, 6, 7, "p", "black");
    put(state, 9, 0, "p", "black");

    expect(legal(state, 6, 3)).toEqual(["6,3-2,7"]);
    const first = play(state, 6, 3, 2, 7);
    expect(legal(first, 2, 7)).toEqual(["2,7-0,5"]);
    const second = play(first, 2, 7, 0, 5);
    expect(legal(second, 0, 5)).toEqual(["0,5-2,3", "0,5-3,2", "0,5-4,1", "0,5-5,0"]);
    const done = play(second, 0, 5, 2, 3);
    expect(done.turn).toBe("black");
    expect(done.captured).toHaveLength(3);
    expect(done.board[6][7].piece).toMatchObject({ owner: "black" });
    expect(continuation(done)).toBeNull();
  });

  test("a continuation saved without its capture trail still resumes", () => {
    const state = empty("international-draughts");
    put(state, 6, 3, "x", "white");
    put(state, 4, 5, "p", "black");
    put(state, 1, 6, "p", "black");
    put(state, 1, 4, "p", "black");
    put(state, 9, 0, "p", "black");
    const first = play(state, 6, 3, 2, 7);
    const legacy = structuredClone(first);
    legacy.variantState = { ...legacy.variantState, draughtsContinuation: { row: 2, col: 7, owner: "white" } };

    expect(legal(legacy, 2, 7)).toEqual(["2,7-0,5"]);
    expect(legal(legacy, 9, 0)).toEqual([]);
  });
});

describe("turkish draughts captures", () => {
  test("men never capture backwards", () => {
    const white = empty("turkish-draughts");
    put(white, 4, 3, "p", "white");
    put(white, 5, 3, "p", "black");
    put(white, 0, 7, "p", "black");
    expect(legal(white, 4, 3)).toEqual(["4,3-3,3", "4,3-4,2", "4,3-4,4"]);
    expect(() => play(white, 4, 3, 6, 3)).toThrow("errors.invalidMove");

    const black = empty("turkish-draughts", "black");
    put(black, 3, 3, "p", "black");
    put(black, 2, 3, "p", "white");
    put(black, 7, 0, "p", "white");
    expect(legal(black, 3, 3)).toEqual(["3,3-3,2", "3,3-3,4", "3,3-4,3"]);
  });

  test("a capturing man cannot continue backwards", () => {
    const state = empty("turkish-draughts");
    put(state, 5, 3, "p", "white");
    put(state, 5, 4, "p", "black");
    put(state, 6, 5, "p", "black");
    put(state, 0, 7, "p", "black");

    const done = play(state, 5, 3, 5, 5);
    expect(done.turn).toBe("black");
    expect(continuation(done)).toBeNull();
    expect(done.board[6][5].piece).toMatchObject({ owner: "black" });
  });

  test("a king may not turn 180 degrees between two captures", () => {
    const state = empty("turkish-draughts");
    put(state, 4, 3, "x", "white");
    put(state, 4, 4, "p", "black");
    put(state, 4, 1, "p", "black");
    put(state, 0, 6, "p", "black");

    expect(legal(state, 4, 3)).toEqual(["4,3-4,0", "4,3-4,5", "4,3-4,6", "4,3-4,7"]);
    const done = play(state, 4, 3, 4, 0);
    expect(done.turn).toBe("black");
    expect(continuation(done)).toBeNull();
  });

  test("a king may turn 90 degrees and cross the square of a piece it already removed", () => {
    const state = empty("turkish-draughts");
    put(state, 7, 2, "x", "white");
    put(state, 5, 2, "p", "black");
    put(state, 3, 4, "p", "black");
    put(state, 4, 5, "p", "black");
    put(state, 5, 1, "p", "black");
    put(state, 0, 7, "p", "black");

    expect(allLegal(state)).toEqual(["7,2-3,2"]);
    let sequence = play(state, 7, 2, 3, 2);
    expect(legal(sequence, 3, 2)).toEqual(["3,2-3,5"]);
    sequence = play(sequence, 3, 2, 3, 5);
    expect(legal(sequence, 3, 5)).toEqual(["3,5-5,5"]);
    sequence = play(sequence, 3, 5, 5, 5);
    expect(legal(sequence, 5, 5)).toEqual(["5,5-5,0"]);
    sequence = play(sequence, 5, 5, 5, 0);
    expect(sequence.captured).toHaveLength(4);
    expect(sequence.turn).toBe("black");
  });

  test("a man reaching the back rank mid-capture continues as a man and is crowned where it ends", () => {
    const state = empty("turkish-draughts");
    put(state, 2, 3, "p", "white");
    put(state, 1, 3, "p", "black");
    put(state, 0, 4, "p", "black");
    put(state, 7, 7, "p", "black");

    expect(allLegal(state)).toEqual(["2,3-0,3"]);
    const passing = play(state, 2, 3, 0, 3);
    expect(passing.board[0][3].piece).toMatchObject({ code: "p" });
    expect(passing.turn).toBe("white");
    expect(legal(passing, 0, 3)).toEqual(["0,3-0,5"]);
    const done = play(passing, 0, 3, 0, 5);
    expect(done.board[0][5].piece).toMatchObject({ code: "x", promoted: true });
    expect(done.turn).toBe("black");
  });

  test("a king capture touching the crowning row counts in full for the majority rule", () => {
    const state = empty("turkish-draughts");
    put(state, 3, 3, "x", "white");
    put(state, 2, 3, "p", "black");
    put(state, 0, 5, "p", "black");
    put(state, 2, 6, "p", "black");
    put(state, 7, 0, "p", "white");
    put(state, 6, 0, "p", "black");
    put(state, 4, 0, "p", "black");

    expect(allLegal(state)).toEqual(["3,3-0,3"]);
  });
});
