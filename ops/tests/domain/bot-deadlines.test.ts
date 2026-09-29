import { afterEach, expect, test, vi } from "vitest";

import { chooseBotMoveSafe } from "@/lib/bot/runtime";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, type GameState, type Move } from "@/lib/variants";

const deadline = vi.hoisted(() => ({
  now: 0,
  root: null as GameState | null,
  triggers: 0,
  promotedCode: null as string | null
}));

vi.mock("@/lib/variants", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@/lib/variants")>();
  return {
    ...engine,
    applyMove(state: GameState, move: Move) {
      const next = engine.applyMove(state, move);
      if (state === deadline.root && move.from.row === 1 && move.from.col === 1
        && move.to.row === 0 && move.to.col === 1 && move.promoteTo === "q") {
        deadline.triggers += 1;
        deadline.promotedCode = next.board[0][1].piece?.code ?? null;
        deadline.now = 200;
      }
      return next;
    }
  };
});

function winningReplies(state: GameState) {
  return state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square))).filter((move) => {
    const next = applyMove(state, move);
    return next.status === "completed" && next.result === "black";
  });
}

afterEach(() => {
  deadline.root = null;
  vi.restoreAllMocks();
});

test("a deadline after applying a queen promotion preserves a move that avoids mate in one", () => {
  const state = createInitialState("classic", "bot-search-safety");
  const rows = ["........", ".P.....k", "........", "........", "...r....", "........", ".....PPP", "......K."];
  for (const [row, cells] of state.board.entries()) {
    for (const [col, cell] of cells.entries()) {
      const token = rows[row][col];
      const owner = token === token.toUpperCase() ? "white" : "black";
      cell.piece = token === "." ? null : { id: `${owner}-${token}-${row}-${col}`, code: token.toLowerCase(), owner, labelKey: "chess.pawn" };
    }
  }

  const safeAlternative = findLegalMove(state, { from: { row: 6, col: 7 }, to: { row: 5, col: 7 } });
  expect(safeAlternative).not.toBeNull();
  expect(winningReplies(applyMove(state, safeAlternative!))).toEqual([]);
  const promotion = findLegalMove(state, { from: { row: 1, col: 1 }, to: { row: 0, col: 1 }, promoteTo: "q" });
  expect(promotion).not.toBeNull();
  expect(winningReplies(applyMove(state, promotion!))).toContainEqual(expect.objectContaining({ from: { row: 4, col: 3 }, to: { row: 7, col: 3 } }));

  deadline.now = 0;
  deadline.triggers = 0;
  deadline.promotedCode = null;
  deadline.root = state;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => deadline.now);
  let result: ReturnType<typeof chooseBotMoveSafe> | undefined;
  try {
    result = chooseBotMoveSafe(state, "grandmaster", { engine: "internal", maxSearchTimeMs: 200 });
  } finally {
    deadline.root = null;
    clock.mockRestore();
  }

  expect(deadline.triggers).toBe(1);
  expect(deadline.promotedCode).toBe("q");
  expect(deadline.now).toBe(200);
  expect(result?.reason).toBe("ok");
  if (!result?.move) throw new Error("Expected a legal move after the promotion deadline.");
  expect(findLegalMove(state, result.move)).not.toBeNull();
  expect(winningReplies(applyMove(state, result.move))).toEqual([]);
});
