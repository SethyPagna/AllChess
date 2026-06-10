import { describe, expect, test } from "vitest";

import { getDragImageOffset } from "@/components/board/drag-preview";

describe("drag preview", () => {
  test("keeps the grabbed point under the cursor when preview size changes", () => {
    const offset = getDragImageOffset({
      clientX: 140,
      clientY: 188,
      height: 50,
      pieceRect: { left: 100, top: 160, width: 80, height: 70 },
      width: 60
    });

    expect(offset.x).toBeCloseTo(30);
    expect(offset.y).toBeCloseTo(20);
  });

  test("clamps native drag image offsets to the preview bounds", () => {
    expect(
      getDragImageOffset({
        clientX: 20,
        clientY: 240,
        height: 50,
        pieceRect: { left: 100, top: 160, width: 80, height: 70 },
        width: 60
      })
    ).toEqual({ x: 0, y: 50 });
  });

  test("falls back to center when browser drag coordinates are unusable", () => {
    expect(
      getDragImageOffset({
        clientX: Number.NaN,
        clientY: Number.NaN,
        height: 50,
        pieceRect: { left: 0, top: 0, width: 0, height: 0 },
        width: 60
      })
    ).toEqual({ x: 30, y: 25 });
  });
});
