import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, type GameState, type Piece, type PlayerColor, type Square } from "@/lib/variants";

const incrementMs = 20_000;
const baseMs = 1_800_000;

function timed(state: GameState) {
  state.clocks = state.clocks.map(clock => ({ ...clock, remainingMs: baseMs, incrementMs }));
  return state;
}
function empty(variantKey: string, turn: PlayerColor) {
  const state = timed(createInitialState(variantKey, `increment-${variantKey}`));
  state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  state.turn = turn;
  return state;
}
function put(state: GameState, [row, col]: [number, number], owner: Piece["owner"], code = "p") {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: code };
}
const clockOf = (state: GameState, color: PlayerColor) => state.clocks.find(clock => clock.color === color)!.remainingMs;
const square = ([row, col]: [number, number]): Square => ({ row, col });

/** Plays each hop of one capture sequence and returns the state after every hop. */
function playSequence(state: GameState, path: Array<[number, number]>) {
  const states: GameState[] = [];
  for (let hop = 1; hop < path.length; hop++) {
    state = applyMove(state, { from: square(path[hop - 1]), to: square(path[hop]) });
    states.push(state);
  }
  return states;
}

describe("Fischer increment for capture sequences", () => {
  const draughts: Array<[string, Array<[number, number]>, Array<[number, number]>, [number, number]]> = [
    ["english-draughts", [[7, 2], [5, 4], [3, 6]], [[6, 3], [4, 5]], [0, 1]],
    ["international-draughts", [[9, 2], [7, 4], [5, 6]], [[8, 3], [6, 5]], [0, 1]],
    ["turkish-draughts", [[6, 0], [4, 0], [2, 0]], [[5, 0], [3, 0]], [0, 7]]
  ];

  test.each(draughts)("%s: a multi-capture earns one increment, credited when the turn passes", (variantKey, path, victims, spare) => {
    const state = empty(variantKey, "white");
    put(state, path[0], "white");
    for (const victim of victims) put(state, victim, "black");
    put(state, spare, "black");

    const [firstHop, lastHop] = playSequence(state, path);
    expect(firstHop.turn).toBe("white");
    expect(firstHop.variantState?.draughtsContinuation).not.toBeNull();
    expect(clockOf(firstHop, "white")).toBe(baseMs);
    expect(lastHop.turn).toBe("black");
    expect(lastHop.captured).toHaveLength(2);
    expect(clockOf(lastHop, "white")).toBe(baseMs + incrementMs);
    expect(clockOf(lastHop, "black")).toBe(baseMs);
  });

  test("a draughts capture that wins the game still earns its one increment", () => {
    const state = empty("english-draughts", "white");
    put(state, [7, 2], "white");
    put(state, [6, 3], "black");
    put(state, [4, 5], "black");

    const [firstHop, lastHop] = playSequence(state, [[7, 2], [5, 4], [3, 6]]);
    expect(clockOf(firstHop, "white")).toBe(baseMs);
    expect(lastHop).toMatchObject({ status: "completed", result: "white" });
    expect(clockOf(lastHop, "white")).toBe(baseMs + incrementMs);
  });

  test("a legacy Konane jump chain earns one increment", () => {
    const state = empty("konane", "black");
    delete state.variantState!.konaneProfile;
    state.variantState = { ...state.variantState, konaneOpening: { removals: 2 } };
    state.ply = 2;
    put(state, [4, 0], "black");
    put(state, [4, 1], "white");
    put(state, [4, 3], "white");
    put(state, [0, 5], "white");
    put(state, [0, 6], "black");

    const [firstHop, lastHop] = playSequence(state, [[4, 0], [4, 2], [4, 4]]);
    expect(firstHop.turn).toBe("black");
    expect(firstHop.variantState?.konaneContinuation).not.toBeNull();
    expect(clockOf(firstHop, "black")).toBe(baseMs);
    expect(lastHop.turn).toBe("white");
    expect(clockOf(lastHop, "black")).toBe(baseMs + incrementMs);
  });

  test("ordinary moves still earn one increment each", () => {
    const chess = timed(createInitialState("classic", "increment-classic"));
    const white = applyMove(chess, { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });
    expect(clockOf(white, "white")).toBe(baseMs + incrementMs);
    const black = applyMove(white, { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } });
    expect(clockOf(black, "black")).toBe(baseMs + incrementMs);
    expect(clockOf(black, "white")).toBe(baseMs + incrementMs);

    const single = empty("english-draughts", "white");
    put(single, [6, 1], "white");
    put(single, [5, 2], "black");
    put(single, [0, 7], "black");
    const [capture] = playSequence(single, [[6, 1], [4, 3]]);
    expect(capture.turn).toBe("black");
    expect(clockOf(capture, "white")).toBe(baseMs + incrementMs);
  });
});
