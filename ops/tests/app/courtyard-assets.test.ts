import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Box3, Mesh, Raycaster, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, test } from "vitest";
import { collectionPieces } from "@/components/board/board-3d-config";
import { tabletopPieceTop } from "@/components/board/tabletop-camera";

test("Courtyard contains twelve portable textured native pieces with physical carving and safe bounds", async () => {
  const bytes = readFileSync("public/assets/khmer/courtyard.glb");
  expect(bytes.length).toBeLessThan(7_000_000);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  expect(json.images.length).toBeGreaterThanOrEqual(6);
  for (const resource of [...json.images, ...json.buffers]) expect(resource.uri).toBeUndefined();
  for (const material of json.materials) {
    expect(material.normalTexture).toBeDefined();
    expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
  }
  // Geometry is parsed normally; this Node environment lacks a browser image decoder.
  const loader = new GLTFLoader().register(() => ({ name: "NODE_TEXTURE_CHECK", loadTexture: () => Promise.resolve(new Texture()) }));
  const model = await loader.parseAsync(Uint8Array.from(bytes).buffer, "");
  const heights: Record<string, number> = { Khon_king: .074, Neang_queen: .054, Koul_bishop: .046, Ses_horse: .062, Touk_boat: .034, Trey_fish: .010 };
  expect(model.scene.children.map(root => root.name).sort()).toEqual(
    ["light", "dark"].flatMap(side => Object.values(collectionPieces.khmer).map(role => `${side}_${role}`)).sort()
  );
  for (const side of ["light", "dark"]) for (const role of Object.values(collectionPieces.khmer)) {
    const root = model.scene.getObjectByName(`${side}_${role}`)!;
    root.position.set(0, 0, 0); root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root, true), size = box.getSize(new Vector3());
    expect(size.y, role).toBeCloseTo(heights[role], 3);
    expect(size.x).toBeGreaterThan(.02); expect(size.x).toBeLessThan(.04);
    expect(size.z).toBeGreaterThan(.02); expect(size.z).toBeLessThan(role === "Ses_horse" ? .046 : .04);
    expect(Math.abs(box.min.y)).toBeLessThan(.001);
    expect(box.max.y + .003).toBeLessThan(tabletopPieceTop.khmer);
    let triangles = 0;
    root.traverse(child => {
      if (!(child instanceof Mesh)) return;
      expect(child.geometry.attributes.uv).toBeDefined();
      triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
    });
    expect(triangles).toBeGreaterThan(500); expect(triangles).toBeLessThan(25_000);
    if (role === "Touk_boat" || role === "Trey_fish") {
      const ray = new Raycaster(new Vector3(0, .1, 0), new Vector3(0, -1, 0));
      const hits = ray.intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      // The visible centre really sits below the surrounding rim, not a painted flat top.
      expect(box.max.y - hits[0].point.y).toBeGreaterThan(role === "Touk_boat" ? .004 : .0003);
    }
  }
});

test("Courtyard masters and runtime sprites preserve real transparency for every role and side", async () => {
  const prompts = JSON.parse(readFileSync("ops/assets/khmer/courtyard/prompts.json", "utf8"));
  expect(prompts.provider).toBe("built-in image_gen");
  expect(prompts.assets).toHaveLength(12);
  for (const side of ["light", "dark"]) for (const role of ["king", "queen", "bishop", "horse", "rook", "pawn"]) {
    const name = `${side}-${role}`;
    for (const [file, runtime] of [[`ops/assets/khmer/courtyard/${name}.png`, false], [`public/assets/khmer/courtyard/${name}.webp`, true]] as const) {
      const source = sharp(file), metadata = await source.metadata(), stats = await source.stats();
      if (runtime) { expect(metadata.width).toBe(512); expect(metadata.height).toBe(512); }
      else { expect(metadata.width).toBeGreaterThanOrEqual(1024); expect(metadata.height).toBeGreaterThanOrEqual(1024); }
      expect(metadata.hasAlpha).toBe(true); expect(stats.isOpaque).toBe(false);
      const alpha = stats.channels.at(-1)!;
      expect(alpha.min).toBe(0); expect(alpha.max).toBe(255);
      expect(alpha.mean).toBeGreaterThan(15); expect(alpha.mean).toBeLessThan(210);
    }
    expect(prompts.assets.find((asset: { file: string }) => asset.file === `${name}.png`)?.prompt).toBeTruthy();
  }
});
