import { describe, expect, test } from "vitest";

import { buildChess960Fen, buildStockfishCommands, uciToLegalMove } from "@/lib/bot/stockfish-engine";
import { applyMove, createInitialState, getCastlingRights, getLegalMoves, getVariant, type GameState, type Move, type PlayerColor, type Square } from "@/lib/variants";
import {
  CHESS960_PROFILE,
  LEGACY_CHESS960_BACK_RANK,
  chess960BackRank,
  chess960IndexForId,
  chess960IndexOf,
  isChess960BackRank,
  readChess960BackRank,
  restoreChess960Opening,
  withChess960BackRank
} from "@/lib/variants/chess960";
import { buildBoard } from "@/lib/variants/engine";

type Placement = [row: number, col: number, code: string, owner: PlayerColor];

const sq = (row: number, col: number): Square => ({ row, col });
const rankOf = (state: GameState, row: number, owner: PlayerColor) =>
  state.board[row].map((cell) => (cell.piece?.owner === owner ? cell.piece.code : ".")).join("");

/** A Chess960 game on `backRank` whose back ranks keep only kings and rooks (pawns stay), plus `extra`. */
function castlingPosition(backRank: string, extra: Placement[] = [], turn: PlayerColor = "white") {
  const state = withChess960BackRank(createInitialState("chess960", `castle-${backRank}`), backRank);
  for (const row of [0, 7]) state.board[row].forEach((cell) => {
    if (cell.piece && !["k", "r"].includes(cell.piece.code)) cell.piece = null;
  });
  for (const [row, col, code, owner] of extra) state.board[row][col].piece = { id: `${owner}-${code}-extra-${row}-${col}`, code, owner, labelKey: `chess.${code}` };
  state.turn = turn;
  return state;
}

function castles(state: GameState, from: Square) {
  return getLegalMoves(state, from).filter((move) => {
    const target = state.board[move.to.row][move.to.col].piece;
    return Math.abs(move.to.col - move.from.col) >= 2 || (target?.code === "r" && target.owner === state.turn);
  });
}

function playAll(start: GameState, moves: Move[]) {
  return moves.reduce((state, move) => applyMove(state, move), start);
}

describe("Chess960 setup", () => {
  test("Scharnagl numbering yields all 960 distinct legal back ranks", () => {
    const ranks = Array.from({ length: 960 }, (_, index) => chess960BackRank(index));

    expect(new Set(ranks).size).toBe(960);
    expect(chess960BackRank(518)).toBe("rnbqkbnr");
    for (const rank of ranks) {
      expect(isChess960BackRank(rank)).toBe(true);
      const bishops = [rank.indexOf("b"), rank.lastIndexOf("b")];
      expect((bishops[0] + bishops[1]) % 2).toBe(1);
      expect(rank.indexOf("r")).toBeLessThan(rank.indexOf("k"));
      expect(rank.indexOf("k")).toBeLessThan(rank.lastIndexOf("r"));
    }
    for (let index = 0; index < 960; index += 37) expect(chess960IndexOf(ranks[index])).toBe(index);
    expect(isChess960BackRank("rnbqkbrn")).toBe(true);
    expect(isChess960BackRank("rnbkbqnr")).toBe(false);
    expect(isChess960BackRank("rnbqkbnq")).toBe(false);
    expect(isChess960BackRank("krbqnbnr")).toBe(false);
  });

  test("new games place a valid, mirrored back rank derived from the game id", () => {
    for (let index = 0; index < 250; index += 1) {
      const id = `seed-${index}`;
      const state = createInitialState("chess960", id);
      const white = rankOf(state, 7, "white");

      expect(isChess960BackRank(white)).toBe(true);
      expect(rankOf(state, 0, "black")).toBe(white);
      expect(rankOf(state, 1, "black")).toBe("pppppppp");
      expect(rankOf(state, 6, "white")).toBe("pppppppp");
      expect(white).toBe(chess960BackRank(chess960IndexForId(id)));
      expect(state.variantState).toEqual({ chess960Profile: CHESS960_PROFILE, chess960Position: chess960IndexForId(id), chess960BackRank: white });
      expect(state.board[7][white.indexOf("k")].piece).toMatchObject({ id: `white-k-7-${white.indexOf("k")}`, labelKey: "chess.king" });
    }
  });

  test("the same id always rebuilds the same setup, and ids spread across setups", () => {
    const first = createInitialState("chess960", "repeatable-game");
    const second = createInitialState("chess960", "repeatable-game");

    expect(second.board).toEqual(first.board);
    expect(second.variantState).toEqual(first.variantState);
    expect(new Set(Array.from({ length: 250 }, (_, index) => rankOf(createInitialState("chess960", `spread-${index}`), 7, "white"))).size).toBeGreaterThan(150);
  });

  test("every one of the 960 setups is reachable from game ids", () => {
    const reached = new Set<number>();
    for (let index = 0; index < 10000; index += 1) reached.add(chess960IndexForId(`game-${index}`));

    expect(reached.size).toBe(960);
    expect(chess960IndexForId(crypto.randomUUID())).toBeGreaterThanOrEqual(0);
  });
});

