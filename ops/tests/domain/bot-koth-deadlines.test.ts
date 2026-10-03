import { afterEach, expect, test, vi } from "vitest";

import { chooseBotMoveSafe } from "@/lib/bot/runtime";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, type GameState, type Move } from "@/lib/variants";

const boundary = vi.hoisted(() => ({
  mode: "first-root" as "first-root" | "defense-prefix",
  now: 0,
  root: null as GameState | null,
  defenseSuccessor: null as GameState | null,
  rootMoves: [] as Move[],
  quickBoundaryHits: 0,
  replyBoundaryHits: 0
}));

vi.mock("@/lib/variants", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@/lib/variants")>();
  return {
    ...engine,
    applyMove(state: GameState, move: Move) {
      const next = engine.applyMove(state, move);
      if (state === boundary.root) {
        boundary.rootMoves.push(move);
        const firstRoot = boundary.mode === "first-root" && boundary.rootMoves.length === 1;
        const defenseRoot = boundary.mode === "defense-prefix" && boundary.defenseSuccessor === null
          && move.from.row === 7 && move.from.col === 4 && move.to.row === 4 && move.to.col === 4;
        if (firstRoot || defenseRoot) {
          boundary.quickBoundaryHits += 1;
          boundary.now = Math.max(boundary.now, 29);
          if (defenseRoot) boundary.defenseSuccessor = next;
        }
      } else if (boundary.mode === "defense-prefix" && state === boundary.defenseSuccessor
        && next.status === "completed" && next.result === "black" && next.outcomeReason === "objective") {
        boundary.replyBoundaryHits += 1;
        boundary.now = 80;
      }
      return next;
    }
  };
});

function terminalWins(state: GameState) {
  return state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square))).filter((move) => {
    const next = applyMove(state, move);
    return next.status === "completed" && next.result === "black";
  });
}

function hillThreatFixture(withKnight = false) {
  const state = createInitialState("king-of-the-hill", "block-hill-threat");
  for (const row of state.board) for (const cell of row) cell.piece = null;
  state.turn = "white";
  state.board[4][2].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
  state.board[7][4].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
  state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
  if (withKnight) state.board[0][7].piece = { id: "white-knight", code: "n", owner: "white", labelKey: "chess.knight" };

  const initialWins = terminalWins({ ...state, turn: "black" });
  expect(initialWins).toHaveLength(2);
  expect(initialWins).toEqual(expect.arrayContaining([
    expect.objectContaining({ from: { row: 4, col: 2 }, to: { row: 4, col: 3 } }),
    expect.objectContaining({ from: { row: 4, col: 2 }, to: { row: 3, col: 3 } })
  ]));

  const quiet = findLegalMove(state, { from: { row: 7, col: 4 }, to: { row: 6, col: 4 } });
  const defense = findLegalMove(state, { from: { row: 7, col: 4 }, to: { row: 4, col: 4 } });
  expect(quiet).not.toBeNull();
  expect(defense).not.toBeNull();
  expect(terminalWins(applyMove(state, quiet!))).toHaveLength(2);
  const defendedState = applyMove(state, defense!);
  const remainingWins = terminalWins(defendedState);
  expect(remainingWins).toHaveLength(1);
  expect(remainingWins[0]).toMatchObject({ from: { row: 4, col: 2 }, to: { row: 3, col: 3 } });
  expect(applyMove(defendedState, remainingWins[0])).toMatchObject({ status: "completed", result: "black", outcomeReason: "objective" });
  if (withKnight) {
    const knightMoves = getLegalMoves(state, { row: 0, col: 7 });
    expect(knightMoves).toHaveLength(2);
    for (const move of knightMoves) expect(terminalWins(applyMove(state, move))).toHaveLength(2);
  }
  return { state, initialWins };
}

function chooseAtBoundary(state: GameState, mode: typeof boundary.mode) {
  boundary.mode = mode;
  boundary.now = 0;
  boundary.root = state;
  boundary.defenseSuccessor = null;
  boundary.rootMoves = [];
  boundary.quickBoundaryHits = 0;
  boundary.replyBoundaryHits = 0;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => boundary.now);
  try {
    const result = chooseBotMoveSafe(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });
    return {
      result,
      evidence: {
        rootMoves: boundary.rootMoves,
        quickBoundaryHits: boundary.quickBoundaryHits,
        replyBoundaryHits: boundary.replyBoundaryHits,
        elapsedMs: boundary.now,
        selectedMove: result.move
      }
    };
  } finally {
    boundary.root = null;
    boundary.defenseSuccessor = null;
    clock.mockRestore();
  }
}

afterEach(() => {
  boundary.root = null;
  boundary.defenseSuccessor = null;
  vi.restoreAllMocks();
});

test("KOTH reduces immediate wins when its quick window ends after the first root move", () => {
  const { state, initialWins } = hillThreatFixture();
  const { result, evidence } = chooseAtBoundary(state, "first-root");
  const diagnostic = JSON.stringify(evidence);
  expect(evidence.quickBoundaryHits, diagnostic).toBe(1);
  expect(evidence.elapsedMs, diagnostic).toBe(29);
  expect(result.reason, diagnostic).toBe("ok");
  if (!result.move) throw new Error(`Expected a legal KOTH move: ${diagnostic}`);
  expect(findLegalMove(state, result.move), diagnostic).not.toBeNull();
  expect(terminalWins(applyMove(state, result.move)).length, diagnostic).toBeLessThan(initialWins.length);
});

test("KOTH retains a reducing defense when reply verification can exhaust the deadline", () => {
  const { state, initialWins } = hillThreatFixture(true);
  const { result, evidence } = chooseAtBoundary(state, "defense-prefix");
  const diagnostic = JSON.stringify(evidence);
  expect(evidence.quickBoundaryHits, diagnostic).toBe(1);
  expect(evidence.elapsedMs, diagnostic).toBeGreaterThanOrEqual(29);
  expect(result.reason, diagnostic).toBe("ok");
  if (!result.move) throw new Error(`Expected a legal KOTH move: ${diagnostic}`);
  expect(findLegalMove(state, result.move), diagnostic).not.toBeNull();
  expect(terminalWins(applyMove(state, result.move)).length, diagnostic).toBeLessThan(initialWins.length);
});
