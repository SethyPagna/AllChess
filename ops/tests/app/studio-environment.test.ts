import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DataUtils, HalfFloatType, LinearSRGBColorSpace } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { expect, test } from "vitest";

const bytes = readFileSync("public/assets/materials/studio-room.hdr");
const source = JSON.parse(readFileSync("ops/assets/materials/studio-room-source.json", "utf8")) as {
  bytes: number;
  sha256: string;
  probes: { x: number; y: number; originalRGB: number[] }[];
};
const atlas = new HDRLoader().parse(Uint8Array.from(bytes).buffer);
const pixels = atlas.data;
if (!(pixels instanceof Uint16Array)) throw new Error("The studio atlas must decode into half-float pixels.");

test("the studio HDR decodes as a compact, linear CubeUV atlas", () => {
  expect(bytes.length).toBe(source.bytes);
  expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  expect(atlas.width).toBe(768);
  expect(atlas.height).toBe(1024);
  expect(pixels.length).toBe(768 * 1024 * 4);
  expect(atlas.type).toBe(HalfFloatType);
  expect(atlas.colorSpace).toBe(LinearSRGBColorSpace);
  expect(atlas.flipY).toBe(true);
  expect(atlas.generateMipmaps).toBe(false);

  let valid = true, peak = 0;
  for (let index = 0; index < pixels.length; index++) {
    if (index % 4 === 3) continue;
    const value = DataUtils.fromHalfFloat(pixels[index]);
    valid &&= Number.isFinite(value) && value >= 0;
    peak = Math.max(peak, value);
  }
  expect(valid).toBe(true);
  expect(peak).toBeGreaterThan(30);
  expect(peak).toBeLessThan(50);
});

test("atlas face and roughness samples retain the original studio radiance", () => {
  expect(source.probes).toHaveLength(24);
  for (const { x, y, originalRGB } of source.probes) {
    const peak = Math.max(...originalRGB);
    const quantum = peak > 0 ? 2 ** (Math.floor(Math.log2(peak)) + 1) / 255 : 0;
    for (let channel = 0; channel < 3; channel++) {
      const decoded = DataUtils.fromHalfFloat(pixels[(y * 768 + x) * 4 + channel]);
      const tolerance = quantum + Math.abs(decoded) / 1024 + 2 ** -24;
      expect(Math.abs(decoded - originalRGB[channel]), `radiance at ${x},${y},${channel}`).toBeLessThanOrEqual(tolerance);
    }
  }
});
