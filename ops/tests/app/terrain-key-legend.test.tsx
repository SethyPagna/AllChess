import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TerrainKeyLegend } from "@/components/board/game-board";

describe("TerrainKeyLegend", () => {
  test("renders compact terrain swatches when terrain exists", () => {
    const markup = renderToStaticMarkup(<TerrainKeyLegend terrainKeys={["palace", "river", "den", "trap"]} />);

    expect(markup).toContain('aria-label="Board terrain key"');
    expect(markup).toContain('data-terrain="palace"');
    expect(markup).toContain("Palace");
    expect(markup).toContain("River");
    expect(markup).toContain("Den");
    expect(markup).toContain("Trap");
  });

  test("stays absent for boards without special terrain", () => {
    const markup = renderToStaticMarkup(<TerrainKeyLegend terrainKeys={[]} />);

    expect(markup).toBe("");
  });
});
