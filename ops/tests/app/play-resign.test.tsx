import { describe, expect, test } from "vitest";

import { resignationResult } from "@/components/board/game-board-utils";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

describe("resignationResult", () => {
  test("resigning while the bot is thinking gives the win to the bot", () => {
    const start = createInitialState("classic");
    const e4 = getLegalMoves(start, { row: 6, col: 4 }).find((move) => move.to.row === 4 && move.to.col === 4)!;
    const botToMove = applyMove(start, e4);

    expect(botToMove.turn).toBe("black");
    expect(resignationResult(botToMove, "white", true)).toBe("black");
  });

  test("the human playing Black against a bot that moves first still loses on resign", () => {
    expect(resignationResult(createInitialState("classic"), "black", true)).toBe("white");
  });

  test("without a bot opponent the side to move resigns", () => {
    const start = createInitialState("xiangqi");

    expect(resignationResult(start, "red", false)).toBe("black");
    expect(resignationResult({ ...start, turn: "black" }, "red", false)).toBe("red");
  });
});
