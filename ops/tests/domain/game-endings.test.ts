import { describe, expect, test } from "vitest";

import { applyBotMoveAfterThinking } from "@/lib/game/bot-clock";
import { settleTurnClockElapsed, tickGameClock } from "@/lib/game/clocks";
import { describeGameOutcome } from "@/lib/game/outcome";
import { applyMove, createInitialState, getLegalMoves, type GameState, type PlayerColor } from "@/lib/variants";

type Placement = `${"w" | "b"}${string}@${string}`;

function sq(name: string) {
  return { row: 8 - Number(name[1]), col: name.charCodeAt(0) - 97 };
}

function position(variantKey: string, turn: PlayerColor, placements: Placement[], extra: Partial<GameState> = {}): GameState {
  const state = createInitialState(variantKey, `endings-${variantKey}`);
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  for (const placement of placements) {
    const [piece, square] = placement.split("@");
    const owner = piece[0] === "w" ? "white" : "black";
    const code = piece.slice(1);
    const { row, col } = sq(square);
    state.board[row][col].piece = { id: `${owner}-${code}-${square}`, code, owner, labelKey: code };
  }
  return { ...state, turn, ...extra };
}

function play(state: GameState, from: string, to: string) {
  return applyMove(state, { from: sq(from), to: sq(to) });
}

function flagged(state: GameState, remainingMs = 500) {
  state.clocks = state.clocks.map((clock) => (clock.color === state.turn ? { ...clock, remainingMs } : clock));
  return state;
}

