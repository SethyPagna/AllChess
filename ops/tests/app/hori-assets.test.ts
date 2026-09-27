import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Box3, Mesh, MeshStandardMaterial, Object3D, Raycaster, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, expect, test } from "vitest";
import { tabletopFrame, tabletopPieceTop } from "@/components/board/tabletop-camera";
import { shogiStandTop } from "@/components/board/shogi-stands";

const fronts: Record<string, string> = { king: "玉", rook: "飛", bishop: "角", gold: "金", silver: "銀", knight: "桂", lance: "香", pawn: "歩" };
const reverses: Record<string, string> = { rook: "竜", bishop: "馬", silver: "全", knight: "圭", lance: "杏", pawn: "と" };
const sprites: Record<string, string> = {
  "king-jewel": "玉", king: "王", ...Object.fromEntries(Object.entries(fronts).filter(([role]) => role !== "king")),
  ...Object.fromEntries(Object.entries(reverses).map(([role, glyph]) => [`promoted-${role}`, glyph]))
};
const roles = [...Object.keys(fronts), ...Object.keys(reverses).map(role => `promoted_${role}`)];
const rootNames = ["light", "dark"].flatMap(side => roles.map(role => `${side}_${role}`));
const dimensions: Record<string, [number, number]> = {
  king: [.033, .039], rook: [.032, .0378], bishop: [.032, .0378], gold: [.0308, .0365],
  silver: [.0308, .0365], knight: [.0295, .0353], lance: [.0272, .0347], pawn: [.0265, .0334]
};

type PortableModel = {
  buffers: { uri?: string; byteLength: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[];
  images: { uri?: string; bufferView: number; mimeType: string }[];
  materials: { name: string; normalTexture?: { index: number }; pbrMetallicRoughness: {
    baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number };
  } }[];
};
let bytes: Buffer, document: PortableModel, binaryStart: number, scene: Object3D;

