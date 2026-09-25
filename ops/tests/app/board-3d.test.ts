import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { Box3, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { tabletopCameraPosition, tabletopCameraTarget, tabletopAspect, tabletopFieldOfView, collectionPieces, get3DCollection, board3DLayout, pieceModelName, shogiPromotedCodes } from "@/components/board/board-3d-config";
import { createInitialState, variantCatalog } from "@/lib/variants";

describe("playable 3D collections", () => {
  test("every advertised board has matching native models for its initial pieces", () => {
    for (const variant of variantCatalog) {
      const collection = get3DCollection(variant.key);
      if (!collection) continue;
      expect(variant.board).toMatchObject(collection === "shogi" ? { rows: variant.key === "mini-shogi" ? 5 : 9, cols: variant.key === "mini-shogi" ? 5 : 9 } : collection === "xiangqi" || collection === "janggi" ? { rows: 10, cols: 9 } : { rows: 8, cols: 8 });
      for (const cell of createInitialState(variant.key).board.flat()) {
        if (cell.piece) expect(collectionPieces[collection][cell.piece.code], `${variant.key}: ${cell.piece.code}`).toBeTruthy();
      }
    }
    for (const regional of ["shatranj", "chaturanga"]) expect(get3DCollection(regional)).toBeNull();
  });

  for (const collection of ["classic", "khmer", "shogi", "xiangqi", "janggi", "makruk"] as const) {
    test(`${collection} GLB has complete named pieces at playable scale without external dependencies`, async () => {
      const bytes = readFileSync(`public/assets/${collection}/collection.glb`);
      expect(bytes.length).toBeLessThan(1_000_000);
      const length = bytes.readUInt32LE(12);
      const json = JSON.parse(bytes.subarray(20, 20+length).toString("utf8"));
      expect((json.buffers ?? []).some((buffer: { uri?: string }) => Boolean(buffer.uri))).toBe(false);
      expect((json.images ?? []).some((image: { uri?: string }) => Boolean(image.uri))).toBe(false);
      const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "");
      for (const side of ["light", "dark"]) {
        for (const name of [...Object.values(collectionPieces[collection]), ...(collection === "shogi" ? [...shogiPromotedCodes].map(code => `promoted_${collectionPieces.shogi[code]}`) : collection === "makruk" ? ["promoted_bia"] : [])]) {
          const root = gltf.scene.getObjectByName(`${side}_${name}`);
          expect(root, `${side}_${name}`).toBeDefined();
          root!.position.set(0,0,0); root!.updateWorldMatrix(true, true);
          const box = new Box3().setFromObject(root!, true);
          const size = box.getSize(new Vector3());
          expect(size.x).toBeGreaterThan(.01); expect(size.x).toBeLessThan(.053);
          expect(size.z).toBeGreaterThan(.01); expect(size.z).toBeLessThan(.053);
          expect(size.y).toBeGreaterThan(.009); expect(size.y).toBeLessThan(.075);
          expect(Math.abs(box.min.y)).toBeLessThan(.003);
          if (collection === "shogi") {
            const inks: MeshStandardMaterial[] = [];
            root!.traverse(child => { if (child instanceof Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) if (/ink/i.test(material.name)) inks.push(material); });
            expect(inks).toHaveLength(1);
            expect(inks[0].roughness).toBeGreaterThanOrEqual(.9);
            if (name.startsWith("promoted_")) expect(inks[0].color.r).toBeGreaterThan(inks[0].color.g * 5);
            else expect(Math.max(inks[0].color.r, inks[0].color.g, inks[0].color.b)).toBeLessThan(.02);
          }
        }
      }
    });
  }

  test("Shogi promoted faces and ownership resolve to distinct portable models", () => {
    for (const code of shogiPromotedCodes) {
      expect(pieceModelName("shogi", code, true, true)).toBe(`light_promoted_${collectionPieces.shogi[code]}`);
      expect(pieceModelName("shogi", code, false, true)).toBe(`dark_promoted_${collectionPieces.shogi[code]}`);
      expect(pieceModelName("shogi", code, true)).not.toBe(pieceModelName("shogi", code, true, true));
    }
    expect(pieceModelName("shogi", "k", false)).toBe("dark_king");
  });

  test("Makruk promotion selects the turned Bia instead of an original Met", () => {
    expect(pieceModelName("makruk", "m", true, true)).toBe("light_promoted_bia");
    expect(pieceModelName("makruk", "m", false, true)).toBe("dark_promoted_bia");
    expect(pieceModelName("makruk", "m", true)).toBe("light_met");
    expect(pieceModelName("makruk", "p", true)).toBe("light_bia");
  });

  test.each(["classic", "ouk-chaktrang", "shogi", "mini-shogi", "xiangqi", "janggi", "makruk"])("%s angled camera contains its physical board and edge pieces", key => {
    const variant = variantCatalog.find(variant => variant.key === key)!;
    const collection = get3DCollection(key)!;
    const layout = board3DLayout(collection, variant.board.rows, variant.board.cols);
    const camera = new PerspectiveCamera(tabletopFieldOfView, tabletopAspect, .01, 10);
    camera.position.set(...tabletopCameraPosition).multiplyScalar(layout.cameraScale); camera.lookAt(...tabletopCameraTarget); camera.updateMatrixWorld();
    for (const x of [-layout.width/2-.033,layout.width/2+.033]) for (const z of [-layout.depth/2-.033,layout.depth/2+.033]) {
      const projected = new Vector3(x,collection === "shogi" ? -.091 : -.049,z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
    }
    for (const x of [-layout.width/2+.017,layout.width/2-.017]) for (const z of [-layout.depth/2+.017,layout.depth/2-.017]) {
      const projected = new Vector3(x,collection === "shogi" ? .013 : .065,z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
    }
  });
});
