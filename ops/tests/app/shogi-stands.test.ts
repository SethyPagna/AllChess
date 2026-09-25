import { describe, expect, test } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { shogiHandSlots, shogiStands, shogiStandTop } from "@/components/board/shogi-stands";
import { board3DLayout } from "@/components/board/board-3d-config";

import { tabletopFrame } from "@/components/board/tabletop-camera";

describe("physical Shogi hands", () => {
  for (const size of [5, 9]) {
    const layout = board3DLayout("shogi", size, size);
    test(`${size}×${size} stands clear the board and fit the default camera`, () => {
      const frame=tabletopFrame("shogi",size,size,640);
      const camera = new PerspectiveCamera(frame.fieldOfView, frame.aspect, .01, 10);
      camera.position.copy(frame.position);
      camera.lookAt(frame.target); camera.updateMatrixWorld();
      for (const stand of shogiStands(layout.width, layout.depth)) {
        expect(Math.abs(stand.x) - stand.size / 2).toBeGreaterThan(layout.width / 2 + .033);
        for (const dx of [-stand.size / 2, stand.size / 2]) for (const dz of [-stand.size / 2, stand.size / 2]) for (const y of [-.091, .042]) {
          const point = new Vector3(stand.x + dx, y, stand.z + dz).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(.96);
          expect(Math.abs(point.y)).toBeLessThan(.94);
        }
      }
    });

    test(`${size}×${size} full hands retain exact counts and ownership through a flip`, () => {
      const hands = { sente: { r: 2, b: 2, g: 4, s: 4, n: 4, l: 4, p: 18 }, gote: { p: 1, k: 0 } };
      const normal = shogiHandSlots(layout.width, layout.depth, hands, false);
      const flipped = shogiHandSlots(layout.width, layout.depth, hands, true);
      expect(normal).toHaveLength(8);
      for (const slot of normal) {
        const reversed = flipped.find(other => other.owner === slot.owner && other.code === slot.code)!;
        expect(reversed.count).toBe(slot.count);
        expect(reversed.x).toBeCloseTo(-slot.x);
        expect(reversed.z).toBeCloseTo(-slot.z);
        expect(reversed.rotation).not.toBe(slot.rotation);
        const stand = shogiStands(layout.width, layout.depth).find(item => item.near === slot.near)!;
        expect(Math.abs(slot.x - stand.x) + .025).toBeLessThan(stand.size / 2);
        expect(Math.abs(slot.z - stand.z) + .025).toBeLessThan(stand.size / 2);
      }
      expect(normal.find(slot => slot.owner === "sente" && slot.code === "p")?.count).toBe(18);
      expect(normal.filter(slot => slot.owner === "sente").every(slot => slot.near)).toBe(true);
      expect(shogiStandTop).toBe(.002);
    });
  }
  test("empty hands and exhausted pieces leave empty stands", () => {
    expect(shogiHandSlots(.477, .513, undefined, false)).toEqual([]);
    expect(shogiHandSlots(.477, .513, { sente: { p: 0 }, gote: {} }, false)).toEqual([]);
  });
});