beforeAll(async () => {
  bytes = readFileSync("public/assets/shogi/hori.glb");
  const jsonLength = bytes.readUInt32LE(12);
  document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  binaryStart = 20 + jsonLength + 8;
  // Decode the actual embedded maps separately; Node has no WebGL image loader.
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

function ink(root: Object3D, face: "Front" | "Reverse") {
  return meshes(root).find(mesh => mesh.name.startsWith(`${face}_ink`) || mesh.name.startsWith(`${face} ink`));
}

function body(root: Object3D) {
  // GLTFLoader can split the two wood material groups into separate meshes.
  return meshes(root).filter(mesh => materials(mesh).every(material => !material.name.includes("ink")));
}

function facingTriangles(objects: Mesh[], outward: Vector3) {
  const result: { point: Vector3; normal: Vector3; area: number }[] = [];
  for (const mesh of objects) {
    const points = vertices(mesh), index = mesh.geometry.index;
    const count = index?.count ?? points.length;
    for (let i = 0; i < count; i += 3) {
      const a = points[index?.getX(i) ?? i], b = points[index?.getX(i + 1) ?? i + 1], c = points[index?.getX(i + 2) ?? i + 2];
      const normal = b.clone().sub(a).cross(c.clone().sub(a)), area = normal.length() / 2;
      if (area < 1e-12 || normal.normalize().dot(outward) < .98) continue;
      result.push({ point: a.clone().add(b).add(c).divideScalar(3), normal, area });
    }
  }
  return result.sort((a, b) => b.area - a.area);
}

function footprint(mesh: Mesh, reflected = false) {
  // Project actual glyph vertices onto the tile: the underside mirrors X.
  return [...new Set(vertices(mesh).map(point => `${(point.x * (reflected ? -1 : 1)).toFixed(6)},${point.z.toFixed(6)}`))].sort();
}

function geometryDigest(root: Object3D) {
  const hash = createHash("sha256");
  const parts = meshes(root).map(mesh => vertices(mesh).map(point => point.toArray().map(value => value.toFixed(6)).join(",")).sort().join(";"));
  hash.update(parts.sort().join("|"));
  return hash.digest("hex");
}

function assertCarved(root: Object3D, paint: Mesh, reverse: boolean) {
  const outward = new Vector3(0, reverse ? -1 : 1, 0), wood = body(root);
  const faces = facingTriangles(wood, outward);
  expect(faces.length, `${root.name}: surrounding wood face`).toBeGreaterThan(0);
  // Infer the lip plane from the real largest face, then locate its outermost
  // parallel surface. No author metadata or hard-coded engraving depth is used.
  const normal = faces[0].normal;
  const lip = Math.max(...wood.flatMap(mesh => vertices(mesh).map(point => point.dot(normal))));
  const paintPoints = vertices(paint), depths = paintPoints.map(point => lip - point.dot(normal));
  expect(Math.min(...depths), `${root.name}: ink must be inside the cut`).toBeGreaterThan(.00025);
  expect(Math.max(...depths), `${root.name}: shallow carved face`).toBeLessThan(.00060);

  const samples = facingTriangles([paint], outward).slice(0, 3);
  expect(samples.length, `${root.name}: actual outward ink faces`).toBe(3);
  for (const sample of samples) {
    const ray = new Raycaster(sample.point.clone().addScaledVector(outward, .05), outward.clone().negate());
    const pigment = ray.intersectObject(paint, false)[0], floor = ray.intersectObjects(wood, false)[0];
    expect(pigment, `${root.name}: visible ink`).toBeDefined();
    expect(floor, `${root.name}: blind recess retains a wood floor`).toBeDefined();
    // A decal merely sunk into an uncut solid would hit wood before pigment.
    expect(floor.distance - pigment.distance, `${root.name}: open cut above ink`).toBeGreaterThan(.000001);
    expect(floor.distance - pigment.distance).toBeLessThan(.00008);
    expect(lip - floor.point.dot(normal), `${root.name}: actual cavity floor`).toBeGreaterThan(.00030);
  }
}

test("Carved Shogi is a portable GLB with 28 semantic roots and embedded wood PBR maps", async () => {
  expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(scene.children.map(root => root.name).sort()).toEqual([...rootNames].sort());
  expect(document.images.length).toBeGreaterThanOrEqual(4);
  for (const resource of [...document.buffers, ...document.images]) expect(resource.uri).toBeUndefined();
  const woods = document.materials.filter(material => !material.name.includes("ink"));
  expect(woods).toHaveLength(2);
  for (const material of woods) {
    expect(material.pbrMetallicRoughness.baseColorTexture, material.name).toBeDefined();
    expect(material.pbrMetallicRoughness.metallicRoughnessTexture, material.name).toBeDefined();
    expect(material.normalTexture, material.name).toBeDefined();
  }
  for (const image of document.images) {
    expect(["image/png", "image/jpeg"]).toContain(image.mimeType);
    const view = document.bufferViews[image.bufferView];
    expect(view.buffer).toBe(0);
    const start = binaryStart + (view.byteOffset ?? 0), end = start + view.byteLength;
    expect(end).toBeLessThanOrEqual(bytes.length);
    const decoded = sharp(bytes.subarray(start, end)), metadata = await decoded.metadata(), stats = await decoded.stats();
    expect(metadata.width).toBeGreaterThanOrEqual(256); expect(metadata.height).toBeGreaterThanOrEqual(256);
    expect(stats.channels.some(channel => channel.stdev > .01), "maps contain real surface variation").toBe(true);
  }
});

test.each(rootNames)("%s is grounded, finite, textured and safely below both tile-stack and camera limits", name => {
  const root = scene.getObjectByName(name)!;
  const role = name.replace(/^(light|dark)_/, "").replace(/^promoted_/, "");
  const bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
  expect(size.x).toBeGreaterThan(dimensions[role][0] - .001); expect(size.x).toBeLessThanOrEqual(dimensions[role][0] + .0001);
  expect(size.z).toBeGreaterThan(dimensions[role][1] - .001); expect(size.z).toBeLessThanOrEqual(dimensions[role][1] + .0001);
  expect(Math.abs(bounds.min.y)).toBeLessThan(.00002);
  expect(bounds.max.y).toBeGreaterThan(.008); expect(bounds.max.y).toBeLessThanOrEqual(.0115);
  expect(bounds.min.y + .012 - bounds.max.y, "12 mm stack spacing leaves a real air gap").toBeGreaterThanOrEqual(.00049);
  expect(bounds.max.y + .002 + .001).toBeLessThan(tabletopPieceTop.shogi);
  for (const width of [296, 692]) {
    const frame = tabletopFrame("shogi", 9, 9, width);
    const selectedStackTop = shogiStandTop + 2 * .012 + .004 + bounds.max.y;
    expect(Math.max(...frame.bounds.map(point => point.y))).toBeGreaterThan(selectedStackTop + .001);
  }
  let triangles = 0;
  for (const mesh of meshes(root)) {
    const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal"), uv = mesh.geometry.getAttribute("uv");
    expect(normal, mesh.name).toBeDefined(); expect(uv, mesh.name).toBeDefined();
    expect(normal.count).toBe(position.count); expect(uv.count).toBe(position.count);
    for (const attribute of [position, normal, uv]) expect(Array.from(attribute.array).every(Number.isFinite), mesh.name).toBe(true);
    const normalVector = new Vector3();
    let unitNormals = true;
    for (let i = 0; i < normal.count; i++) if (Math.abs(normalVector.fromBufferAttribute(normal, i).length() - 1) > .002) unitNormals = false;
    expect(unitNormals, mesh.name).toBe(true);
    triangles += (mesh.geometry.index?.count ?? position.count) / 3;
  }
  expect(triangles).toBeGreaterThan(200); expect(triangles).toBeLessThanOrEqual(25_000);
});

test.each(rootNames)("%s has real front carving and the correct paired carved underside", name => {
  const root = scene.getObjectByName(name)!;
  const promoted = name.includes("_promoted_"), role = name.replace(/^(light|dark)_/, "").replace(/^promoted_/, "");
  const frontGlyph = promoted ? reverses[role] : role === "king" && name.startsWith("dark_") ? "王" : fronts[role];
  const reverseGlyph = promoted ? fronts[role] : reverses[role] ?? null;
  expect(root.userData.frontGlyph).toBe(frontGlyph);
  expect(root.userData.reverseGlyph ?? null).toBe(reverseGlyph);
  const face = ink(root, "Front")!;
  expect(face).toBeDefined(); expect(face.name).toContain(frontGlyph);
  assertCarved(root, face, false);
  const faceMaterial = materials(face)[0];
  if (promoted) expect(faceMaterial.color.r).toBeGreaterThan(faceMaterial.color.g * 5);
  else expect(Math.max(faceMaterial.color.r, faceMaterial.color.g, faceMaterial.color.b)).toBeLessThan(.03);
  const underside = ink(root, "Reverse");
  if (!reverseGlyph) { expect(underside).toBeUndefined(); return; }
  expect(underside).toBeDefined(); expect(underside!.name).toContain(reverseGlyph);
  assertCarved(root, underside!, true);
  const pairedName = promoted ? name.replace("promoted_", "") : name.replace(`_${role}`, `_promoted_${role}`);
  expect(footprint(underside!, true), `${name}: actual paired glyph outline`).toEqual(footprint(ink(scene.getObjectByName(pairedName)!, "Front")!));
  const reverseMaterial = materials(underside!)[0];
  if (promoted) expect(Math.max(reverseMaterial.color.r, reverseMaterial.color.g, reverseMaterial.color.b)).toBeLessThan(.03);
  else expect(reverseMaterial.color.r).toBeGreaterThan(reverseMaterial.color.g * 5);
});

test("both owners share identical native tiles, with genuinely different 玉 and 王 king geometry", () => {
  for (const role of roles.filter(role => role !== "king")) expect(geometryDigest(scene.getObjectByName(`light_${role}`)!)).toBe(geometryDigest(scene.getObjectByName(`dark_${role}`)!));
  expect(footprint(ink(scene.getObjectByName("light_king")!, "Front")!)).not.toEqual(footprint(ink(scene.getObjectByName("dark_king")!, "Front")!));
});

type PromptRecord = { name: string; glyph: string; prompt: string; references: string[]; file: string; generationId: string };

test("the 15 individual masters retain exact glyph prompts and unique generation provenance", () => {
  const prompts = JSON.parse(readFileSync("ops/assets/shogi/hori/prompts.json", "utf8")) as { mode: string; records: PromptRecord[] };
  expect(prompts.mode).toBe("built-in image_gen");
  expect(prompts.records.map(record => record.name).sort()).toEqual(Object.keys(sprites).sort());
  expect(new Set(prompts.records.map(record => record.generationId)).size).toBe(15);
  for (const record of prompts.records) {
    expect(record.glyph).toBe(sprites[record.name]); expect(record.prompt).toContain(record.glyph);
    expect(record.prompt.length).toBeGreaterThan(100); expect(record.file).toBe(`${record.name}.png`);
    expect(record.generationId).toMatch(/^exec-[a-f0-9-]{36}$/);
    expect(Array.isArray(record.references)).toBe(true);
    for (const reference of record.references) expect(reference.length).toBeGreaterThan(0);
  }
});

test.each(Object.keys(sprites))("%s has a transparent individual master and a 512px runtime sprite", async name => {
  for (const [file, runtime] of [[`ops/assets/shogi/hori/${name}.png`, false], [`public/assets/shogi/hori/${name}.webp`, true]] as const) {
    const source = sharp(file), metadata = await source.metadata(), stats = await source.stats();
    expect(metadata.format).toBe(runtime ? "webp" : "png");
    if (runtime) { expect(metadata.width).toBe(512); expect(metadata.height).toBe(512); }
    else { expect(metadata.width).toBeGreaterThanOrEqual(1024); expect(metadata.height).toBeGreaterThanOrEqual(1024); }
    expect(metadata.hasAlpha).toBe(true); expect(stats.isOpaque).toBe(false);
    const alpha = stats.channels.at(-1)!;
    expect(alpha.min).toBe(0); expect(alpha.max).toBe(255);
    expect(alpha.mean).toBeGreaterThan(15); expect(alpha.mean).toBeLessThan(210);
    const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + info.channels - 1];
    for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) expect(alphaAt(x, y), "corners remain transparent").toBe(0);
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), "the tile has a solid face").toBeGreaterThan(240);
  }
});

