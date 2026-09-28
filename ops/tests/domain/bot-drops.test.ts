import { describe, expect, test } from "vitest";

import { allLegalMoves, chooseBotMoveSafe, requestBotMove, type BotTierKey } from "@/lib/bot/runtime";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, getVariant, type GameState, type Move, type PlayerColor } from "@/lib/variants";

const tiers: BotTierKey[] = ["elo-100-200", "easy", "normal", "hard", "legend"];
const pass: Move = { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } };

type PositionCase = { variantKey: string; rows: string[]; turn: PlayerColor; hands: GameState["hands"] };

/** Rows run top (row 0) to bottom; "." is empty, uppercase belongs to the first player and lowercase to the second. */
function position(variantKey: string, rows: string[], turn: PlayerColor, hands?: GameState["hands"]): GameState {
  const state = createInitialState(variantKey, `bot-drops-${variantKey}`);
  const [first, second] = getVariant(variantKey).players;
  for (const [row, cells] of state.board.entries()) {
    for (const [col, cell] of cells.entries()) {
      const token = rows[row]?.[col] ?? ".";
      const owner = token === token.toUpperCase() ? first : second;
      cell.piece = token === "." ? null : { id: `${owner}-${token.toLowerCase()}-${row}-${col}`, code: token.toLowerCase(), owner, labelKey: "chess.pawn" };
    }
  }
  state.turn = turn;
  if (hands) state.hands = hands;
  return state;
}

function moveKey(move: Move) {
  if (move.kind === "pass") return "pass";
  if (move.kind === "drop") return `${move.drop?.code}@${move.to.row},${move.to.col}`;
  return `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}${move.promotion ? "+" : ""}${move.promoteTo ?? ""}`;
}

/** Every move the engine offers: board moves per square, drops per piece in hand, and a pass. */
function engineMoveKeys(state: GameState) {
  const board = state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));
  const drops = Object.entries(state.hands?.[state.turn] ?? {}).flatMap(([code, count]) =>
    count > 0 ? getLegalMoves(state, { drop: { id: `${state.turn}-${code}-hand`, code, owner: state.turn, labelKey: `piece.${code}` } }) : []
  );
  return [...board, ...drops, ...(findLegalMove(state, pass) ? [pass] : [])].map(moveKey).sort();
}

/** The move as a client sends it: plain JSON with its kind, squares and dropped piece. */
function asRequest(move: Move): Move {
  return JSON.parse(JSON.stringify({ kind: move.kind, from: move.from, to: move.to, promotion: move.promotion, promoteTo: move.promoteTo, drop: move.drop }));
}

const dropOnlyChecks: PositionCase[] = [
  // White Ka1 behind its pawns is checked along the first rank; only a pocket knight can block.
  { variantKey: "crazyhouse", rows: [".......k", "........", "........", "........", "........", "........", "PP......", "K......r"], turn: "white", hands: { white: { n: 1 }, black: {} } },
  // Sente's king is checked along the back rank; only a silver from hand can block.
  { variantKey: "mini-shogi", rows: ["k....", ".....", ".....", "...PP", "r...K"], turn: "sente", hands: { sente: { s: 1 }, gote: {} } },
  { variantKey: "shogi", rows: ["k........", ".........", ".........", ".........", ".........", ".........", ".........", ".......PP", "r.......K"], turn: "sente", hands: { sente: { s: 1 }, gote: {} } }
];

