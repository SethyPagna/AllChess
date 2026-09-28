import { describe, expect, test } from "vitest";
import { formatMoveNotation, formatTimelineNotation } from "@/lib/game/notation";
import { applyMove, createInitialState, type GameState, type Move, type Piece, type PlayerColor, type Square } from "@/lib/variants";

function at(name: string, rows = 8): Square {
  return { row: rows - Number(name.slice(1)), col: name.charCodeAt(0) - 97 };
}

function route(text: string, rows: number): Move {
  const match = /^([a-z])(\d+)([a-z])(\d+)$/.exec(text);
  if (!match) throw new Error(`Bad route ${text}`);
  return { from: at(`${match[1]}${match[2]}`, rows), to: at(`${match[3]}${match[4]}`, rows) };
}

function play(start: GameState, moves: Array<string | Move>) {
  const timeline = [start];
  let state = start;
  for (const move of moves) {
    state = applyMove(state, typeof move === "string" ? route(move, start.board.length) : move);
    timeline.push(state);
  }
  return { timeline, state, notation: formatTimelineNotation(timeline, state.moves) };
}

function emptyBoard(variant: string, turn?: PlayerColor) {
  const state = createInitialState(variant, `notation-${variant}`);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  if (turn) state.turn = turn;
  return state;
}

function put(state: GameState, square: string, code: string, owner: PlayerColor, extra: Partial<Piece> = {}) {
  const { row, col } = at(square, state.board.length);
  state.board[row][col].piece = { id: `${owner}-${code}-${square}`, code, owner, labelKey: "chess.pawn", ...extra };
}

function pieceOn(state: GameState, square: string) {
  const { row, col } = at(square, state.board.length);
  return state.board[row][col].piece;
}

/** Stand-in for a position produced by an engine encoding this engine does not generate yet. */
function manualAfter(before: GameState, move: Move, placements: Array<[string, Piece | null]>) {
  const after: GameState = structuredClone(before);
  for (const [square, piece] of placements) {
    const { row, col } = at(square, after.board.length);
    after.board[row][col].piece = piece;
  }
  after.moves.push({ ...move, notation: "raw" });
  after.ply += 1;
  after.turn = before.turn === "white" ? "black" : "white";
  return after;
}

function drop(code: string, owner: PlayerColor, square: string, rows = 8): Move {
  return { kind: "drop", from: { row: -1, col: -1 }, to: at(square, rows), drop: { id: `${owner}-${code}-hand`, code, owner, labelKey: "chess.pawn" } };
}