test("the coordinated board has an opaque 1024px runtime surface and retained generation provenance", async () => {
  const prompt = JSON.parse(readFileSync("ops/assets/shogi/hori/board-prompt.json", "utf8"));
  expect(prompt.mode).toBe("built-in image_gen");
  expect(prompt.file).toBe("board-colour.png");
  expect(prompt.generationId).toMatch(/^exec-[a-f0-9-]{36}$/);
  expect(prompt.prompt).toContain("Shogi"); expect(prompt.prompt.length).toBeGreaterThan(100);
  for (const [file, runtime] of [["ops/assets/shogi/hori/board-colour.png", false], ["public/assets/shogi/hori/board-colour.webp", true]] as const) {
    const image = sharp(file), metadata = await image.metadata(), stats = await image.stats();
    expect(metadata.format).toBe(runtime ? "webp" : "png");
    expect(metadata.width).toBeGreaterThanOrEqual(1024); expect(metadata.height).toBeGreaterThanOrEqual(1024);
    if (runtime) { expect(metadata.width).toBe(1024); expect(metadata.height).toBe(1024); }
    expect(stats.isOpaque).toBe(true);
    expect(stats.channels.slice(0, 3).some(channel => channel.stdev > 1), "actual wood grain remains").toBe(true);
  }
});