describe("Chess960 castling", () => {
  test("a king already on g1 castles kingside by selecting its rook and queenside to c1", () => {
    const state = castlingPosition("rbbnnqkr");

    expect(castles(state, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 7) }, { from: sq(7, 6), to: sq(7, 2) }]);

    const kingside = applyMove(state, { from: sq(7, 6), to: sq(7, 7) });
    expect(rankOf(kingside, 7, "white")).toBe("r....rk.");
    expect(kingside.moves.at(-1)).toMatchObject({ from: sq(7, 6), to: sq(7, 7) });

    const queenside = applyMove(state, { from: sq(7, 6), to: sq(7, 2) });
    expect(rankOf(queenside, 7, "white")).toBe("..kr...r");
    expect(queenside.board[7][3].piece?.id).toBe("white-r-7-0");

    // Black mirrors the same rights.
    const blackQueenside = applyMove(kingside, { from: sq(0, 6), to: sq(0, 2) });
    expect(rankOf(blackQueenside, 0, "black")).toBe("..kr...r");
  });

  test("a rook already on its destination stays there while the king crosses", () => {
    const rookOnD = castlingPosition("bnnrkbqr");
    expect(castles(rookOnD, sq(7, 4))).toEqual([{ from: sq(7, 4), to: sq(7, 6) }, { from: sq(7, 4), to: sq(7, 2) }]);
    expect(rankOf(applyMove(rookOnD, { from: sq(7, 4), to: sq(7, 2) }), 7, "white")).toBe("..kr...r");
    expect(rankOf(applyMove(rookOnD, { from: sq(7, 4), to: sq(7, 6) }), 7, "white")).toBe("...r.rk.");

    // The king passes over its own rook on f1 on the way to g1.
    const rookOnF = castlingPosition("rkbbnrqn");
    expect(castles(rookOnF, sq(7, 1))).toContainEqual({ from: sq(7, 1), to: sq(7, 6) });
    const next = applyMove(rookOnF, { from: sq(7, 1), to: sq(7, 6) });
    expect(rankOf(next, 7, "white")).toBe("r....rk.");
    expect(next.board[7][5].piece?.id).toBe("white-r-7-5");
  });

  test("a king moving one file castles by selecting its rook", () => {
    const swap = castlingPosition("bnrqnkrb");
    expect(castles(swap, sq(7, 5))).toContainEqual({ from: sq(7, 5), to: sq(7, 6) });
    expect(rankOf(applyMove(swap, { from: sq(7, 5), to: sq(7, 6) }), 7, "white")).toBe("..r..rk.");

    const queenside = castlingPosition("rkqnbbnr");
    expect(castles(queenside, sq(7, 1))).toContainEqual({ from: sq(7, 1), to: sq(7, 0) });
    expect(rankOf(applyMove(queenside, { from: sq(7, 1), to: sq(7, 0) }), 7, "white")).toBe("..kr...r");
  });

  test("king-takes-own-rook requests castle and are recorded in the canonical form", () => {
    const state = castlingPosition("bnnrkbqr");
    const kingside = applyMove(state, { from: sq(7, 4), to: sq(7, 7) });

    expect(rankOf(kingside, 7, "white")).toBe("...r.rk.");
    expect(kingside.moves.at(-1)).toMatchObject({ from: sq(7, 4), to: sq(7, 6) });
    expect(rankOf(applyMove(state, { from: sq(7, 4), to: sq(7, 3) }), 7, "white")).toBe("..kr...r");
  });

  test("pieces between the king, the rook and their destinations block castling", () => {
    const full = withChess960BackRank(createInitialState("chess960", "full-rank"), "rbbnnqkr");
    expect(castles(full, sq(7, 6))).toEqual([]);

    const knightOnB1 = castlingPosition("rbbnnqkr", [[7, 1, "n", "white"]]);
    expect(castles(knightOnB1, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 7) }]);
    expect(() => applyMove(knightOnB1, { from: sq(7, 6), to: sq(7, 2) })).toThrow("errors.invalidMove");
    expect(() => applyMove(knightOnB1, { from: sq(7, 6), to: sq(7, 0) })).toThrow("errors.invalidMove");

    const enemyOnF1 = castlingPosition("rbbnnqkr", [[7, 5, "b", "black"]]);
    expect(castles(enemyOnF1, sq(7, 6))).toEqual([]);

    // The other rook standing on c1 blocks the queenside king destination.
    const otherRook = castlingPosition("rkrnbbqn");
    expect(castles(otherRook, sq(7, 1))).toEqual([{ from: sq(7, 1), to: sq(7, 6) }]);
    expect(() => applyMove(otherRook, { from: sq(7, 1), to: sq(7, 0) })).toThrow("errors.invalidMove");
  });

  test("the king may not castle out of, through, or into check", () => {
    const base = castlingPosition("rbbnnqkr");
    expect(castles(base, sq(7, 6))).toHaveLength(2);

    const throughE1 = castlingPosition("rbbnnqkr", [[6, 2, "n", "black"]]);
    expect(castles(throughE1, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 7) }]);
    expect(() => applyMove(throughE1, { from: sq(7, 6), to: sq(7, 2) })).toThrow("errors.invalidMove");

    const intoC1 = castlingPosition("rbbnnqkr", [[5, 1, "n", "black"]]);
    expect(castles(intoC1, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 7) }]);

    const inCheck = castlingPosition("rbbnnqkr", [[5, 5, "n", "black"]]);
    expect(castles(inCheck, sq(7, 6))).toEqual([]);

    // A pawn guards the empty squares d1 and f1.
    const pawnGuard = castlingPosition("rbbnnqkr", [[6, 4, "p", "black"]]);
    expect(castles(pawnGuard, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 7) }]);

    // The castling rook shields g1 before castling but not after it moves to f1.
    const shield = castlingPosition("bnrqnkrb", [[7, 7, "r", "black"]]);
    expect(castles(shield, sq(7, 5))).not.toContainEqual({ from: sq(7, 5), to: sq(7, 6) });
    expect(() => applyMove(shield, { from: sq(7, 5), to: sq(7, 6) })).toThrow("errors.invalidMove");
  });

  test("castling rights are lost once the king or that rook has moved", () => {
    let state = castlingPosition("rbbnnqkr");
    state.board[6][7].piece = null;
    state.board[1][0].piece = null;
    state = playAll(state, [
      { from: sq(7, 7), to: sq(5, 7) },
      { from: sq(0, 0), to: sq(1, 0) },
      { from: sq(5, 7), to: sq(7, 7) },
      { from: sq(1, 0), to: sq(0, 0) }
    ]);
    expect(castles(state, sq(7, 6))).toEqual([{ from: sq(7, 6), to: sq(7, 2) }]);

    state = playAll(state, [{ from: sq(7, 6), to: sq(7, 5) }, { from: sq(0, 6), to: sq(0, 5) }, { from: sq(7, 5), to: sq(7, 6) }, { from: sq(0, 5), to: sq(0, 6) }]);
    expect(castles(state, sq(7, 6))).toEqual([]);
  });

  test("castling follows the recorded back rank when an imported copy changes the id", () => {
    const state = { ...castlingPosition("bnnrkbqr"), id: "imported-copy" };

    expect(readChess960BackRank(state)).toBe("bnnrkbqr");
    expect(castles(state, sq(7, 4))).toHaveLength(2);
  });

  test("classic castling keeps e1-g1 / e1-c1 and now respects pawn-guarded squares", () => {
    const classic = createInitialState("classic", "classic-castle");
    classic.board.forEach((row) => row.forEach((cell) => {
      if (cell.piece && !["k", "r"].includes(cell.piece.code)) cell.piece = null;
    }));

    expect(castles(classic, sq(7, 4))).toEqual([{ from: sq(7, 4), to: sq(7, 6) }, { from: sq(7, 4), to: sq(7, 2) }]);
    expect(rankOf(applyMove(classic, { from: sq(7, 4), to: sq(7, 2) }), 7, "white")).toBe("..kr...r");
    expect(rankOf(applyMove(classic, { from: sq(7, 4), to: sq(7, 6) }), 7, "white")).toBe("r....rk.");
    expect(applyMove(classic, { from: sq(7, 4), to: sq(7, 7) }).moves.at(-1)).toMatchObject({ to: sq(7, 6) });

    classic.board[6][6].piece = { id: "black-pawn-g2", code: "p", owner: "black", labelKey: "chess.pawn" };
    expect(castles(classic, sq(7, 4))).toEqual([{ from: sq(7, 4), to: sq(7, 2) }]);
  });
});

