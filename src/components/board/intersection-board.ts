export type IntersectionLine = { from: readonly [number, number]; to: readonly [number, number]; kind: "grid" | "palace" | "registration" };

/** Row/column coordinates describe real intersections, not square boundaries. */
export function intersectionBoardLines(variant: "xiangqi" | "janggi"): IntersectionLine[] {
  const lines: IntersectionLine[] = [];
  const line = (from: readonly [number, number], to: readonly [number, number], kind: IntersectionLine["kind"] = "grid") => lines.push({ from, to, kind });
  for (let row = 0; row < 10; row++) line([row, 0], [row, 8]);
  for (let col = 0; col < 9; col++) {
    if (variant === "xiangqi" && col > 0 && col < 8) { line([0, col], [4, col]); line([5, col], [9, col]); }
    else line([0, col], [9, col]);
  }
  for (const row of [0, 7]) { line([row, 3], [row + 2, 5], "palace"); line([row, 5], [row + 2, 3], "palace"); }
  if (variant === "xiangqi") {
    const marks = [[2, 1], [2, 7], [7, 1], [7, 7], ...[3, 6].flatMap(row => [0, 2, 4, 6, 8].map(col => [row, col]))];
    for (const [row, col] of marks) for (const dr of [-1, 1]) for (const dc of [-1, 1]) {
      if (col + dc < 0 || col + dc > 8) continue;
      line([row + dr * .09, col + dc * .09], [row + dr * .09, col + dc * .22], "registration");
      line([row + dr * .09, col + dc * .09], [row + dr * .22, col + dc * .09], "registration");
    }
  }
  return lines;
}