describe("bot moves include drops and passes", () => {
  test.each(dropOnlyChecks)("$variantKey blocks a check with a drop at every tier through the drop request path", async ({ variantKey, rows, turn, hands }) => {
    const state = position(variantKey, rows, turn, structuredClone(hands));
    const engineDrops = engineMoveKeys(state);
    expect(engineDrops.length).toBeGreaterThan(0);
    expect(engineDrops.every((key) => key.includes("@"))).toBe(true);

    for (const tier of tiers) {
      const result = await requestBotMove(state, tier, { engine: "internal", maxSearchTimeMs: 40 });
      expect(result.status, `${variantKey} ${tier}`).toBe("ok");
      expect(result.validatedLegal).toBe(true);
      expect(result.move?.kind).toBe("drop");
      expect(result.uciMove).toMatch(/^[A-Z]@[a-z]\d+$/);
      const request = asRequest(result.move!);
      expect(engineDrops).toContain(moveKey(request));
      const next = applyMove(state, request);
      expect(next.turn).not.toBe(turn);
      expect(next.board[request.to.row][request.to.col].piece).toMatchObject({ code: request.drop?.code, owner: turn });
      expect(next.hands?.[turn]?.[request.drop!.code] ?? 0).toBe(0);
    }
  }, 60_000);

  test("a Shogi pawn interposition never drops onto a file the bot already holds (nifu)", async () => {
    const state = position("shogi", ["k........", ".........", ".........", ".........", ".........", ".........", ".........", ".......PP", "r.......K"], "sente", { sente: { p: 1 }, gote: {} });
    expect(allLegalMoves(state).map(moveKey).sort()).toEqual(engineMoveKeys(state));
    expect(engineMoveKeys(state)).toEqual(["p@8,1", "p@8,2", "p@8,3", "p@8,4", "p@8,5", "p@8,6"]);

    for (const tier of tiers) {
      const result = await requestBotMove(state, tier, { engine: "internal", maxSearchTimeMs: 40 });
      expect(result.status, tier).toBe("ok");
      expect(result.move).toMatchObject({ kind: "drop", drop: { code: "p" } });
      expect(result.move?.to.col).not.toBe(7);
    }
  }, 60_000);

  test("the bot offers every legal Mini Shogi pawn drop except the pawn-drop mate", () => {
    // P@(1,0) would mate the cornered gote king, which the rules forbid; other pawn drops stay legal.
    const state = position("mini-shogi", ["k....", "..S..", ".S...", ".....", "....K"], "sente", { sente: { p: 1 }, gote: {} });
    const botKeys = allLegalMoves(state).map(moveKey);

    expect(botKeys.sort()).toEqual(engineMoveKeys(state));
    expect(botKeys).not.toContain("p@1,0");
    expect(botKeys).toContain("p@2,0");
    const result = chooseBotMoveSafe(state, "legend", { engine: "internal", maxSearchTimeMs: 60 });
    expect(result.reason).toBe("ok");
    expect(moveKey(result.move!)).not.toBe("p@1,0");
    expect(() => applyMove(state, result.move!)).not.toThrow();
  });

  test.each<PositionCase & { winner: PlayerColor }>([
    // A rook dropped on gote's back rank mates the cornered king, which the silver fences in.
    { variantKey: "mini-shogi", rows: ["k....", ".....", ".S...", ".....", "....K"], turn: "sente", hands: { sente: { r: 1 }, gote: {} }, winner: "sente" },
    // N@f7 is a smothered mate.
    { variantKey: "crazyhouse", rows: ["......rk", "......pp", "........", "........", "........", "........", "PPP.....", "K......."], turn: "white", hands: { white: { n: 1 }, black: {} }, winner: "white" },
    // Only a distant rook drop on the h-file mates: g7 takes a rook on h6 and the king takes one on h7.
    { variantKey: "crazyhouse", rows: ["......rk", "......p.", "........", "........", "........", "........", "PP......", "K......."], turn: "white", hands: { white: { r: 1 }, black: {} }, winner: "white" }
  ])("$variantKey plays a mating drop at every tier", ({ variantKey, rows, turn, hands, winner }) => {
    const state = position(variantKey, rows, turn, structuredClone(hands));
    for (const tier of tiers) {
      const result = chooseBotMoveSafe(state, tier, { engine: "internal", maxSearchTimeMs: 300 });
      expect(result.move?.kind, `${variantKey} ${tier}`).toBe("drop");
      expect(applyMove(state, result.move!)).toMatchObject({ status: "completed", result: winner });
    }
  }, 30_000);

  test("a boxed-in Janggi general passes at every tier instead of reporting no legal moves", async () => {
    // Red's general is not in check, but the blue chariots cover every square it could reach.
    const state = position("janggi", ["...g.....", ".........", ".........", ".........", ".........", "...r.r...", ".........", ".........", "r........", "....G...."], "red");
    expect(engineMoveKeys(state)).toEqual(["pass"]);

    for (const tier of tiers) {
      const result = await requestBotMove(state, tier, { engine: "internal", maxSearchTimeMs: 40 });
      expect(result.status, tier).toBe("ok");
      expect(result.move?.kind).toBe("pass");
      expect(result.uciMove).toBe("0000");
      const next = applyMove(state, asRequest(result.move!));
      expect(next).toMatchObject({ status: "active", turn: "blue" });
      expect(next.moves.at(-1)?.kind).toBe("pass");
    }
  }, 60_000);

  test.each(["crazyhouse", "mini-shogi", "shogi", "janggi"])("%s bot move lists match every move kind the engine offers along a capture-heavy playout", (variantKey) => {
    let state = createInitialState(variantKey, `bot-drops-playout-${variantKey}`);
    let seed = 7;
    let dropsSeen = 0;
    for (let ply = 0; ply < 40 && state.status === "active"; ply += 1) {
      const botMoves = allLegalMoves(state);
      expect(botMoves.map(moveKey).sort(), `${variantKey} ply ${ply}`).toEqual(engineMoveKeys(state));
      dropsSeen += botMoves.filter((move) => move.kind === "drop").length;
      if (ply % 10 === 9) {
        const result = chooseBotMoveSafe(state, "easy", { engine: "internal", maxSearchTimeMs: 8 });
        expect(result.reason).toBe(botMoves.length ? "ok" : "no-legal-moves");
      }
      // Captures first so hands fill up, otherwise a seeded pick; never a pass, so the game keeps going.
      const playable = botMoves.filter((move) => move.kind !== "pass");
      const captures = playable.filter((move) => move.kind !== "drop" && state.board[move.to.row][move.to.col].piece);
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const pool = captures.length ? captures : playable;
      if (!pool.length) break;
      state = applyMove(state, pool[seed % pool.length]);
    }
    if (getVariant(variantKey).supportsDrops) expect(dropsSeen).toBeGreaterThan(0);
  }, 60_000);

  test("a full hand returns a legal move without scoring every drop after time expires", () => {
    const state = createInitialState("shogi", "bot-drops-full-hand");
    for (const [row, col] of [[6, 2], [6, 6], [2, 3], [2, 5], [0, 2], [8, 6]]) state.board[row][col].piece = null;
    state.hands = { sente: { r: 1, b: 1, s: 1, n: 1, p: 2 }, gote: { s: 1, l: 1, p: 1, n: 1 } };
    const legalMoves = allLegalMoves(state);
    expect(legalMoves.filter((move) => move.kind === "drop").length).toBeGreaterThan(100);

    const result = chooseBotMoveSafe(state, "normal", { engine: "internal", maxSearchTimeMs: 8 });
    expect(result.reason).toBe("ok");
    if (!result.move) throw new Error("Expected a legal bot move.");
    expect(result.nodesSearched).toBeLessThanOrEqual(legalMoves.length);
    expect(findLegalMove(state, asRequest(result.move))).not.toBeNull();
  }, 30_000);
});