describe("racing kings endings", () => {
  test("a stalemated side draws instead of hanging until its clock runs out", () => {
    const before = position("racing-kings", "white", ["bk@h1", "wk@e4", "wr@a2", "wr@g6"]);

    const next = play(before, "g6", "g5");

    expect(next).toMatchObject({ status: "completed", result: "draw", outcomeReason: "stalemate" });
    expect(getLegalMoves(next, sq("h1"))).toEqual([]);
  });

  test("a stalemated white side is drawn the same way", () => {
    const before = position("racing-kings", "black", ["wk@h1", "bk@e4", "br@a2", "br@g6"]);

    expect(play(before, "g6", "g5")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "stalemate" });
  });

  test("white wins at once when black has no reply after white reaches the eighth rank", () => {
    const before = position("racing-kings", "white", ["bk@h1", "wk@g7", "wr@a2", "wr@g5"]);

    expect(play(before, "g7", "g8")).toMatchObject({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("white wins at once when no black king move can reach the eighth rank", () => {
    const before = position("racing-kings", "white", ["bk@c3", "wk@g7"]);

    expect(play(before, "g7", "g8")).toMatchObject({ status: "completed", result: "white", outcomeReason: "objective" });
  });

  test("black still gets its drawing reply when it can reach the eighth rank", () => {
    const before = position("racing-kings", "white", ["bk@b7", "wk@g7"]);

    const reached = play(before, "g7", "g8");
    expect(reached.status).toBe("active");
    expect(reached.variantState).toMatchObject({ racingKingsWhiteReached: true });
    expect(play(reached, "b7", "b8")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "objective" });
  });

  test("the fifty-move rule applies to quiet racing kings play", () => {
    const before = position("racing-kings", "white", ["bk@a1", "wk@h1", "wn@e4"], { halfmoveClock: 99 });

    expect(play(before, "e4", "c5")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "fifty-move", halfmoveClock: 100 });
  });
});

describe("insufficient material", () => {
  test("king of the hill keeps playing with bare kings because a king can still reach the centre", () => {
    const before = position("king-of-the-hill", "white", ["wk@b2", "bk@e6", "bp@b3"]);

    const bare = play(before, "b2", "b3");
    expect(bare).toMatchObject({ status: "active" });
    expect(bare.result).toBeUndefined();
    expect(play(bare, "e6", "e5")).toMatchObject({ status: "completed", result: "black", outcomeReason: "objective" });
  });

  test.each(["classic", "chess960"])("%s draws king and bishop against king", (variantKey) => {
    const before = position(variantKey, "white", ["wk@e1", "wb@b5", "bk@e8", "bn@a6"]);

    expect(play(before, "b5", "a6")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
  });

  test.each(["classic", "chess960"])("%s draws king and knight against king", (variantKey) => {
    const before = position(variantKey, "white", ["wk@e1", "wn@c5", "bk@e8", "bp@d7"]);

    expect(play(before, "c5", "d7")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
  });

  test("classic draws when every remaining bishop stands on one square colour", () => {
    const before = position("classic", "white", ["wk@e1", "wb@d2", "bk@e8", "bb@c5", "bn@a5"]);

    expect(play(before, "d2", "a5")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
  });

  test("classic keeps opposite-coloured bishops, two knights and knight against knight in play", () => {
    const opposite = position("classic", "white", ["wk@e1", "wb@d2", "bk@e8", "bb@d5", "bn@a5"]);
    const twoKnights = position("classic", "white", ["wk@e1", "wn@c5", "wn@g1", "bk@e8", "bp@d7"]);
    const knightAgainstKnight = position("classic", "white", ["wk@e1", "wn@c5", "bk@e8", "bn@b8", "bp@d7"]);

    expect(play(opposite, "d2", "a5").status).toBe("active");
    expect(play(twoKnights, "c5", "d7").status).toBe("active");
    expect(play(knightAgainstKnight, "c5", "d7").status).toBe("active");
  });

  test("three-check keeps a lone minor piece in play but still draws bare kings", () => {
    const bishop = position("three-check", "white", ["wk@e1", "wb@b5", "bk@e8", "bn@a6"]);
    const bare = position("three-check", "white", ["wk@e1", "wb@b5", "bk@a6"]);

    expect(play(bishop, "b5", "a6").status).toBe("active");
    expect(play({ ...bare, turn: "black" }, "a6", "b5")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "insufficient-material" });
  });

  test("the draw copy still explains bare kings and covers minor-piece endings", () => {
    const drawn = play(position("classic", "white", ["wk@e1", "wn@c5", "bk@e8", "bp@d7"]), "c5", "d7");

    const context = describeGameOutcome(drawn, "white")?.context.join(" ");
    expect(context).toContain("only the two kings");
    expect(context).toContain("knight");
  });
});

describe("fifty-move rule precedence", () => {
  test("checkmate on the hundredth half-move wins instead of drawing", () => {
    const before = position("classic", "white", ["wk@g6", "wr@a1", "bk@h8"], { halfmoveClock: 99 });

    expect(play(before, "a1", "a8")).toMatchObject({ status: "completed", result: "white", outcomeReason: "checkmate", halfmoveClock: 100 });
  });

  test("the third check on the hundredth half-move wins three-check", () => {
    const before = position("three-check", "white", ["wk@a1", "wr@h1", "bk@e8"], { halfmoveClock: 99, checks: { black: 2 } });

    const next = play(before, "h1", "h8");
    expect(next).toMatchObject({ status: "completed", result: "white", outcomeReason: "three-check" });
    expect(next.checks.black).toBe(3);
  });

  test("a non-mating check on the hundredth half-move is still a fifty-move draw", () => {
    const before = position("classic", "white", ["wk@e1", "wr@a1", "bk@e8"], { halfmoveClock: 99 });

    expect(play(before, "a1", "a8")).toMatchObject({ status: "completed", result: "draw", outcomeReason: "fifty-move" });
  });
});

describe("timeouts against insufficient mating material", () => {
  const cases: Array<{ name: string; variantKey: string; turn: PlayerColor; pieces: Placement[]; result: GameState["result"] }> = [
    { name: "classic queen side flags against a bare king", variantKey: "classic", turn: "black", pieces: ["wk@e1", "bk@e8", "bq@d8"], result: "draw" },
    { name: "chess960 queen side flags against a bare king", variantKey: "chess960", turn: "black", pieces: ["wk@e1", "bk@e8", "bq@d8"], result: "draw" },
    { name: "three-check queen side flags against a bare king", variantKey: "three-check", turn: "black", pieces: ["wk@e1", "bk@e8", "bq@d8"], result: "draw" },
    { name: "classic queen side flags against a lone knight", variantKey: "classic", turn: "black", pieces: ["wk@e1", "wn@b1", "bk@e8", "bq@d8"], result: "draw" },
    { name: "classic rook side flags against a lone knight", variantKey: "classic", turn: "black", pieces: ["wk@e1", "wn@b1", "bk@e8", "br@a8"], result: "white" },
    { name: "classic pawn side flags against a lone bishop", variantKey: "classic", turn: "black", pieces: ["wk@e1", "wb@c1", "bk@e8", "bp@a7"], result: "white" },
    { name: "classic same-coloured bishops flag", variantKey: "classic", turn: "black", pieces: ["wk@e1", "wb@c1", "bk@e8", "bb@f8"], result: "draw" },
    { name: "classic opposite-coloured bishops flag", variantKey: "classic", turn: "black", pieces: ["wk@e1", "wb@c1", "bk@e8", "bb@c8"], result: "white" },
    { name: "three-check lone knight still wins", variantKey: "three-check", turn: "black", pieces: ["wk@e1", "wn@b1", "bk@e8", "bq@d8"], result: "white" },
    { name: "king of the hill bare king still wins", variantKey: "king-of-the-hill", turn: "black", pieces: ["wk@e1", "bk@e8", "bq@d8"], result: "white" },
    { name: "crazyhouse bare king still wins", variantKey: "crazyhouse", turn: "black", pieces: ["wk@e1", "bk@e8", "bq@d8"], result: "white" },
    { name: "classic full material flag still wins", variantKey: "classic", turn: "white", pieces: ["wk@e1", "wq@d1", "bk@e8", "bq@d8"], result: "black" }
  ];

  test.each(cases)("$name (live tick)", ({ variantKey, turn, pieces, result }) => {
    const next = tickGameClock(flagged(position(variantKey, turn, pieces)), 1_000);

    expect(next).toMatchObject({ status: "completed", result, outcomeReason: "timeout" });
  });

  test.each(cases)("$name (settled thinking time)", ({ variantKey, turn, pieces, result }) => {
    const snapshot = flagged(position(variantKey, turn, pieces));

    expect(settleTurnClockElapsed(snapshot, snapshot, 1_000)).toMatchObject({ status: "completed", result, outcomeReason: "timeout" });
  });

  test("a bot whose thinking flags against a bare king only draws", () => {
    const snapshot = flagged(position("classic", "black", ["wk@e1", "bk@e8", "bq@d8"]));

    const next = applyBotMoveAfterThinking(snapshot, snapshot, { from: sq("d8"), to: sq("d1") }, 1_000);
    expect(next).toMatchObject({ status: "completed", result: "draw", outcomeReason: "timeout", ply: 0 });
  });

  test("xiangqi flags are unaffected by western mating-material rules", () => {
    const state = createInitialState("xiangqi", "endings-xiangqi");
    const flaggedSide = state.turn;
    const next = tickGameClock(flagged(state), 1_000);

    expect(next.status).toBe("completed");
    expect(next.result).not.toBe("draw");
    expect(next.result).not.toBe(flaggedSide);
  });

  test("a drawn timeout is described as a draw with the reason", () => {
    const drawn = tickGameClock(flagged(position("classic", "black", ["wk@e1", "bk@e8", "bq@d8"])), 1_000);

    const outcome = describeGameOutcome(drawn, "white");
    expect(outcome).toMatchObject({ result: "draw", headline: "Draw by time" });
    expect(outcome?.context.join(" ")).toContain("cannot checkmate");
  });
});