describe("Chess960 replay and saved games", () => {
  const castlingLine: Move[] = [
    { from: sq(6, 6), to: sq(5, 6) },
    { from: sq(1, 6), to: sq(2, 6) },
    { from: sq(7, 5), to: sq(6, 6) },
    { from: sq(0, 5), to: sq(1, 6) },
    { from: sq(6, 5), to: sq(4, 5) },
    { from: sq(1, 5), to: sq(3, 5) },
    { from: sq(7, 6), to: sq(6, 5) },
    { from: sq(0, 6), to: sq(1, 5) },
    { from: sq(7, 4), to: sq(7, 6) },
    { from: sq(0, 4), to: sq(0, 7) }
  ];

  test("random-v1 games replay from their recorded back rank even under another id", () => {
    const start = withChess960BackRank(createInitialState("chess960", "original-game"), "bnnrkbqr");
    const played = playAll(start, castlingLine);
    expect(rankOf(played, 7, "white")).toBe("bnnr.rk.");
    expect(rankOf(played, 0, "black")).toBe("bnnr.rk.");
    expect(played.moves.at(-1)).toMatchObject({ to: sq(0, 6) });

    const replayStart = restoreChess960Opening(createInitialState("chess960", "another-id"), played);
    expect(replayStart.board).toEqual(start.board);
    expect(replayStart.variantState).toEqual(start.variantState);
    expect(playAll(replayStart, played.moves).board).toEqual(played.board);
  });

  test("legacy fixed-setup saves restore and keep replaying", () => {
    const legacyStart: GameState = { ...createInitialState("chess960", "legacy-game"), board: buildBoard(getVariant("chess960")) };
    delete legacyStart.variantState;
    expect(rankOf(legacyStart, 7, "white")).toBe(LEGACY_CHESS960_BACK_RANK);

    const played = playAll(legacyStart, [
      { from: sq(7, 0), to: sq(5, 1) },
      { from: sq(0, 0), to: sq(2, 1) },
      { from: sq(6, 4), to: sq(4, 4) },
      { from: sq(1, 4), to: sq(3, 4) }
    ]);
    expect(played.variantState).toEqual({ westernRepetition: expect.any(String) });

    const restored = restoreChess960Opening(createInitialState("chess960", played.id), played);
    expect(restored.board).toEqual(legacyStart.board);
    expect(restored.variantState).toBeUndefined();
    expect(playAll(restored, played.moves).board).toEqual(played.board);
    expect(getCastlingRights(played).map((right) => `${right.owner}:${right.side}:${right.rookSquare.col}`)).toEqual([
      "white:king:5", "white:queen:1", "black:king:5", "black:queen:1"
    ]);
  });
});

