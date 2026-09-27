import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Box3, Mesh, MeshStandardMaterial, Object3D, Raycaster, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, expect, test } from "vitest";
import { tabletopPieceTop } from "@/components/board/tabletop-camera";

const roles = ["general", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"] as const;
const glyphs = {
  red: ["帥", "仕", "相", "傌", "俥", "炮", "兵"],
  black: ["將", "士", "象", "馬", "車", "砲", "卒"]
} as const;
const pieces = (["red", "black"] as const).flatMap(owner => roles.map((role, index) => ({
  owner, role, glyph: glyphs[owner][index], name: `${owner}-${role}`,
  root: `${owner === "red" ? "light" : "dark"}_${role}`
})));

type PortableModel = {
  buffers: { uri?: string; byteLength: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[];
  images: { uri?: string; bufferView: number; mimeType: string }[];
  textures: { source: number }[];
  materials: { name: string; normalTexture?: { index: number }; pbrMetallicRoughness: {
    baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number };
  } }[];
};
let bytes: Buffer, document: PortableModel, binaryStart: number, scene: Object3D;

beforeAll(async () => {
  // A staged export can run the same geometry gates before publication. Do
  // not accept arbitrary paths or silently replace the canonical full-suite asset.
  const source = process.env.ALLCHESS_CELADON_MODEL_SOURCE ?? "public";
  if (source !== "public" && source !== "staged") throw new Error("Celadon model source must be public or staged");
  bytes = readFileSync(source === "staged" ? "output/atelier/celadon/staged-celadon.glb" : "public/assets/xiangqi/celadon.glb");
  const jsonLength = bytes.readUInt32LE(12);
  document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  binaryStart = 20 + jsonLength + 8;
  // Node validates mesh geometry normally and decodes the real embedded maps
  // below; it does not have the browser's WebGL texture/image loader.
  const loader = new GLTFLoader().register(() => ({ name: "NODE_TEXTURE_CHECK", loadTexture: () => Promise.resolve(new Texture()) }));
  scene = (await loader.parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
  for (const root of scene.children) root.position.set(0, 0, 0);
  scene.updateMatrixWorld(true);
});

function meshes(root: Object3D) {
  const result: Mesh[] = [];
  root.traverse(child => { if (child instanceof Mesh) result.push(child); });
  return result;
}

function materials(mesh: Mesh) {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
}

function vertices(mesh: Mesh) {
  const position = mesh.geometry.getAttribute("position"), result: Vector3[] = [];
  for (let i = 0; i < position.count; i++) result.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  return result;
}

function body(root: Object3D) {
  return meshes(root).filter(mesh => materials(mesh).every(material => !/ink/i.test(material.name)));
}

function pigment(root: Object3D) {
  return meshes(root).filter(mesh => materials(mesh).some(material => /ink/i.test(material.name)));
}

function faceInk(root: Object3D) {
  return pigment(root).filter(mesh => /^Face[ _]ink/.test(mesh.name));
}

function ringInk(root: Object3D) {
  return pigment(root).filter(mesh => /^Ring[ _]ink/.test(mesh.name));
}

function upwardTriangles(objects: Mesh[]) {
  const result: { point: Vector3; area: number }[] = [];
  for (const mesh of objects) {
    const points = vertices(mesh), index = mesh.geometry.index, count = index?.count ?? points.length;
    for (let i = 0; i < count; i += 3) {
      const a = points[index?.getX(i) ?? i], b = points[index?.getX(i + 1) ?? i + 1], c = points[index?.getX(i + 2) ?? i + 2];
      const normal = b.clone().sub(a).cross(c.clone().sub(a)), area = normal.length() / 2;
      if (area > 1e-12 && normal.normalize().y > .98) result.push({ point: a.clone().add(b).add(c).divideScalar(3), area });
    }
  }
  return result.sort((a, b) => b.area - a.area);
}

function firstSurface(objects: Mesh[], x: number, z: number, underside = false) {
  const ray = new Raycaster(new Vector3(x, underside ? -.05 : .05, z), new Vector3(0, underside ? 1 : -1, 0));
  return ray.intersectObjects(objects, false)[0];
}

function outlineDigest(objects: Mesh[]) {
  // A different name on the same placeholder mesh is not a different glyph.
  const outline = [...new Set(objects.flatMap(mesh => vertices(mesh).map(point => `${point.x.toFixed(6)},${point.z.toFixed(6)}`)))].sort();
  return createHash("sha256").update(outline.join(";")).digest("hex");
}

function surroundingFace(ceramic: Mesh[]) {
  // This annulus is outside the glyph and inside the separately cut border.
  // Measure its real ceramic surface rather than trusting an extras depth.
  const heights = Array.from({ length: 8 }, (_, i) => {
    const angle = 2 * Math.PI * (i + .173) / 8;
    const hit = firstSurface(ceramic, .0174 * Math.cos(angle), .0174 * Math.sin(angle));
    expect(hit, "continuous face surrounding the glyph").toBeDefined();
    return hit.point.y;
  });
  for (const height of heights) expect(height).toBeCloseTo(.0123, 5);
  return heights.reduce((sum, height) => sum + height, 0) / heights.length;
}

function assertBlindCarving(root: Object3D, paint: Mesh[], lip: number) {
  const ceramic = body(root), paintPoints = paint.flatMap(vertices);
  expect(paintPoints.length, `${root.name}: actual ink mesh`).toBeGreaterThan(0);
  const depths = paintPoints.map(point => lip - point.y);
  expect(Math.min(...depths), `${root.name}: pigment below surrounding ceramic`).toBeGreaterThan(.00030);
  expect(Math.max(...depths)).toBeLessThan(.00050);
  const samples = upwardTriangles(paint).slice(0, 3);
  expect(samples.length).toBe(3);
  for (const sample of samples) {
    const visibleInk = firstSurface(paint, sample.point.x, sample.point.z);
    const cutFloor = firstSurface(ceramic, sample.point.x, sample.point.z);
    expect(visibleInk, `${root.name}: visible recessed pigment`).toBeDefined();
    expect(cutFloor, `${root.name}: blind cut retains ceramic floor`).toBeDefined();
    // A decal sunk into an uncut solid fails because ceramic is hit first.
    expect(cutFloor.distance - visibleInk.distance, `${root.name}: open cut above pigment`).toBeGreaterThan(.000001);
    expect(cutFloor.distance - visibleInk.distance).toBeLessThan(.00008);
    expect(lip - cutFloor.point.y).toBeGreaterThan(.00035);
    expect(lip - cutFloor.point.y).toBeLessThan(.00045);
  }
}

test("Celadon is a portable GLB containing exactly fourteen playable native roots and real glaze maps", async () => {
  expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2); expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(scene.children.map(root => root.name).sort()).toEqual(pieces.map(piece => piece.root).sort());
  for (const resource of [...document.buffers, ...document.images]) expect(resource.uri).toBeUndefined();
  expect(document.images.length).toBeGreaterThanOrEqual(6);
  const ceramic = document.materials.filter(material => !/ink/i.test(material.name));
  expect(ceramic.map(material => material.name).sort()).toEqual(["Celadon pale jade grey glaze", "Celadon unglazed biscuit foot"].sort());
  const normalImages = new Set<number>();
  for (const material of ceramic) {
    for (const reference of [material.pbrMetallicRoughness.baseColorTexture, material.pbrMetallicRoughness.metallicRoughnessTexture, material.normalTexture]) {
      expect(reference, `${material.name}: colour, roughness and normal maps`).toBeDefined();
      expect(document.images[document.textures[reference!.index].source]).toBeDefined();
    }
    normalImages.add(document.textures[material.normalTexture!.index].source);
  }
  for (const [index, image] of document.images.entries()) {
    expect(["image/png", "image/jpeg"]).toContain(image.mimeType);
    const view = document.bufferViews[image.bufferView]; expect(view.buffer).toBe(0);
    const start = binaryStart + (view.byteOffset ?? 0), end = start + view.byteLength;
    expect(end).toBeLessThanOrEqual(bytes.length);
    const decoded = sharp(bytes.subarray(start, end)), metadata = await decoded.metadata(), stats = await decoded.stats();
    expect(metadata.width).toBeGreaterThanOrEqual(256); expect(metadata.height).toBeGreaterThanOrEqual(256);
    expect(stats.channels.slice(0, 3).some(channel => channel.stdev > .01), "embedded maps contain real surface variation").toBe(true);
    if (normalImages.has(index)) expect(stats.channels.slice(0, 2).some(channel => channel.stdev > .01), "normal maps contain actual tangent-space relief").toBe(true);
  }
});

test.each(pieces)("$name is grounded, finite, textured and fits the native board and camera", piece => {
  const root = scene.getObjectByName(piece.root)!;
  const bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
  for (const diameter of [size.x, size.z]) { expect(diameter).toBeGreaterThan(.0435); expect(diameter).toBeLessThanOrEqual(.0441); }
  expect(Math.abs(bounds.min.y)).toBeLessThan(.00002);
  expect(bounds.max.y).toBeGreaterThan(.012); expect(bounds.max.y).toBeLessThanOrEqual(.0128 + .000001);
  expect(bounds.max.y + .002 + .001).toBeLessThan(tabletopPieceTop.xiangqi);
  let triangles = 0;
  for (const mesh of meshes(root)) {
    const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal"), uv = mesh.geometry.getAttribute("uv");
    expect(normal, mesh.name).toBeDefined(); expect(uv, mesh.name).toBeDefined();
    expect(normal.count).toBe(position.count); expect(uv.count).toBe(position.count);
    for (const attribute of [position, normal, uv]) expect(Array.from(attribute.array).every(Number.isFinite), mesh.name).toBe(true);
    const vector = new Vector3(); let unitNormals = true;
    for (let i = 0; i < normal.count; i++) if (Math.abs(vector.fromBufferAttribute(normal, i).length() - 1) > .002) unitNormals = false;
    expect(unitNormals, mesh.name).toBe(true);
    triangles += (mesh.geometry.index?.count ?? position.count) / 3;
  }
  expect(triangles).toBeGreaterThan(300); expect(triangles).toBeLessThanOrEqual(25_000);
});

test.each(pieces)("$name has its native glyph carved into a blind recess, with front-only owner ink", piece => {
  const root = scene.getObjectByName(piece.root)!, face = faceInk(root), ring = ringInk(root);
  expect(root.userData.collection).toBe("celadon"); expect(root.userData.owner).toBe(piece.owner);
  expect(root.userData.role).toBe(piece.role); expect(root.userData.frontGlyph).toBe(piece.glyph);
  expect(root.userData.reverseGlyph).toBeUndefined();
  expect(face).toHaveLength(1); expect(face[0].name).toContain(piece.glyph); expect(ring).toHaveLength(1);
  expect(pigment(root)).toHaveLength(2);
  const lip = surroundingFace(body(root));
  assertBlindCarving(root, face, lip); assertBlindCarving(root, ring, lip);
  expect(Math.max(...face.flatMap(vertices).map(point => Math.hypot(point.x, point.z))), "glyph stays inside the border").toBeLessThan(.017);
  for (const paint of pigment(root)) for (const material of materials(paint)) {
    if (piece.owner === "red") { expect(material.color.r).toBeGreaterThan(material.color.g * 5); expect(material.color.r).toBeGreaterThan(material.color.b * 5); }
    else expect(Math.max(material.color.r, material.color.g, material.color.b)).toBeLessThan(.03);
  }
});

test.each(pieces)("$name has a real annular groove, grounded foot ring and recessed unlettered underside", piece => {
  const root = scene.getObjectByName(piece.root)!, ceramic = body(root);
  for (let i = 0; i < 8; i++) {
    const angle = 2 * Math.PI * (i + .173) / 8, x = Math.cos(angle), z = Math.sin(angle);
    const innerFace = firstSurface(ceramic, .0177 * x, .0177 * z);
    const groove = firstSurface(ceramic, .018375 * x, .018375 * z);
    const outerLip = firstSurface(ceramic, .019 * x, .019 * z);
    expect(innerFace).toBeDefined(); expect(groove).toBeDefined(); expect(outerLip).toBeDefined();
    expect(groove.point.y).toBeCloseTo(.0119, 5);
    expect(innerFace.point.y - groove.point.y, "groove inner ceramic wall").toBeGreaterThan(.00030);
    expect(outerLip.point.y - groove.point.y, "groove outer ceramic wall").toBeGreaterThan(.00040);
    // The sole is circular and unlettered; front cuts must not perforate it.
    for (const radius of [.004, .009, .014]) {
      const sole = firstSurface(ceramic, radius * x, radius * z, true);
      expect(sole).toBeDefined(); expect(sole.point.y).toBeCloseTo(.0011, 5);
    }
  }
  const centre = firstSurface(ceramic, 0, 0, true);
  expect(centre).toBeDefined(); expect(centre.point.y).toBeCloseTo(.0011, 5);
  const contact = ceramic.flatMap(vertices).filter(point => Math.abs(point.y) < .00002);
  expect(contact.length).toBeGreaterThanOrEqual(8);
  const radii = contact.map(point => Math.hypot(point.x, point.z));
  expect(Math.min(...radii), "contact occurs on a real foot ring rather than a flat disc").toBeGreaterThan(.0178);
  expect(Math.max(...radii)).toBeLessThan(.019);
  expect(Math.min(...pigment(root).flatMap(vertices).map(point => point.y)), "no underside lettering mesh").toBeGreaterThan(.0118);
});

test("fourteen native characters have distinct actual geometry while their incised borders match", () => {
  expect(new Set(pieces.map(piece => outlineDigest(faceInk(scene.getObjectByName(piece.root)!)))).size).toBe(14);
  expect(new Set(pieces.map(piece => outlineDigest(ringInk(scene.getObjectByName(piece.root)!)))).size).toBe(1);
});

type PromptRecord = { name: string; owner: string; role: string; glyph: string; prompt: string; references: string[]; file: string; generationId: string };

test("all fourteen individual masters retain exact native glyph prompts and unique generation provenance", () => {
  const prompts = JSON.parse(readFileSync("ops/assets/xiangqi/celadon/prompts.json", "utf8")) as { mode: string; collection: string; records: PromptRecord[] };
  expect(prompts.mode).toBe("built-in image_gen"); expect(prompts.collection).toBe("Xiangqi Celadon");
  expect(prompts.records.map(record => record.name).sort()).toEqual(pieces.map(piece => piece.name).sort());
  expect(new Set(prompts.records.map(record => record.generationId)).size).toBe(14);
  for (const piece of pieces) {
    const record = prompts.records.find(record => record.name === piece.name)!;
    expect(record.owner).toBe(piece.owner); expect(record.role).toBe(piece.role); expect(record.glyph).toBe(piece.glyph);
    expect(record.prompt).toContain(piece.glyph); expect(record.prompt.length).toBeGreaterThan(100);
    expect(record.file).toBe(`${piece.name}.png`); expect(record.generationId).toMatch(/^exec-[a-f0-9-]{36}$/);
    expect(Array.isArray(record.references)).toBe(true);
    for (const reference of record.references) expect(reference.length).toBeGreaterThan(0);
  }
});

test.each(pieces)("$name has genuine master alpha and a 512px portable sprite", async piece => {
  for (const [file, runtime] of [[`ops/assets/xiangqi/celadon/${piece.name}.png`, false], [`public/assets/xiangqi/celadon/${piece.name}.webp`, true]] as const) {
    const source = sharp(file), metadata = await source.metadata(), stats = await source.stats();
    expect(metadata.format).toBe(runtime ? "webp" : "png");
    if (runtime) { expect(metadata.width).toBe(512); expect(metadata.height).toBe(512); }
    else { expect(metadata.width).toBeGreaterThanOrEqual(1024); expect(metadata.height).toBeGreaterThanOrEqual(1024); }
    expect(metadata.hasAlpha).toBe(true); expect(stats.isOpaque).toBe(false);
    const alpha = stats.channels.at(-1)!;
    expect(alpha.min).toBe(0); expect(alpha.max).toBe(255); expect(alpha.mean).toBeGreaterThan(15); expect(alpha.mean).toBeLessThan(210);
    const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + info.channels - 1];
    for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) expect(alphaAt(x, y), "transparent sprite corners").toBe(0);
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), "solid ceramic face").toBeGreaterThan(240);
  }
});

