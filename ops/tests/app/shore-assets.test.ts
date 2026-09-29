import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Box3, Mesh, Object3D, Raycaster, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, test } from "vitest";
import { board3DLayout } from "@/components/board/board-3d-config";
import { createKonaneCellGeometry } from "@/components/board/konane-board";
import { tabletopPieceTop } from "@/components/board/tabletop-camera";

const owners = ["light", "dark"] as const;
const names = ["light-stone", "dark-stone", "board-colour"];
const sourceDirectory = "ops/assets/konane/shore";
const runtimeDirectory = "public/assets/konane/shore";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

type Provenance = { assets: { name: string; file: string; generationId: string; transparentBackground: boolean }[] };
type Prepared = { files: { name: string; sourceSha256: string; runtimeSha256: string; bytes: number }[] };
type Model = {
  buffers: { uri?: string; byteLength: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[];
  images: { uri?: string; bufferView: number; mimeType: string }[];
  textures: { source: number }[];
  materials: { name: string; alphaMode?: string; normalTexture?: { index: number }; pbrMetallicRoughness: {
    metallicFactor?: number; baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number };
  } }[];
};

async function pixels(file: string | Buffer, size?: number) {
  const image = sharp(file), metadata = await image.metadata();
  if (size) image.resize(size, size);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const linear = (value: number) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  const luminances: number[] = [];
  let clear = 0, opaque = 0, left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const index = (y * info.width + x) * 4, alpha = data[index + 3];
    if (alpha === 0) clear++;
    if (alpha >= 250) {
      opaque++;
      luminances.push(.2126 * linear(data[index] / 255) + .7152 * linear(data[index + 1] / 255) + .0722 * linear(data[index + 2] / 255));
    }
    if (alpha > 127) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  const mean = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const deviation = Math.sqrt(luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminances.length);
  return { data, info, metadata, mean, deviation, clear: clear / (info.width * info.height), opaque: opaque / (info.width * info.height), left, top, right, bottom };
}

test("Shore's three prepared images retain independent generated sources and exact hash lineage", () => {
  const source: Provenance = JSON.parse(readFileSync(`${sourceDirectory}/source.json`, "utf8"));
  const prepared: Prepared = JSON.parse(readFileSync(`${sourceDirectory}/prepared.json`, "utf8"));
  expect(source.assets.map(asset => asset.name).sort()).toEqual([...names].sort());
  expect(prepared.files.map(asset => asset.name).sort()).toEqual([...names].sort());
  expect(new Set(source.assets.map(asset => asset.generationId)).size).toBe(3);
  for (const asset of source.assets) {
    expect(asset.file).toBe(`${asset.name}.png`);
    expect(asset.generationId).toMatch(/^exec-[a-f0-9-]{36}$/);
    expect(asset.transparentBackground).toBe(asset.name !== "board-colour");
    const record = prepared.files.find(file => file.name === asset.name)!;
    const runtime = readFileSync(`${runtimeDirectory}/${asset.name}.webp`);
    expect(hash(readFileSync(`${sourceDirectory}/${asset.file}`))).toBe(record.sourceSha256);
    expect(hash(runtime)).toBe(record.runtimeSha256);
    expect(runtime.length).toBe(record.bytes);
  }
});

test.each(owners)("%s stone has genuine transparent margins and readable framing in master and sprite", async owner => {
  for (const runtime of [false, true]) {
    const image = await pixels(`${runtime ? runtimeDirectory : sourceDirectory}/${owner}-stone.${runtime ? "webp" : "png"}`);
    expect(image.metadata.format).toBe(runtime ? "webp" : "png");
    expect(image.metadata.hasAlpha).toBe(true);
    expect(image.info.width).toBe(image.info.height);
    if (runtime) expect(image.info.width).toBe(512);
    expect(image.clear, "a real cutout rather than an opaque painted background").toBeGreaterThan(.25);
    expect(image.opaque, "a solid mineral body rather than a faint shadow").toBeGreaterThan(.25);
    const { width, height } = image.info;
    const alphaAt = (x: number, y: number) => image.data[(y * width + x) * 4 + 3];
    for (let index = 0; index < width; index++) {
      expect(Math.max(alphaAt(index, 0), alphaAt(index, height - 1), alphaAt(0, index), alphaAt(width - 1, index))).toBeLessThanOrEqual(runtime ? 0 : 1);
    }
    expect(alphaAt(Math.floor(width / 2), Math.floor(height / 2))).toBeGreaterThanOrEqual(250);
    expect(Math.min(image.left, image.top, width - 1 - image.right, height - 1 - image.bottom) / width).toBeGreaterThan(.04);
    for (const span of [image.right - image.left + 1, image.bottom - image.top + 1]) {
      expect(span / width, "the whole stone remains legible at playing scale").toBeGreaterThan(.6);
      expect(span / width).toBeLessThan(.9);
    }
    expect(image.deviation, "variation inside opaque stone pixels, not alpha edges").toBeGreaterThan(.01);
  }
});

