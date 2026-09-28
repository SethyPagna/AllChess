import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, type GameState, type Move, type PlayerColor } from "@/lib/variants";
import { encodeLocalMatch, decodeLocalMatch, type LocalMatchSettings } from "@/lib/game/local-match";
import { exportLocalMatch, importLocalMatch } from "@/lib/game/local-match-transfer";
import { describeGameOutcome } from "@/lib/game/outcome";
import { botDifficultyLevels } from "@/lib/bot/config";

const step = (fromRow: number, fromCol: number, toRow: number, toCol: number): Move => ({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
const pass: Move = { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };
const repeat = (moves: Move[], times: number) => Array.from({ length: times }, () => moves).flat();

/** applyMove rejects illegal requests, so every listed move is checked. Stops at the end of the game. */
function play(state: GameState, moves: Move[]) {
  for (const move of moves) {
    if (state.status !== "active") break;
    state = applyMove(state, move);
  }
  return state;
}

function emptyBoard(variant: string, turn: PlayerColor, id = `${variant}-repetition`) {
  const state = createInitialState(variant, id);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  state.turn = turn;
  return state;
}

function put(state: GameState, row: number, col: number, code: string, owner: PlayerColor) {
  state.board[row][col].piece = { id: `${owner}-${code}-${row}-${col}`, code, owner, labelKey: `chess.${code}` };
}

function settings(humanColor: PlayerColor): LocalMatchSettings {
  return { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "freestyle", humanColor, seatChoice: "first", boardOrientation: "auto" };
}

/** Red chariot checks the black general from (3,4) and (3,5) while the general steps between (0,4) and (0,5). */
function xiangqiChariotChecks(start: "rook-ready" | "general-escaped") {
  const state = emptyBoard("xiangqi", "red");
  put(state, 9, 3, "g", "red");
  put(state, 0, 4, "g", "black");
  put(state, start === "rook-ready" ? 5 : 3, start === "rook-ready" ? 4 : 5, "r", "red");
  return state;
}
const chariotCycle = [step(3, 5, 3, 4), step(0, 4, 0, 5), step(3, 4, 3, 5), step(0, 5, 0, 4)];

describe("xiangqi repetition", () => {
  test("the side that checks with every move loses when a checking move completes the third occurrence", () => {
    let state = play(xiangqiChariotChecks("rook-ready"), [step(5, 4, 3, 4), ...chariotCycle.slice(1), ...chariotCycle]);
    expect(state).toMatchObject({ ply: 8, status: "active" });
    state = play(state, chariotCycle.slice(0, 1));
    expect(state).toMatchObject({ ply: 9, status: "completed", result: "black", outcomeReason: "perpetual-check" });
    expect(describeGameOutcome(state)?.context[0]).toContain("checking side loses");
  });

  test("the checker also loses when the escaping move completes the third occurrence", () => {
    const state = play(xiangqiChariotChecks("general-escaped"), repeat(chariotCycle, 3));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "black", outcomeReason: "perpetual-check" });
    expect(state.moves.at(-1)).toMatchObject({ from: { row: 0, col: 5 } });
  });

  test("checking only every other move is a plain repetition draw", () => {
    const state = emptyBoard("xiangqi", "red");
    put(state, 9, 3, "g", "red"); put(state, 0, 4, "g", "black"); put(state, 5, 3, "r", "red");
    const ended = play(state, repeat([step(5, 3, 5, 4), step(0, 4, 0, 5), step(5, 4, 5, 3), step(0, 5, 0, 4)], 3));
    expect(ended.checks.black).toBe(2);
    expect(ended).toMatchObject({ ply: 8, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("a quiet shuffle from the start draws on the third occurrence, counting the start position", () => {
    const horses = [step(9, 1, 7, 2), step(0, 1, 2, 2), step(7, 2, 9, 1), step(2, 2, 0, 1)];
    let state = play(createInitialState("xiangqi", "xiangqi-shuffle"), [...horses, ...horses.slice(0, 3)]);
    expect(state).toMatchObject({ ply: 7, status: "active" });
    state = play(state, horses.slice(3));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "draw", outcomeReason: "repetition" });
    expect(describeGameOutcome(state)?.context[0]).toBe("The same position occurred three times with the same side to move.");
  });

  test("a capture clears the recorded positions", () => {
    const state = emptyBoard("xiangqi", "red");
    put(state, 9, 5, "g", "red"); put(state, 0, 4, "g", "black"); put(state, 5, 0, "r", "red"); put(state, 5, 8, "p", "black");
    const shuffled = play(state, [step(5, 0, 6, 0), step(0, 4, 0, 3), step(6, 0, 5, 0), step(0, 3, 0, 4)]);
    expect(String(shuffled.variantState?.repetitionHistory).split(" ")).toHaveLength(5);
    const captured = play(shuffled, [step(5, 0, 5, 8)]);
    expect(String(captured.variantState?.repetitionHistory).split(" ")).toHaveLength(1);
  });

  test("saved games keep the recorded positions through export and import", () => {
    const state = play(xiangqiChariotChecks("rook-ready"), [step(5, 4, 3, 4), ...chariotCycle.slice(1), ...chariotCycle]);
    const imported = importLocalMatch(exportLocalMatch({ state, history: [], future: [], settings: settings("red") }).contents);
    expect(imported.state.variantState?.repetitionHistory).toEqual(state.variantState?.repetitionHistory);
    expect(play(imported.state, chariotCycle.slice(0, 1))).toMatchObject({ status: "completed", result: "black", outcomeReason: "perpetual-check" });
  });

  test("games saved before positions were recorded start counting from the loaded position", () => {
    const state = play(xiangqiChariotChecks("rook-ready"), [step(5, 4, 3, 4), ...chariotCycle.slice(1)]);
    const legacy = { ...state, variantState: {} };
    expect(play(legacy, [...chariotCycle, ...chariotCycle.slice(0, 3)])).toMatchObject({ ply: 11, status: "active" });
    expect(play(legacy, repeat(chariotCycle, 2))).toMatchObject({ ply: 12, status: "completed", result: "black", outcomeReason: "perpetual-check" });
  });
});

describe("janggi repetition", () => {
  const chariots = [step(0, 0, 1, 0), step(9, 0, 8, 0), step(1, 0, 0, 0), step(8, 0, 9, 0)];

  test("a repetition without perpetual check is decided by material points, with Han's 1.5 compensation", () => {
    let state = play(createInitialState("janggi", "janggi-shuffle"), [...chariots, ...chariots.slice(0, 3)]);
    expect(state).toMatchObject({ ply: 7, status: "active" });
    state = play(state, chariots.slice(3));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "red", outcomeReason: "repetition" });
    expect(state.variantState?.janggiScoring).toMatchObject({ redPoints: 73.5, bluePoints: 72 });
    expect(describeGameOutcome(state)?.context[0]).toContain("material points");
  });

  test("passes count as moves of the repeated cycle", () => {
    const state = play(createInitialState("janggi", "janggi-pass-shuffle"), repeat([pass, step(9, 0, 8, 0), pass, step(8, 0, 9, 0)], 2));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "red", outcomeReason: "repetition" });
  });

  test("consecutive passes still go straight to scoring", () => {
    const state = play(createInitialState("janggi", "janggi-double-pass"), [...chariots, pass, pass]);
    expect(state).toMatchObject({ ply: 6, status: "completed", result: "red", outcomeReason: "scoring" });
  });

  test("the side that checks with every move loses", () => {
    const state = emptyBoard("janggi", "red");
    put(state, 9, 3, "g", "red"); put(state, 0, 4, "g", "blue"); put(state, 5, 4, "r", "red");
    let ended = play(state, [step(5, 4, 3, 4), ...chariotCycle.slice(1), ...chariotCycle]);
    expect(ended).toMatchObject({ ply: 8, status: "active" });
    ended = play(ended, chariotCycle.slice(0, 1));
    expect(ended).toMatchObject({ ply: 9, status: "completed", result: "blue", outcomeReason: "perpetual-check" });
  });
});