test("the coordinated board retains opaque master/runtime surfaces and generation provenance", async () => {
  const prompt = JSON.parse(readFileSync("ops/assets/xiangqi/celadon/board-prompt.json", "utf8"));
  expect(prompt.mode).toBe("built-in image_gen"); expect(prompt.file).toBe("board-colour.png");
  expect(prompt.generationId).toMatch(/^exec-[a-f0-9-]{36}$/); expect(prompt.prompt).toContain("Xiangqi"); expect(prompt.prompt.length).toBeGreaterThan(100);
  for (const [file, runtime] of [["ops/assets/xiangqi/celadon/board-colour.png", false], ["public/assets/xiangqi/celadon/board-colour.webp", true]] as const) {
    const image = sharp(file), metadata = await image.metadata(), stats = await image.stats();
    expect(metadata.format).toBe(runtime ? "webp" : "png"); expect(metadata.width).toBeGreaterThanOrEqual(1024); expect(metadata.height).toBeGreaterThanOrEqual(1024);
    if (runtime) { expect(metadata.width).toBe(1024); expect(metadata.height).toBe(1024); }
    expect(stats.isOpaque).toBe(true);
    expect(stats.channels.slice(0, 3).some(channel => channel.stdev > 1), "actual board surface variation").toBe(true);
  }
});