describe("Western SAN", () => {
  test("a short classic opening reads as standard algebraic notation", () => {
    const { notation, state } = play(createInitialState("classic", "opening"), ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);
    expect(notation).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(state.moves[0].notation).toBe("P6,4-4,4");
  });

  test("pawn and piece captures use x, with the pawn's origin file", () => {
    const { notation } = play(createInitialState("classic", "captures"), ["e2e4", "d7d5", "e4d5", "d8d5"]);
    expect(notation).toEqual(["e4", "d5", "exd5", "Qxd5"]);
  });

  test("en passant is written as a pawn capture onto the empty square", () => {
    const { notation, state } = play(createInitialState("classic", "en-passant"), ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    expect(pieceOn(state, "d5")).toBeNull();
    expect(notation.at(-1)).toBe("exd6");
  });

  test("knights are disambiguated by file when both can reach the square", () => {
    const { notation } = play(createInitialState("classic", "file-disambiguation"), ["d2d4", "d7d5", "g1f3", "g8f6", "b1d2"]);
    expect(notation.at(-1)).toBe("Nbd2");
  });

  test("knights on the same file are disambiguated by rank", () => {
    const state = emptyBoard("classic", "white");
    put(state, "h1", "k", "white"); put(state, "a8", "k", "black");
    put(state, "g1", "n", "white"); put(state, "g5", "n", "white");
    expect(formatMoveNotation(state, route("g1f3", 8))).toBe("N1f3");
    expect(formatMoveNotation(state, route("g5f3", 8))).toBe("N5f3");
  });

  test("uses file and rank when a rival shares each", () => {
    const state = emptyBoard("classic", "white");
    put(state, "h1", "k", "white"); put(state, "a8", "k", "black");
    put(state, "c3", "n", "white"); put(state, "c5", "n", "white"); put(state, "g3", "n", "white");
    expect(formatMoveNotation(state, route("c3e4", 8))).toBe("Nc3e4");
    expect(formatMoveNotation(state, route("g3e4", 8))).toBe("Nge4");
  });

  test("castling on both sides", () => {
    const state = emptyBoard("classic", "white");
    put(state, "e1", "k", "white"); put(state, "a1", "r", "white"); put(state, "h1", "r", "white");
    put(state, "e8", "k", "black"); put(state, "a8", "r", "black"); put(state, "h8", "r", "black");
    const { notation } = play(state, ["e1g1", "e8c8"]);
    expect(notation).toEqual(["O-O", "O-O-O"]);
  });

  test("castling is recognised from Chess960-style encodings", () => {
    const kingOntoRook = emptyBoard("chess960", "white");
    put(kingOntoRook, "e1", "k", "white"); put(kingOntoRook, "h1", "r", "white"); put(kingOntoRook, "a8", "k", "black");
    const onRook = { from: at("e1"), to: at("h1") };
    const castled = manualAfter(kingOntoRook, onRook, [["e1", null], ["h1", null], ["g1", pieceOn(kingOntoRook, "e1")], ["f1", pieceOn(kingOntoRook, "h1")]]);
    expect(formatMoveNotation(kingOntoRook, onRook, castled)).toBe("O-O");

    const oneStep = emptyBoard("chess960", "white");
    put(oneStep, "b1", "k", "white"); put(oneStep, "a1", "r", "white"); put(oneStep, "h8", "k", "black");
    const kingStep = { from: at("b1"), to: at("c1") };
    const long = manualAfter(oneStep, kingStep, [["b1", null], ["a1", null], ["c1", pieceOn(oneStep, "b1")], ["d1", pieceOn(oneStep, "a1")]]);
    expect(formatMoveNotation(oneStep, kingStep, long)).toBe("O-O-O");
  });

  test.each([
    ["h6", null, "e7e8", "e8=Q"],
    ["h8", null, "e7e8", "e8=Q+"],
    ["h6", "d8", "e7d8", "exd8=Q"]
  ])("promotion with the black king on %s and a rook on %s: %s is %s", (blackKing, rook, move, expected) => {
    const state = emptyBoard("classic", "white");
    put(state, "a1", "k", "white"); put(state, blackKing, "k", "black"); put(state, "e7", "p", "white");
    if (rook) put(state, rook, "r", "black");
    expect(play(state, [move]).notation).toEqual([expected]);
  });

  test("promotion reads the promoted piece from the position after, or promoteTo when there is none", () => {
    const state = emptyBoard("classic", "white");
    put(state, "a1", "k", "white"); put(state, "h6", "k", "black"); put(state, "e7", "p", "white");
    const move = route("e7e8", 8);
    const underpromoted = manualAfter(state, move, [["e7", null], ["e8", { ...pieceOn(state, "e7")!, code: "n", promoted: true }]]);
    expect(formatMoveNotation(state, move, underpromoted)).toBe("e8=N");

    expect(play(state, [{ ...move, promoteTo: "n" }]).notation).toEqual(["e8=N"]);

    const unplayable: GameState = { ...state, status: "completed" };
    expect(formatMoveNotation(unplayable, { ...move, promoteTo: "n" })).toBe("e8=N");
    expect(formatMoveNotation(unplayable, { ...move, promoteTo: "rook" })).toBe("e8=R");
    expect(formatMoveNotation(unplayable, move)).toBe("e8=Q");
  });

  test("check is marked with +", () => {
    const { notation } = play(createInitialState("classic", "check"), ["e2e4", "f7f6", "d1h5"]);
    expect(notation).toEqual(["e4", "f6", "Qh5+"]);
  });

  test("fool's mate ends with #, even when the final position is missing from the timeline", () => {
    const { notation, timeline, state } = play(createInitialState("classic", "fools-mate"), ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(notation).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(formatTimelineNotation(timeline.slice(0, -1), state.moves)).toEqual(["f3", "e5", "g4", "Qh4#"]);
  });

  test.each([
    ["d5", "N@d5"],
    ["f6", "N@f6+"]
  ])("crazyhouse drop on %s is %s", (square, expected) => {
    const opened = play(createInitialState("crazyhouse", "drops"), ["e2e4", "e7e5"]).state;
    opened.hands = { ...opened.hands, white: { n: 1 } };
    expect(play(opened, [drop("n", "white", square)]).notation.at(-1)).toBe(expected);
  });

  test("chaturanga and shatranj use their own piece letters", () => {
    expect(play(createInitialState("chaturanga", "chaturanga"), ["e2e3", "g8f6", "c1a3"]).notation).toEqual(["e3", "Nf6", "Ea3"]);
    expect(play(createInitialState("shatranj", "shatranj"), ["e2e3", "c8a6", "d1e2"]).notation).toEqual(["e3", "Aa6", "Fe2"]);

    const promotion = emptyBoard("chaturanga", "white");
    put(promotion, "a1", "k", "white"); put(promotion, "h6", "k", "black"); put(promotion, "a7", "p", "black"); put(promotion, "e7", "p", "white");
    expect(play(promotion, ["e7e8"]).notation).toEqual(["e8=M"]);
  });
});

describe("coordinate notation for other games", () => {
  test("shogi moves, captures with promotion, and drops", () => {
    const { notation } = play(createInitialState("shogi", "shogi"), [
      "c3c4",
      "g7g6",
      { ...route("b2h8", 9), promotion: true },
      "g9h8",
      drop("b", "sente", "e5", 9)
    ]);
    expect(notation).toEqual(["Pc3-c4", "Pg7-g6", "Bb2xh8+", "Sg9xh8", "B*e5"]);
  });

  test("promoted shogi pieces carry a + prefix", () => {
    const { notation } = play(createInitialState("shogi", "shogi-horse"), ["c3c4", "g7g6", { ...route("b2h8", 9), promotion: true }, "a7a6", "h8g8"]);
    expect(notation.slice(2)).toEqual(["Bb2xh8+", "Pa7-a6", "+Bh8-g8"]);
  });

  test("xiangqi moves and cannon captures use from and to squares", () => {
    const { notation } = play(createInitialState("xiangqi", "xiangqi"), ["b3e3", "h10g8", "e3e7"]);
    expect(notation).toEqual(["Cb3-e3", "Hh10-g8", "Ce3xe7"]);
  });

  test("draughts captures are detected when a jumped piece disappears", () => {
    const { notation, timeline, state } = play(createInitialState("english-draughts", "draughts"), ["c3d4", "f6e5", "d4f6", "g7e5"]);
    expect(notation).toEqual(["c3-d4", "f6-e5", "d4xf6", "g7xe5"]);
    const jump = state.moves[2];
    expect(formatMoveNotation({ ...timeline[2], status: "completed" }, jump)).toBe("d4xf6");
  });

  test("makruk promotions add + and the promoted piece keeps a + prefix", () => {
    const state = emptyBoard("makruk", "white");
    put(state, "h1", "k", "white"); put(state, "h8", "k", "black"); put(state, "a5", "p", "white"); put(state, "d6", "p", "black");
    expect(play(state, ["a5a6", "h8g8", "a6b7"]).notation).toEqual(["Pa5-a6+", "Kh8-g8", "+Ma6-b7"]);
  });

  test("Kōnane removals, Kōnane jumps, Janggi passes and Jungle moves", () => {
    const konane = createInitialState("konane", "konane");
    expect(formatMoveNotation(konane, { kind: "remove", from: at("a8"), to: at("a8") })).toBe("xa8");

    const jumping = emptyBoard("konane", "black");
    jumping.variantState = { ...jumping.variantState, konaneOpening: { removals: 2 } };
    put(jumping, "a8", "p", "black"); put(jumping, "b8", "p", "white");
    expect(formatMoveNotation(jumping, route("a8c8", 8))).toBe("a8xc8");

    const janggi = createInitialState("janggi", "janggi");
    expect(formatMoveNotation(janggi, { kind: "pass", from: { row: 0, col: 0 }, to: { row: 0, col: 0 } })).toBe("pass");

    expect(play(createInitialState("jungle", "jungle"), ["a3a4"]).notation).toEqual(["Ea3-a4"]);
  });
});

describe("fallback", () => {
  const raw = { from: at("e4"), to: at("e5"), notation: "P4,4-3,4" };

  test("returns the stored notation when the move cannot be read from the position", () => {
    expect(formatMoveNotation(createInitialState("classic", "empty-origin"), raw)).toBe("P4,4-3,4");
    expect(formatMoveNotation({ ...createInitialState("classic", "unknown"), variantKey: "not-a-variant" }, raw)).toBe("P4,4-3,4");
    expect(formatMoveNotation(null as unknown as GameState, raw)).toBe("P4,4-3,4");
    expect(formatMoveNotation(createInitialState("classic", "no-notation"), { from: at("e4"), to: at("e5") })).toBe("");
    expect(formatMoveNotation(createInitialState("classic", "off-board"), { from: { row: 9, col: 9 }, to: { row: 10, col: 10 }, notation: "raw" })).toBe("raw");
  });

  test("timelines without a matching position fall back per move and never throw", () => {
    const { timeline, state } = play(createInitialState("classic", "trimmed"), ["e2e4", "e7e5", "g1f3"]);
    expect(formatTimelineNotation([], state.moves)).toEqual(state.moves.map((move) => move.notation));
    expect(formatTimelineNotation(timeline.slice(1), state.moves)).toEqual([state.moves[0].notation, "e5", "Nf3"]);
    expect(formatTimelineNotation(timeline, undefined as unknown as GameState["moves"])).toEqual([]);
    expect(formatTimelineNotation(null as unknown as GameState[], state.moves)).toEqual(state.moves.map((move) => move.notation));
  });

  test("does not modify the timeline or the stored notation", () => {
    const { timeline, state } = play(createInitialState("classic", "pure"), ["e2e4", "e7e5", "g1f3"]);
    const snapshot = JSON.stringify(timeline);
    formatTimelineNotation(timeline, state.moves);
    formatTimelineNotation(timeline.slice(0, -1), state.moves);
    expect(JSON.stringify(timeline)).toBe(snapshot);
    expect(state.moves.map((move) => move.notation)).toEqual(["P6,4-4,4", "P1,4-3,4", "N7,6-5,5"]);
  });
});
