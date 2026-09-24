import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cameraPositions, collectionPieces, get3DCollection } from "@/components/board/board-3d-config";
import { createInitialState, variantCatalog } from "@/lib/variants";

describe("playable 3D collections", () => {
  test("every advertised board has matching native models for its initial pieces", () => {
    for (const variant of variantCatalog) {
      const collection = get3DCollection(variant.key);
      if (!collection) continue;
      expect(variant.board).toMatchObject({ rows: 8, cols: 8 });
      for (const cell of createInitialState(variant.key).board.flat()) {
        if (cell.piece) expect(collectionPieces[collection][cell.piece.code], `${variant.key}: ${cell.piece.code}`).toBeTruthy();
      }
    }
    for (const regional of ["shatranj", "chaturanga", "makruk", "xiangqi", "shogi", "janggi"]) expect(get3DCollection(regional)).toBeNull();
  });

  for (const collection of ["classic", "khmer"] as const) {
    test(`${collection} GLB has complete named pieces at playable scale without external dependencies`, async () => {
      const bytes = readFileSync(`public/assets/${collection}/collection.glb`);
      expect(bytes.length).toBeLessThan(1_000_000);
      const length = bytes.readUInt32LE(12);
      const json = JSON.parse(bytes.subarray(20, 20+length).toString("utf8"));
      expect((json.buffers ?? []).some((buffer: { uri?: string }) => Boolean(buffer.uri))).toBe(false);
      expect((json.images ?? []).some((image: { uri?: string }) => Boolean(image.uri))).toBe(false);
      const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "");
      for (const side of ["light", "dark"]) {
        for (const name of Object.values(collectionPieces[collection])) {
          const root = gltf.scene.getObjectByName(`${side}_${name}`);
          expect(root, `${side}_${name}`).toBeDefined();
          root!.position.set(0,0,0); root!.updateWorldMatrix(true, true);
          const box = new Box3().setFromObject(root!);
          const size = box.getSize(new Vector3());
          expect(size.x).toBeGreaterThan(.01); expect(size.x).toBeLessThan(.053);
          expect(size.z).toBeGreaterThan(.01); expect(size.z).toBeLessThan(.053);
          expect(size.y).toBeGreaterThan(.009); expect(size.y).toBeLessThan(.075);
          expect(Math.abs(box.min.y)).toBeLessThan(.003);
        }
      }
    });
  }

  test("default cameras keep the board frame and tallest edge pieces inside the viewport", () => {
    for (const position of Object.values(cameraPositions)) {
      const camera = new PerspectiveCamera(42, 1, .01, 10);
      camera.position.set(...position); camera.lookAt(0, .01, 0); camera.updateMatrixWorld();
      for (const x of [-.23,.23]) for (const z of [-.23,.23]) {
        const projected = new Vector3(x,0,z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
      }
      for (const x of [-.195,.195]) for (const z of [-.195,.195]) {
        const projected = new Vector3(x,.065,z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
      }
    }
  });
});
