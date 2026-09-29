import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { Box3, CubeUVReflectionMapping, DataTexture, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, RepeatWrapping, Scene, Texture, TextureLoader, Vector2, Vector3, type WebGLRenderer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { collectionModelPath, collectionPieces, get3DCollection, board3DLayout, pieceModelName, shogiPromotedCodes } from "@/components/board/board-3d-config";
import { createKonaneCellGeometry } from "@/components/board/konane-board";
import { tabletopFrame, tabletopPieceTop } from "@/components/board/tabletop-camera";
import { shogiStandTop } from "@/components/board/shogi-stands";
import { createJungleTerrainKit } from "@/components/board/jungle-board";
import { createTabletopScene } from "@/components/board/tabletop-scene";
import { createInitialState, variantCatalog } from "@/lib/variants";

describe("playable 3D collections", () => {
  test("every advertised board has matching native models for its initial pieces", () => {
    for (const variant of variantCatalog) {
      const collection = get3DCollection(variant.key);
      if (!collection) continue;
      expect(variant.board).toMatchObject(variant.key === "international-draughts" ? { rows: 10, cols: 10 } : collection === "jungle" ? { rows: 9, cols: 7 } : collection === "shogi" ? { rows: variant.key === "mini-shogi" ? 5 : 9, cols: variant.key === "mini-shogi" ? 5 : 9 } : collection === "xiangqi" || collection === "janggi" ? { rows: 10, cols: 9 } : { rows: 8, cols: 8 });
      for (const cell of createInitialState(variant.key).board.flat()) {
        if (cell.piece) expect(collectionPieces[collection][cell.piece.code], `${variant.key}: ${cell.piece.code}`).toBeTruthy();
      }
    }
    expect(variantCatalog.every(variant => get3DCollection(variant.key))).toBe(true);
  });

  for (const collection of ["classic", "khmer", "shogi", "xiangqi", "janggi", "makruk", "draughts", "konane", "shatranj", "chaturanga", "jungle"] as const) {
    test(`${collection} GLB has complete named pieces at playable scale without external dependencies`, async () => {
      const bytes = readFileSync(`public${collectionModelPath(collection)}`);
      expect(bytes.length).toBeLessThan(collection === "classic" ? 16_000_000 : collection === "khmer" ? 10_000_000 : 1_000_000);
      const length = bytes.readUInt32LE(12);
      const json = JSON.parse(bytes.subarray(20, 20+length).toString("utf8"));
      expect((json.buffers ?? []).some((buffer: { uri?: string }) => Boolean(buffer.uri))).toBe(false);
      expect((json.images ?? []).some((image: { uri?: string }) => Boolean(image.uri))).toBe(false);
      if (collection === "classic") {
        expect(json.images.length).toBeGreaterThanOrEqual(6);
        for (const material of json.materials) {
          expect(material.normalTexture).toBeDefined();
          expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
          expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
        }
      }
      if (collection === "khmer") {
        expect(json.images.length).toBeGreaterThanOrEqual(5);
        const woods = json.materials.filter((material: {name: string}) => /boxwood|rosewood/.test(material.name));
        expect(woods).toHaveLength(4);
        for (const material of woods) {
          expect(material.normalTexture).toBeDefined();
          expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
          expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
        }
      }
      // Node has no image decoder. Validate the embedded maps above; parse actual geometry below.
      const loader = new GLTFLoader().register(()=>({name:"NODE_TEXTURE_CHECK",loadTexture:()=>Promise.resolve(new Texture())}));
      const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, "");
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
          const placedTop=box.max.y+(collection==="konane"?-.006:.002);
          expect(tabletopPieceTop[collection], `${collection} ${name} camera clearance`).toBeGreaterThan(placedTop+.001);
          if (collection === "khmer") {
            let triangles = 0;
            root!.traverse(child => { if (child instanceof Mesh) {
              expect(child.geometry.attributes.uv).toBeDefined();
              triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
            } });
            expect(triangles).toBeLessThan(25_000);
            expect(Math.max(...tabletopFrame(collection, 8, 8, 288).bounds.map(point => point.y))).toBeGreaterThan(size.y + .002);
          }
          if (collection === "draughts") {
            expect(size.y).toBeCloseTo(name === "king" ? .022 : .011, 4);
            expect(root!.children.filter(child => /counter/.test(child.name))).toHaveLength(name === "king" ? 2 : 1);
            expect(size.x).toBeCloseTo(.042, 4);
          }
          if (collection === "shogi") {
            const selectedStackTop=box.max.y+shogiStandTop+2*.012+.004;
            for(const width of [296,692]) {
              const bounds=tabletopFrame("shogi",9,9,width).bounds;
              expect(Math.max(...bounds.map(point=>point.y)), `${side}_${name} captured stack clearance`).toBeGreaterThan(selectedStackTop+.001);
            }
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

  test.each(["classic", "ouk-chaktrang", "shogi", "mini-shogi", "xiangqi", "janggi", "makruk", "english-draughts", "international-draughts", "turkish-draughts", "konane", "shatranj", "chaturanga", "jungle"])("%s angled camera contains its physical board and edge pieces", key => {
    const variant = variantCatalog.find(variant => variant.key === key)!;
    const collection = get3DCollection(key)!;
    const layout = board3DLayout(collection, variant.board.rows, variant.board.cols);
    const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,640);
    const camera = new PerspectiveCamera(frame.fieldOfView, frame.aspect, .01, 10);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
    for (const x of [-layout.width/2-.033,layout.width/2+.033]) for (const z of [-layout.depth/2-.033,layout.depth/2+.033]) {
      const projected = new Vector3(x,collection === "shogi" ? -.091 : -.049,z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
    }
    for (const x of [-layout.width/2+.017,layout.width/2-.017]) for (const z of [-layout.depth/2+.017,layout.depth/2-.017]) {
      const projected = new Vector3(x,tabletopPieceTop[collection],z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.99); expect(Math.abs(projected.y)).toBeLessThan(.94);
    }
  });
});


test("papamū wells are real recessed geometry with flush square edges and upward normals", () => {
  const geometry=createKonaneCellGeometry(), position=geometry.getAttribute("position"), normal=geometry.getAttribute("normal");
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.min.y).toBeCloseTo(-.006,6);
  expect(geometry.boundingBox!.max.y).toBeCloseTo(.002,6);
  expect(geometry.boundingBox!.max.x-geometry.boundingBox!.min.x).toBeCloseTo(.053,6);
  for (let i=0;i<position.count;i++) {
    expect(normal.getY(i)).toBeGreaterThan(0);
    if (Math.max(Math.abs(position.getX(i)),Math.abs(position.getZ(i)))>.026) expect(position.getY(i)).toBeCloseTo(.002,6);
  }
  geometry.dispose();
});

test("Jungle river surfaces are recessed beneath the banks and terrain stays tied to board squares", () => {
  const kit=createJungleTerrainKit(.053);
  kit.land.computeBoundingBox();kit.water.computeBoundingBox();
  expect(kit.land.boundingBox!.max.y).toBeCloseTo(.002,6);
  expect(kit.water.boundingBox!.max.y).toBeCloseTo(-.006,6);
  for(const cell of createInitialState("jungle").board.flat()) {
    const marks=kit.decorate(cell);
    expect(marks.children).toHaveLength(cell.terrain==="river"?3:cell.terrain==="trap"||cell.terrain==="den"?2:0);
    for(const mark of marks.children)expect(mark.userData.square).toEqual(cell.square);
  }
  kit.dispose();
});

test("tabletop readiness distinguishes texture content, lighting and replacement surfaces", () => {
  const pending = new Map<string, { texture: Texture; load: () => void }>();
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData: () => {} }) }) });
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation((url, onLoad) => {
    const texture = new Texture<HTMLImageElement>(); pending.set(url, { texture, load: () => onLoad?.(texture) }); return texture;
  });
  const environment = new DataTexture();
  let loadEnvironment = () => {};
  vi.spyOn(HDRLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    loadEnvironment = () => onLoad?.(environment, {}); return environment;
  });
  const scene = new Scene();
  const ready = vi.fn();
  const renderer = { capabilities: { getMaxAnisotropy: () => 8 } } as unknown as WebGLRenderer;
  const surfacePath = "/assets/shogi/hori/board-colour.webp";
  const tabletop = createTabletopScene(scene, renderer, .424, .424, false, "classic", ready, surfacePath);
  try {
    const colour = pending.get("/assets/materials/wood-table/colour.jpg")!;
    const caseMeshes = scene.children.flatMap(child => child.children).filter(child => child instanceof Mesh && (child.material as MeshPhysicalMaterial).map === colour.texture) as Mesh[];
    expect(caseMeshes.length).toBeGreaterThan(0);
    const materials = caseMeshes.map(mesh => mesh.material);
    expect(ready).not.toHaveBeenCalled();
    for (const [url, asset] of pending) if (url !== surfacePath) asset.load();
    expect(ready.mock.calls).toEqual([["texture"], ["texture"], ["texture"]]);
    expect(caseMeshes.map(mesh => mesh.material)).toEqual(materials);
    expect((caseMeshes[0].material as MeshPhysicalMaterial).map).toBe(colour.texture);
    expect(scene.environment).toBeNull();
    loadEnvironment();
    expect(ready).toHaveBeenLastCalledWith("environment");
    expect(scene.environment).toBe(environment);
    expect(environment.mapping).toBe(CubeUVReflectionMapping);
    expect(tabletop.boardSurface).toBeNull();
    pending.get(surfacePath)!.load();
    expect(ready).toHaveBeenLastCalledWith("surface");
    expect(tabletop.boardSurface).toBe(pending.get(surfacePath)!.texture);
    tabletop.dispose(); ready.mockClear();
    const dispose = vi.spyOn(environment, "dispose");
    loadEnvironment();
    for (const asset of pending.values()) asset.load();
    expect(ready).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.environment).toBeNull();
  } finally {
    tabletop.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

test.each([false, true])("papamū surface loading keeps native fallback and safe cleanup (stone: %s)", stone => {
  const pending = new Map<string, { texture: Texture; load: () => void }>();
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData: () => {} }) }) });
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation((url, onLoad) => {
    const texture = new Texture<HTMLImageElement>(); pending.set(url, { texture, load: () => onLoad?.(texture) }); return texture;
  });
  const environment = new DataTexture();
  vi.spyOn(HDRLoader.prototype, "load").mockImplementation(() => environment);
  const scene = new Scene();
  const ready = vi.fn();
  const path = stone ? "/assets/konane/shore/board-colour.webp" : undefined;
  const renderer = { capabilities: { getMaxAnisotropy: () => 8 } } as unknown as WebGLRenderer;
  const tabletop = createTabletopScene(scene, renderer, .424, .424, false, "konane", ready, path, stone);
  try {
    const body = scene.children.flatMap(child => child.children).find(child => child instanceof Mesh && Math.abs(child.position.y + .029) < 1e-8) as Mesh;
    const material = body.material as MeshPhysicalMaterial;
    const bounds = new Box3().setFromObject(body);
    expect(bounds.max.y).toBeCloseTo(-.009, 6);
    expect(bounds.max.y).toBeLessThan(-.006);
    expect(tabletop.boardSurface).toBeNull();
    if (stone) {
      expect([...pending.keys()]).toEqual([path]);
      expect(material.map).toBeNull(); expect(material.normalMap).toBeNull();
      expect(material.color.getHex()).toBe(0x82796d); expect(material.roughness).toBe(.88);
      tabletop.setBoardSurface(true); expect(material.map).toBeNull();
      const asset = pending.get(path!)!;
      expect(asset.texture.wrapS).toBe(RepeatWrapping); expect(asset.texture.wrapT).toBe(RepeatWrapping);
      const stoneBlocks = body.parent!.children.filter(child => child instanceof Mesh && child.material === material) as Mesh[];
      expect(stoneBlocks).toHaveLength(5);
      for (const block of stoneBlocks) {
        const positions = block.geometry.getAttribute("position"), normals = block.geometry.getAttribute("normal"), uv = block.geometry.getAttribute("uv");
        const indices = block.geometry.index;
        const flatEdges = [0, 0, 0];
        for (let triangle = 0; triangle < (indices?.count ?? positions.count); triangle += 3) {
          const vertices = [0, 1, 2].map(offset => indices ? indices.getX(triangle + offset) : triangle + offset);
          const axis = [0, 1, 2].find(axis => vertices.every(index => Math.abs(normals.getComponent(index, axis)) > .99999));
          for (let edge = 0; edge < 3; edge++) {
            const a = vertices[edge], b = vertices[(edge + 1) % 3];
            const metres = new Vector3().fromBufferAttribute(positions, a).distanceTo(new Vector3().fromBufferAttribute(positions, b));
            const repeats = new Vector2().set(uv.getX(a), uv.getY(a)).distanceTo(new Vector2().set(uv.getX(b), uv.getY(b)));
            expect(repeats * .424, "bevel triangles must not interpolate across different UV projections").toBeLessThanOrEqual(metres + .000001);
            if (axis !== undefined) {
              expect(repeats * .424, "stone flecks keep the same scale across every flat case face").toBeCloseTo(metres, 6);
              flatEdges[axis]++;
            }
          }
        }
        expect(flatEdges.every(count => count > 0)).toBe(true);
        for (let index = 0; index < positions.count; index++) if (normals.getY(index) > .99999) {
          expect(uv.getX(index) * .424 - .212, "top surfaces align with the continuous playing-field texture").toBeCloseTo(positions.getX(index) + block.position.x, 6);
          expect(.212 - uv.getY(index) * .424).toBeCloseTo(positions.getZ(index) + block.position.z, 6);
        }
      }
      asset.load(); tabletop.setBoardSurface(true);
      expect(ready).toHaveBeenCalledOnce();
      expect(material.map).toBe(asset.texture); expect(material.bumpMap).toBe(asset.texture);
      expect(material.color.getHex()).toBe(0xffffff); expect(material.roughness).toBe(.88);
      tabletop.setBoardSurface(false);
      expect(material.map).toBeNull(); expect(material.color.getHex()).toBe(0x82796d);
      const dispose = vi.spyOn(asset.texture, "dispose");
      tabletop.dispose(); asset.load();
      expect(dispose).toHaveBeenCalled(); expect(ready).toHaveBeenCalledOnce();
      expect(scene.children).toHaveLength(0);
    } else {
      expect([...pending.keys()]).toEqual(["/assets/materials/wood-table/colour.jpg", "/assets/materials/wood-table/normal.jpg", "/assets/materials/wood-table/roughness.jpg"]);
      expect(material.map).toBe(pending.get("/assets/materials/wood-table/colour.jpg")!.texture);
      expect(material.normalMap).toBe(pending.get("/assets/materials/wood-table/normal.jpg")!.texture);
      expect(material.roughness).toBe(.75);
    }
  } finally {
    tabletop.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