describe("repetition history storage", () => {
  /**
   * Crazyhouse keeps every position of the game. Rooks cycle through 6 and 7 files, so no position
   * occurs three times, and a pawn drop every 92 plies resets the fifty-move count.
   */
  function longCrazyhouseTimeline(plies: number) {
    let state = emptyBoard("crazyhouse", "white", "crazyhouse-long");
    put(state, 7, 0, "k", "white"); put(state, 0, 7, "k", "black"); put(state, 6, 1, "r", "white"); put(state, 1, 1, "r", "black");
    state.hands = { white: { p: 12 }, black: { p: 12 } };
    const frames: GameState[] = [];
    const moves: GameState["moves"] = [];
    const advance = (move: Move) => {
      if (state.ply >= plies) return;
      frames.push(state);
      state = applyMove(state, move);
      moves.push(state.moves.at(-1)!);
      // applyMove copies the whole move list; saves keep only the final one, and en passant reads the last move.
      state.moves = state.moves.slice(-1);
    };
    const pawn = (owner: PlayerColor, row: number, col: number): Move => ({ kind: "drop", from: { row: -1, col: -1 }, to: { row, col }, drop: { id: `${owner}-hand-p`, code: "p", owner, labelKey: "chess.pawn" } });
    for (let rookMoves = 0; state.ply < plies; rookMoves += 1) {
      advance(step(6, 1 + (rookMoves % 6), 6, 1 + ((rookMoves + 1) % 6)));
      advance(step(1, 1 + (rookMoves % 7), 1, 1 + ((rookMoves + 1) % 7)));
      if ((rookMoves + 1) % 45 > 0) continue;
      const drops = (rookMoves + 1) / 45 - 1;
      advance(pawn("white", 5 - Math.floor(drops / 8), drops % 8));
      advance(pawn("black", 2 + Math.floor(drops / 8), drops % 8));
    }
    return { state: { ...state, moves }, frames };
  }

  test("a 1000-ply drop game saves well under the 4 MB cap", () => {
    const { state, frames } = longCrazyhouseTimeline(1000);
    expect(state).toMatchObject({ ply: 1000, status: "active" });
    const payload = encodeLocalMatch({ state, history: frames, future: [], settings: settings("white") });
    expect(payload.length).toBeLessThan(1024 * 1024);
    const decoded = decodeLocalMatch({ version: 1, id: state.id, variantKey: state.variantKey, payload, revision: 0, updatedAt: 0, ply: state.ply, completed: false, mode: "offline" });
    expect(decoded?.state.variantState).toEqual(state.variantState);
  }, 60_000);

  test("a position list saved as one string is still read and extended", () => {
    const knights = [step(7, 6, 5, 5), step(0, 6, 2, 5), step(5, 5, 7, 6), step(2, 5, 0, 6)];
    const state = play(createInitialState("classic", "legacy-history"), [...knights, ...knights.slice(0, 3)]);
    const history = state.variantState?.westernRepetition as string[];
    const legacy = { ...state, variantState: { ...state.variantState, westernRepetition: history.join(" ") } };
    const imported = importLocalMatch(exportLocalMatch({ state: legacy, history: [], future: [], settings: settings("white") }).contents);
    expect(play(imported.state, knights.slice(3))).toMatchObject({ ply: 8, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("long position lists are split into shared blocks that survive export and import", () => {
    const { state } = longCrazyhouseTimeline(80);
    const history = state.variantState?.westernRepetition as string[];
    expect(history.map((block) => block.split(" ").length)).toEqual([32, 32, 17]);
    const imported = importLocalMatch(exportLocalMatch({ state, history: [], future: [], settings: settings("white") }).contents);
    expect(imported.state.variantState?.westernRepetition).toEqual(history);
  });
});