describe("Chess960 Stockfish bridge", () => {
  test("sends the live position as FEN with Shredder castling rights", () => {
    const start = withChess960BackRank(createInitialState("chess960", "fen-game"), "bnnrkbqr");
    const fen = buildChess960Fen(start);
    expect(fen).toBe("bnnrkbqr/pppppppp/8/8/8/8/PPPPPPPP/BNNRKBQR w HDhd - 0 1");

    const commands = buildStockfishCommands(start, "hard", []);
    expect(commands).toContain("setoption name UCI_Chess960 value true");
    expect(commands).toContain(`position fen ${fen}`);
    expect(commands.some((command) => command.startsWith("position startpos"))).toBe(false);

    const afterPush = applyMove(start, { from: sq(6, 4), to: sq(4, 4) });
    expect(buildChess960Fen(afterPush)).toBe("bnnrkbqr/pppppppp/8/8/4P3/8/PPPP1PPP/BNNRKBQR b HDhd e3 0 1");
  });

  test("reads UCI_Chess960 king-takes-rook castling and drops spent rights", () => {
    const state = castlingPosition("bnnrkbqr");

    expect(uciToLegalMove(state, "e1h1")).toEqual({ from: sq(7, 4), to: sq(7, 6) });
    expect(uciToLegalMove(state, "e1d1")).toEqual({ from: sq(7, 4), to: sq(7, 2) });
    expect(uciToLegalMove(state, "e1g1")).toEqual({ from: sq(7, 4), to: sq(7, 6) });

    const castled = applyMove(state, uciToLegalMove(state, "e1h1")!);
    expect(buildChess960Fen(castled).split(" ")[2]).toBe("hd");
  });
});
