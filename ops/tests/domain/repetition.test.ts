import { describe, expect, test } from "vitest";

import { applyMove, createInitialState, getLegalMoves, type GameState, type Move, type PlayerColor } from "@/lib/variants";
import { withChess960BackRank } from "@/lib/variants/chess960";
import { exportLocalMatch, importLocalMatch } from "@/lib/game/local-match-transfer";
import { describeGameOutcome } from "@/lib/game/outcome";
import { botDifficultyLevels } from "@/lib/bot/config";
import { createBotSearchStateKey } from "@/lib/bot/runtime";

/** Algebraic square ("e2") on an 8x8 board, white at the bottom. */
const at = (name: string) => ({ row: 8 - Number(name[1]), col: name.charCodeAt(0) - 97 });
const mv = (from: string, to: string): Move => ({ from: at(from), to: at(to) });
const line = (text: string) => text.split(" ").map((step) => mv(step.slice(0, 2), step.slice(2)));

/** Plays each move after checking it is legal; stops at the end of the game. */
function play(state: GameState, moves: Move[]) {
  for (const move of moves) {
    if (state.status !== "active") break;
    if (move.kind !== "drop" && !getLegalMoves(state, move.from).some((legal) => legal.to.row === move.to.row && legal.to.col === move.to.col)) {
      throw new Error(`illegal ${JSON.stringify(move)} at ply ${state.ply}`);
    }
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

const knightShuffle = line("g1f3 g8f6 f3g1 f6g8");

describe("western threefold repetition", () => {
  test.each(["classic", "chess960", "crazyhouse", "chaturanga", "shatranj", "antichess", "king-of-the-hill", "three-check"])("%s draws on the third occurrence, counting the start position", (variant) => {
    let state = createInitialState(variant, `${variant}-threefold`);
    if (variant === "chess960") state = withChess960BackRank(state, "rnbqkbnr");
    state = play(state, knightShuffle);
    expect(state.status).toBe("active");
    state = play(state, knightShuffle.slice(0, 3));
    expect(state.status).toBe("active");
    state = play(state, knightShuffle.slice(3));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "draw", outcomeReason: "repetition" });
    expect(describeGameOutcome(state)?.context[0]).toContain("three times");
  });

  test("racing kings draws on the third occurrence too", () => {
    const shuffle = line("e1f3 d1c3 f3e1 c3d1");
    let state = play(createInitialState("racing-kings", "racing-threefold"), [...shuffle, ...shuffle.slice(0, 3)]);
    expect(state).toMatchObject({ ply: 7, status: "active" });
    state = play(state, shuffle.slice(3));
    expect(state).toMatchObject({ ply: 8, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("lost castling rights make an identical board a new position", () => {
    const kings = line("e1e2 e8e7 e2e1 e7e8");
    let state = play(createInitialState("classic", "castling-repetition"), line("e2e4 e7e5"));
    state = play(state, [...kings, ...kings]);
    expect(state).toMatchObject({ ply: 10, status: "active" });
    state = play(state, kings);
    expect(state).toMatchObject({ ply: 12, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("a legal en passant capture makes the position different", () => {
    let state = play(createInitialState("classic", "en-passant-repetition"), line("e2e4 b8c6 e4e5 d7d5"));
    const shuffle = line("g1f3 c6b8 f3g1 b8c6");
    state = play(state, [...shuffle, ...shuffle]);
    expect(state).toMatchObject({ ply: 12, status: "active" });
    state = play(state, shuffle);
    expect(state).toMatchObject({ ply: 13, status: "completed", outcomeReason: "repetition" });
  });

  test("an en passant capture that would expose the king does not make the position different", () => {
    let state = emptyBoard("classic", "black");
    put(state, 3, 0, "k", "white"); put(state, 3, 1, "p", "white"); put(state, 7, 6, "n", "white");
    put(state, 3, 7, "r", "black"); put(state, 1, 2, "p", "black"); put(state, 0, 7, "k", "black"); put(state, 0, 6, "n", "black");
    state = play(state, [mv("c7", "c5")]);
    expect(getLegalMoves(state, at("b5")).some((move) => move.to.col === 2)).toBe(false);
    const shuffle = line("g1f3 g8f6 f3g1 f6g8");
    state = play(state, shuffle);
    expect(state.status).toBe("active");
    state = play(state, shuffle);
    expect(state).toMatchObject({ ply: 9, status: "completed", outcomeReason: "repetition" });
  });

  test("three-check counts delivered checks as part of the position", () => {
    let state = emptyBoard("three-check", "white");
    put(state, 7, 0, "k", "white"); put(state, 4, 0, "r", "white"); put(state, 0, 7, "k", "black");
    state = play(state, line("a4a8 h8h7 a8a4 h7h8 a4a8 h8h7 a8a4 h7h8"));
    expect(state).toMatchObject({ ply: 8, status: "active" });
    state = play(state, [mv("a4", "a8")]);
    expect(state).toMatchObject({ status: "completed", result: "white", outcomeReason: "three-check" });
  });

  test("crazyhouse pockets distinguish positions and survive captures", () => {
    let state = emptyBoard("crazyhouse", "white");
    put(state, 7, 0, "k", "white"); put(state, 0, 7, "k", "black"); put(state, 3, 1, "n", "black");
    state.hands = { white: { n: 1 }, black: {} };
    const shuffle = line("a1b1 h8g8 b1a1 g8h8");
    state = play(state, shuffle);
    const knight = { id: "white-hand-n", code: "n", owner: "white" as const, labelKey: "chess.knight" };
    state = play(state, [{ kind: "drop", from: { row: -1, col: -1 }, to: at("c3"), drop: knight }]);
    state = play(state, line("b5c3 a1b2 c3b5 b2a1 h8g8 a1b1 g8g7 b1a1 g7h8"));
    expect(state).toMatchObject({ ply: 14, status: "active", hands: { white: {}, black: { n: 1 } } });
    state = play(state, [...shuffle, ...shuffle]);
    expect(state).toMatchObject({ ply: 22, status: "completed", outcomeReason: "repetition" });
  });

  test("a promoted queen and an original queen are the same piece", () => {
    let state = emptyBoard("classic", "white");
    put(state, 7, 0, "k", "white"); put(state, 7, 1, "q", "white"); put(state, 7, 2, "q", "white"); put(state, 0, 7, "k", "black");
    state.board[7][2].piece!.promoted = true;
    const swapQueens = line("b1c2 h8g8 c1b1 g8g7 c2c1 g7h8");
    state = play(state, [...swapQueens, ...swapQueens.slice(0, 5)]);
    expect(state).toMatchObject({ ply: 11, status: "active" });
    state = play(state, swapQueens.slice(5));
    expect(state).toMatchObject({ ply: 12, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("a pawn move or capture clears the recorded positions", () => {
    let state = play(createInitialState("classic", "irreversible-repetition"), knightShuffle);
    expect(String(state.variantState?.westernRepetition).split(" ")).toHaveLength(5);
    state = play(state, line("e2e4"));
    expect(String(state.variantState?.westernRepetition).split(" ")).toHaveLength(1);
  });

  test("the bot search key tells apart positions reached through different histories", () => {
    const developed = play(createInitialState("classic", "bot-key"), line("g1f3 g8f6"));
    const viaCenter = play(developed, line("f3d4 f6d5 d4f3 d5f6"));
    const viaRim = play(developed, line("f3h4 f6d5 h4f3 d5f6"));
    expect(viaRim.board).toEqual(viaCenter.board);
    expect(createBotSearchStateKey(viaRim)).not.toBe(createBotSearchStateKey(viaCenter));
  });
});

type Placement = [row: number, col: number, code: string, owner: "sente" | "gote"];

function shogiPosition(variant: "shogi" | "mini-shogi", turn: "sente" | "gote", pieces: Placement[]) {
  const state = createInitialState(variant, `${variant}-sennichite`);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  state.hands = { sente: {}, gote: {} };
  state.turn = turn;
  for (const [row, col, code, owner] of pieces) put(state, row, col, code, owner);
  return state;
}

const step = (fromRow: number, fromCol: number, toRow: number, toCol: number): Move => ({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
const repeat = (moves: Move[], times: number) => Array.from({ length: times }, () => moves).flat();

describe("shogi sennichite", () => {
  test("continuous checks lose even when the escaping move completes the fourth repetition", () => {
    let state = shogiPosition("shogi", "gote", [[8, 0, "k", "sente"], [0, 3, "k", "gote"], [5, 5, "r", "sente"]]);
    state = play(state, [step(0, 3, 0, 4), ...repeat([step(5, 5, 5, 4), step(0, 4, 0, 5), step(5, 4, 5, 5), step(0, 5, 0, 4)], 4)]);
    expect(state).toMatchObject({ ply: 13, status: "completed", result: "gote", outcomeReason: "perpetual-check" });
    expect(state.moves.at(-1)).toMatchObject({ from: { row: 0, col: 5 } });
  });

  test("continuous checks lose when a check completes the fourth repetition", () => {
    let state = shogiPosition("shogi", "sente", [[8, 0, "k", "sente"], [0, 4, "k", "gote"], [5, 7, "r", "sente"]]);
    state = play(state, [step(5, 7, 5, 4), ...repeat([step(0, 4, 0, 5), step(5, 4, 5, 5), step(0, 5, 0, 4), step(5, 5, 5, 4)], 4)]);
    expect(state).toMatchObject({ ply: 13, status: "completed", result: "gote", outcomeReason: "perpetual-check" });
  });

  test("gote loses by perpetual check too", () => {
    let state = shogiPosition("shogi", "sente", [[0, 8, "k", "gote"], [8, 5, "k", "sente"], [3, 3, "r", "gote"]]);
    state = play(state, [step(8, 5, 8, 4), ...repeat([step(3, 3, 3, 4), step(8, 4, 8, 3), step(3, 4, 3, 3), step(8, 3, 8, 4)], 4)]);
    expect(state).toMatchObject({ ply: 13, status: "completed", result: "sente", outcomeReason: "perpetual-check" });
  });

  test("checks mixed with quiet moves are a plain repetition draw", () => {
    let state = shogiPosition("shogi", "sente", [[8, 0, "k", "sente"], [0, 4, "k", "gote"], [5, 7, "r", "sente"]]);
    state = play(state, [step(5, 7, 5, 4), ...repeat([step(0, 4, 0, 3), step(5, 4, 5, 6), step(0, 3, 0, 4), step(5, 6, 5, 4)], 4)]);
    expect(state).toMatchObject({ ply: 13, status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("mini-shogi applies the same perpetual-check loss", () => {
    let state = shogiPosition("mini-shogi", "gote", [[4, 0, "k", "sente"], [0, 1, "k", "gote"], [2, 3, "r", "sente"]]);
    state = play(state, [step(0, 1, 0, 2), ...repeat([step(2, 3, 2, 2), step(0, 2, 0, 3), step(2, 2, 2, 3), step(0, 3, 0, 2)], 4)]);
    expect(state).toMatchObject({ ply: 13, status: "completed", result: "gote", outcomeReason: "perpetual-check" });
  });

  test("history saved before the check window existed can only end in a draw", () => {
    let state = shogiPosition("shogi", "sente", [[8, 0, "k", "sente"], [0, 4, "k", "gote"], [5, 7, "r", "sente"]]);
    state = play(state, [step(5, 7, 5, 4), step(0, 4, 0, 5)]);
    const legacy = structuredClone(state);
    const { key, count, occurrences, checker } = legacy.variantState!.shogiRepetition as { key: string; count: number; occurrences: Record<string, number>; checker: null };
    legacy.variantState = { ...legacy.variantState, shogiRepetition: { key, count, occurrences, checker } };
    const ended = play(legacy, repeat([step(5, 4, 5, 5), step(0, 5, 0, 4), step(5, 5, 5, 4), step(0, 4, 0, 5)], 4));
    expect(ended).toMatchObject({ status: "completed", result: "draw", outcomeReason: "repetition" });
  });

  test("saved games keep the check window through export and import", () => {
    let state = shogiPosition("shogi", "gote", [[8, 0, "k", "sente"], [0, 3, "k", "gote"], [5, 5, "r", "sente"]]);
    state = play(state, [step(0, 3, 0, 4), ...repeat([step(5, 5, 5, 4), step(0, 4, 0, 5), step(5, 4, 5, 5), step(0, 5, 0, 4)], 2)]);
    expect(state).toMatchObject({ ply: 9, status: "active" });
    const settings = { playMode: "offline" as const, botMode: "human" as const, botDifficulty: botDifficultyLevels[0].key, timeControl: "freestyle" as const, humanColor: "sente" as const, seatChoice: "first" as const, boardOrientation: "auto" as const };
    const imported = importLocalMatch(exportLocalMatch({ state, history: [], future: [], settings }).contents);
    expect(imported.state.variantState?.shogiRepetition).toEqual(state.variantState?.shogiRepetition);
    const ended = play(imported.state, [step(5, 5, 5, 4), step(0, 4, 0, 5), step(5, 4, 5, 5), step(0, 5, 0, 4)]);
    expect(ended).toMatchObject({ status: "completed", result: "gote", outcomeReason: "perpetual-check" });
  });
});
