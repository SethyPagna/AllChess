import { expect, test } from "vitest";
import { intersectionBoardLines } from "@/components/board/intersection-board";

test("Xiangqi opens the river only between its seven internal files", () => {
  const grid = intersectionBoardLines("xiangqi").filter(line => line.kind === "grid");
  expect(grid.filter(line => line.from[0] === line.to[0])).toHaveLength(10);
  for (let col = 0; col < 9; col++) {
    const vertical = grid.filter(line => line.from[1] === col && line.to[1] === col);
    expect(vertical.map(line => [line.from[0], line.to[0]])).toEqual(col === 0 || col === 8 ? [[0, 9]] : [[0, 4], [5, 9]]);
  }
});

test("Janggi has nine uninterrupted files and both native palace crosses", () => {
  const lines = intersectionBoardLines("janggi");
  expect(lines.filter(line => line.kind === "grid" && line.from[1] === line.to[1])).toHaveLength(9);
  expect(lines.filter(line => line.kind === "palace").map(({ from, to }) => [from, to])).toEqual([
    [[0, 3], [2, 5]], [[0, 5], [2, 3]], [[7, 3], [9, 5]], [[7, 5], [9, 3]]
  ]);
  expect(lines.some(line => line.kind === "registration")).toBe(false);
  for (const { from, to } of intersectionBoardLines("xiangqi")) for (const [row, col] of [from, to]) {
    expect(row).toBeGreaterThanOrEqual(0); expect(row).toBeLessThanOrEqual(9);
    expect(col).toBeGreaterThanOrEqual(0); expect(col).toBeLessThanOrEqual(8);
  }
});