test("the owners remain distinct at 32px and the opaque board sits between their luminances", async () => {
  const [light, dark, board] = await Promise.all(names.map(name => pixels(`${runtimeDirectory}/${name}.webp`, 32)));
  expect((light.mean + .05) / (dark.mean + .05), "light and dark stones remain distinguishable").toBeGreaterThan(3);
  const mask = (image: typeof light) => [...image.data].filter((_, index) => index % 4 === 3).map(alpha => alpha > 127 ? 1 : 0).join("");
  expect(mask(light), "the owners have independently shaped silhouettes").not.toBe(mask(dark));
  expect(board.mean).toBeGreaterThan(dark.mean); expect(board.mean).toBeLessThan(light.mean);
  for (const file of [`${sourceDirectory}/board-colour.png`, `${runtimeDirectory}/board-colour.webp`]) {
    const image = await pixels(file);
    expect(image.opaque).toBe(1);
    expect(image.deviation, "actual stone-surface variation").toBeGreaterThan(.01);
    if (file.endsWith("webp")) { expect(image.info.width).toBe(1024); expect(image.info.height).toBe(1024); }
  }
});

describe("Shore physical stones", () => {
  let bytes: Buffer, document: Model, binaryStart: number, scene: Object3D;
  beforeAll(async () => {
    bytes = readFileSync("public/assets/konane/shore.glb");
    const jsonLength = bytes.readUInt32LE(12);
    document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
    binaryStart = 20 + jsonLength + 8;
    const loader = new GLTFLoader().register(() => ({ name: "NODE_TEXTURE_CHECK", loadTexture: () => Promise.resolve(new Texture()) }));
    scene = (await loader.parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
    scene.updateMatrixWorld(true);
  });
  function meshes(root: Object3D) {
    const result: Mesh[] = [];
    root.traverse(child => { if (child instanceof Mesh) result.push(child); });
    return result;
  }
  function vertices(root: Object3D) {
    return meshes(root).flatMap(mesh => {
      const position = mesh.geometry.getAttribute("position");
      return Array.from({ length: position.count }, (_, index) => new Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
    });
  }
  function surface(root: Object3D, x: number, z: number, underside = false) {
    return new Raycaster(new Vector3(x, underside ? -.05 : .05, z), new Vector3(0, underside ? 1 : -1, 0)).intersectObject(root, true)[0];
  }

  test("two playable roots and all material resources are portable inside the GLB", async () => {
    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    expect(bytes.readUInt32LE(4)).toBe(2); expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(scene.children.map(root => root.name).sort()).toEqual(["dark_stone", "light_stone"]);
    expect(document.buffers).toHaveLength(1);
    expect(document.materials).toHaveLength(2);
    expect(document.buffers[0].byteLength).toBeLessThanOrEqual(bytes.length - binaryStart);
    for (const root of scene.children) {
      expect(meshes(root), root.name).toHaveLength(1);
      expect(root.position.toArray(), `${root.name}: centered placement origin`).toEqual([0, 0, 0]);
    }
    for (const resource of [...document.buffers, ...document.images]) expect(resource.uri).toBeUndefined();
    const decoded = await Promise.all(document.images.map(async image => {
      expect(["image/png", "image/jpeg"]).toContain(image.mimeType);
      const view = document.bufferViews[image.bufferView]; expect(view.buffer).toBe(0);
      const start = binaryStart + (view.byteOffset ?? 0), end = start + view.byteLength;
      expect(start).toBeGreaterThanOrEqual(binaryStart); expect(end).toBeLessThanOrEqual(bytes.length);
      return sharp(bytes.subarray(start, end)).stats();
    }));
    for (const material of document.materials) {
      expect(material.alphaMode ?? "OPAQUE", "solid stone geometry rather than alpha cards").toBe("OPAQUE");
      for (const [kind, reference] of Object.entries({ colour: material.pbrMetallicRoughness.baseColorTexture, roughness: material.pbrMetallicRoughness.metallicRoughnessTexture, normal: material.normalTexture })) {
        expect(reference, `${material.name}: embedded ${kind} map`).toBeDefined();
        const stats = decoded[document.textures[reference!.index].source];
        const channels = kind === "normal" ? stats.channels.slice(0, 2) : kind === "roughness" ? [stats.channels[1]] : stats.channels.slice(0, 3);
        expect(channels.some(channel => channel.stdev > 1), `${material.name}: ${kind} varies on the actual decoded surface`).toBe(true);
        if (kind === "roughness") expect(stats.channels[2].max / 255 * (material.pbrMetallicRoughness.metallicFactor ?? 1), "stone remains nonmetallic after the packed map and factor are multiplied").toBeLessThan(.05);
      }
    }
  });

  test.each(owners)("%s stone has finite textured volume within every yaw and the existing camera envelope", owner => {
    const root = scene.getObjectByName(`${owner}_stone`)!;
    const bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
    expect(size.y, "a physical pebble, not a textured plane").toBeGreaterThanOrEqual(.014 - .00001);
    expect(size.y).toBeLessThanOrEqual(.016 + .00001);
    expect(Math.abs(bounds.min.y), "the local foot rests at the well placement origin").toBeLessThan(.0001);
    expect(bounds.max.y - .006 + .001, "placed top plus camera safety margin").toBeLessThanOrEqual(tabletopPieceTop.konane);
    const radius = vertices(root).reduce((maximum, point) => Math.max(maximum, Math.hypot(point.x, point.z)), 0);
    expect(radius * 2, "circumscribed footprint fits for every yaw").toBeLessThan(board3DLayout("konane", 8, 8).pitchX);
    expect(radius, "the whole footprint stays inside the 21mm well rim for every yaw").toBeLessThan(.021);
    for (const mesh of meshes(root)) {
      const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal"), uv = mesh.geometry.getAttribute("uv");
      expect(normal, mesh.name).toBeDefined(); expect(uv, mesh.name).toBeDefined();
      expect(normal.count).toBe(position.count); expect(uv.count).toBe(position.count);
      for (const attribute of [position, normal, uv]) expect(Array.from(attribute.array).every(Number.isFinite), mesh.name).toBe(true);
      const vector = new Vector3();
      expect(Array.from({ length: normal.count }, (_, index) => vector.fromBufferAttribute(normal, index).length()).every(length => Math.abs(length - 1) < .005), `${mesh.name}: unit normals`).toBe(true);
      for (const axis of [0, 1]) {
        let low = Infinity, high = -Infinity;
        for (let index = 0; index < uv.count; index++) { const value = uv.getComponent(index, axis); low = Math.min(low, value); high = Math.max(high, value); }
        expect(high - low, `${mesh.name}: ${axis === 0 ? "U" : "V"} samples a real texture area`).toBeGreaterThan(.5);
      }
    }
  });

  test.each(owners)("%s underside clears the native bowl after mounting, including between radial segments", owner => {
    const root = scene.getObjectByName(`${owner}_stone`)!, bowl = new Mesh(createKonaneCellGeometry());
    const center = surface(root, 0, 0, true); expect(center).toBeDefined();
    const underside = [center.point];
    for (let direction = 0; direction < 24; direction++) for (let radius = .002; radius <= .020; radius += .002) {
      const angle = direction * Math.PI / 12, hit = surface(root, radius * Math.cos(angle), radius * Math.sin(angle), true);
      if (hit) underside.push(hit.point);
    }
    expect(underside.some(point => Math.hypot(point.x, point.z) > .016), "the clearance check reaches the broad outer shoulder").toBe(true);
    let penetration = 0, witness = "";
    for (const point of underside) for (const yaw of [0, Math.PI / 128, Math.PI / 64]) {
      const x = point.x * Math.cos(yaw) - point.z * Math.sin(yaw), z = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
      const floor = surface(bowl, x, z); expect(floor).toBeDefined();
      const difference = floor.point.y - (point.y - .006);
      if (difference > penetration) { penetration = difference; witness = JSON.stringify({ x, z, yaw, stoneY: point.y - .006, bowlY: floor.point.y }); }
    }
    bowl.geometry.dispose();
    expect(penetration, `stone must not pass through the bowl: ${witness}`).toBeLessThanOrEqual(.00015);
  });

  test.each(owners)("%s has real top-surface pore cavities and retains its master lineage", owner => {
    const root = scene.getObjectByName(`${owner}_stone`)!;
    expect(root.userData.master_sha256).toBe(hash(readFileSync(`${sourceDirectory}/${owner}-stone.png`)));
    expect(root.userData.mount_y).toBe(-.006);
    const probes = JSON.parse(root.userData.pore_probes_json) as { center: [number, number, number]; radius: number }[];
    expect(probes.length).toBeGreaterThanOrEqual(3);
    for (const probe of probes) {
      expect([...probe.center, probe.radius].every(Number.isFinite)).toBe(true);
      expect(probe.radius).toBeGreaterThan(0);
      const [x, , z] = probe.center, center = surface(root, x, z); expect(center).toBeDefined();
      const ring = Array.from({ length: 8 }, (_, index) => {
        const angle = index * Math.PI / 4, hit = surface(root, x + Math.cos(angle) * probe.radius * 1.25, z + Math.sin(angle) * probe.radius * 1.25);
        expect(hit, "continuous stone around the modeled cavity").toBeDefined();
        return hit.point.y;
      });
      expect(ring.reduce((sum, height) => sum + height, 0) / ring.length - center.point.y, "real geometry below surrounding stone, not painted spots or a normal-map claim").toBeGreaterThan(.0001);
    }
  });

  test("owners have different normalized geometry rather than renamed or recolored copies", () => {
    const digest = (name: string) => {
      const root = scene.getObjectByName(name)!, bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
      const points = vertices(root).map(point => point.sub(bounds.min).divide(size).toArray().map(value => value.toFixed(5)).join(","));
      return hash([...new Set(points)].sort().join(";"));
    };
    expect(digest("light_stone")).not.toBe(digest("dark_stone"));
  });
});
