import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type StudioBake = {
  width: number;
  height: number;
  halfFloats: string;
  gpu: string;
  pmremMs: number;
  gpuReadbackMs: number;
  mapping: THREE.AnyMapping;
  colorSpace: string;
  type: THREE.TextureDataType;
};

type UploadValidation = {
  width: number;
  height: number;
  mismatches: number;
  hdrDecodeMs: number;
  uploadCopyReadbackMs: number;
  flipY: boolean;
  colorSpace: string;
  minFilter: THREE.MinificationTextureFilter;
  magFilter: THREE.MagnificationTextureFilter;
  generateMipmaps: boolean;
  mapping: THREE.AnyMapping;
};

type BrowserGlobals = typeof globalThis & {
  studioBake?: StudioBake;
  validateStudioUpload: (dataURL: string) => Promise<UploadValidation>;
};

type NumericValidation = {
  samples: number;
  minimum: number;
  maximum: number;
  maximumError: number;
  rmsError: number;
  maximumNormalizedError: number;
  alphaNotOne: number;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const output = path.join(root, "public/assets/materials/studio-room.hdr");
const provenance = path.join(root, "ops/assets/materials/studio-room-source.json");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--channel")) {
  throw new Error("Usage: node ops/scripts/assets/prepare-studio-environment.ts [--channel chrome]");
}
const channel = args[1];
const threePackage = JSON.parse(await readFile(path.join(root, "node_modules/three/package.json"), "utf8")) as { version: string };
if (threePackage.version !== "0.186.0") throw new Error("This bake requires Three.js 0.186.0.");

function browserProgram(): void {
  const browserGlobals = globalThis as BrowserGlobals;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const start = performance.now();
  const target = generator.fromScene(environment, .04);
  const generated = performance.now();
  const pixels = new Uint16Array(target.width * target.height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  const read = performance.now();
  if (renderer.getContext().getError()) throw new Error("PMREM readback failed.");
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const bytes = new Uint8Array(pixels.buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  browserGlobals.studioBake = {
    width: target.width,
    height: target.height,
    halfFloats: globalThis.btoa(binary),
    gpu: String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    pmremMs: generated - start,
    gpuReadbackMs: read - generated,
    mapping: target.texture.mapping,
    colorSpace: target.texture.colorSpace,
    type: target.texture.type,
  };
  environment.dispose();
  generator.dispose();
  target.dispose();

  browserGlobals.validateStudioUpload = async (dataURL: string): Promise<UploadValidation> => {
    const start = performance.now();
    const texture = await new HDRLoader().loadAsync(dataURL);
    const decoded = performance.now();
    texture.mapping = THREE.CubeUVReflectionMapping;
    const { width, height, data } = texture.image;
    if (!(data instanceof Uint16Array)) throw new Error("HDR loader did not produce half-float pixels.");
    const copy = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false,
    });
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { atlas: { value: texture } },
      vertexShader: "in vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: "precision highp float; uniform sampler2D atlas; out vec4 result; void main() { result = texelFetch(atlas, ivec2(gl_FragCoord.xy), 0); }",
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    renderer.setRenderTarget(copy);
    renderer.render(scene, new THREE.Camera());
    const uploaded = new Uint16Array(width * height * 4);
    renderer.readRenderTargetPixels(copy, 0, 0, width, height, uploaded);
    if (gl.getError()) throw new Error("HDR GPU validation failed.");
    let mismatches = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const original = (y * width + x) * 4;
      const encoded = ((height - 1 - y) * width + x) * 4;
      for (let c = 0; c < 3; c++) if (uploaded[original + c] !== data[encoded + c]) mismatches++;
    }
    const result = {
      width, height, mismatches,
      hdrDecodeMs: decoded - start,
      uploadCopyReadbackMs: performance.now() - decoded,
      flipY: texture.flipY,
      colorSpace: texture.colorSpace,
      minFilter: texture.minFilter,
      magFilter: texture.magFilter,
      generateMipmaps: texture.generateMipmaps,
      mapping: texture.mapping,
    };
    geometry.dispose(); material.dispose(); copy.dispose(); texture.dispose();
    renderer.dispose();
    return result;
  };
}

function encodeChannel(values: Uint8Array): Buffer<ArrayBuffer> {
  const encoded: number[] = [];
  let index = 0;
  while (index < values.length) {
    let run = 1;
    while (run < 127 && index + run < values.length && values[index + run] === values[index]) run++;
    if (run >= 4) {
      encoded.push(128 + run, values[index]);
      index += run;
      continue;
    }
    const start = index;
    index += run;
    while (index < values.length && index - start < 128) {
      run = 1;
      while (run < 4 && index + run < values.length && values[index + run] === values[index]) run++;
      if (run === 4) break;
      index += Math.min(run, 128 - (index - start));
    }
    encoded.push(index - start, ...values.subarray(start, index));
  }
  return Buffer.from(encoded);
}

function encodeRadiance(pixels: Uint16Array, width: number, height: number): Buffer<ArrayBuffer> {
  if (width < 8 || width > 32767) throw new Error("Width is outside Radiance scanline RLE bounds.");
  const chunks = [Buffer.from(`#?RADIANCE\n# Three.js 0.186.0 RoomEnvironment PMREM sigma=0.04\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`)];
  const channels = Array.from({ length: 4 }, () => new Uint8Array(width));
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const rgb = [0, 1, 2].map(c => THREE.DataUtils.fromHalfFloat(pixels[offset + c]));
      if (rgb.some(value => !Number.isFinite(value) || value < 0)) throw new Error("Invalid linear radiance.");
      const maximum = Math.max(...rgb);
      const exponent = maximum > 1e-32 ? Math.floor(Math.log2(maximum)) + 1 : -128;
      const scale = maximum > 1e-32 ? 256 / 2 ** exponent : 0;
      for (let c = 0; c < 3; c++) channels[c][x] = Math.min(255, Math.floor(rgb[c] * scale));
      channels[3][x] = exponent + 128;
    }
    chunks.push(Buffer.from([2, 2, width >> 8, width & 255]));
    for (const values of channels) chunks.push(encodeChannel(values));
  }
  return Buffer.concat(chunks);
}

function validateRadiance(hdr: Buffer<ArrayBuffer>, pixels: Uint16Array, width: number, height: number): NumericValidation {
  const buffer = hdr.buffer.slice(hdr.byteOffset, hdr.byteOffset + hdr.byteLength);
  const full = new HDRLoader().setDataType(THREE.FloatType).parse(buffer) as THREE.DataTextureLoaderTexData & { data: Float32Array };
  const half = new HDRLoader().setDataType(THREE.HalfFloatType).parse(buffer) as THREE.DataTextureLoaderTexData & { data: Uint16Array };
  if (full.width !== width || full.height !== height || half.width !== width || half.height !== height) throw new Error("HDR dimensions changed.");
  let maximum = 0, minimum = Infinity, maximumError = 0, squaredError = 0, maximumNormalizedError = 0;
  let samples = 0, alphaNotOne = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const original = (y * width + x) * 4;
    const encoded = ((height - 1 - y) * width + x) * 4;
    const peak = Math.max(...[0, 1, 2].map(c => THREE.DataUtils.fromHalfFloat(pixels[original + c])));
    const bin = peak > 1e-32 ? 2 ** (Math.floor(Math.log2(peak)) + 1) / 255 : 0;
    if (THREE.DataUtils.fromHalfFloat(pixels[original + 3]) !== 1) alphaNotOne++;
    for (let c = 0; c < 3; c++) {
      const value = THREE.DataUtils.fromHalfFloat(pixels[original + c]);
      const decoded = full.data[encoded + c];
      const rounded = THREE.DataUtils.fromHalfFloat(half.data[encoded + c]);
      const tolerance = bin + Math.abs(decoded) / 1024 + 2 ** -24;
      if (!Number.isFinite(decoded) || !Number.isFinite(rounded) || Math.abs(decoded - value) > bin + Math.abs(decoded) * 2 ** -23 + 1e-32 || Math.abs(rounded - value) > tolerance) {
        throw new Error(`RGBE quantization exceeded at pixel ${x},${y}, channel ${c}.`);
      }
      const error = Math.abs(rounded - value);
      maximum = Math.max(maximum, value); minimum = Math.min(minimum, value);
      maximumError = Math.max(maximumError, error);
      maximumNormalizedError = Math.max(maximumNormalizedError, peak ? error / peak : 0);
      squaredError += error * error;
      samples++;
    }
  }
  return { samples, minimum, maximum, maximumError, rmsError: Math.sqrt(squaredError / samples), maximumNormalizedError, alphaNotOne };
}

const bundled = await build({
  stdin: {
    contents: `import * as THREE from 'three'; import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'; import {HDRLoader} from 'three/addons/loaders/HDRLoader.js'; (${browserProgram.toString()})();`,
    resolveDir: root,
    sourcefile: "studio-environment-bake.js",
  },
  bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
});
const started = performance.now();
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, serviceWorkers: "block" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.abort());
  await page.setContent("<!doctype html><title>Local studio environment bake</title>");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const bake = await page.evaluate(() => (globalThis as BrowserGlobals).studioBake);
  if (!bake || bake.width !== 768 || bake.height !== 1024 || bake.mapping !== THREE.CubeUVReflectionMapping || bake.type !== THREE.HalfFloatType || bake.colorSpace !== THREE.LinearSRGBColorSpace) throw new Error("Unexpected PMREM layout or storage.");
  const { halfFloats, ...source } = bake;
  const bytes = Buffer.from(halfFloats, "base64");
  const pixels = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const encodingStarted = performance.now();
  const hdr = encodeRadiance(pixels, bake.width, bake.height);
  const encoded = performance.now();
  const numeric = validateRadiance(hdr, pixels, bake.width, bake.height);
  const validated = performance.now();
  const upload = await page.evaluate(dataURL => (globalThis as BrowserGlobals).validateStudioUpload(dataURL), `data:application/octet-stream;base64,${hdr.toString("base64")}`);
  if (upload.mismatches || upload.width !== bake.width || upload.height !== bake.height || !upload.flipY || upload.colorSpace !== THREE.LinearSRGBColorSpace || upload.minFilter !== THREE.LinearFilter || upload.magFilter !== THREE.LinearFilter || upload.generateMipmaps) throw new Error(`GPU atlas validation failed: ${JSON.stringify(upload)}`);
  if (errors.length) throw new Error(errors.join("\n"));
  const sha256 = createHash("sha256").update(hdr).digest("hex");
  const locations: [number, number][] = [
    [128, 895], [384, 895], [640, 895], [128, 639], [384, 639], [640, 639],
    [64, 447], [192, 447], [320, 447], [64, 319], [192, 319], [320, 319],
    [32, 223], [96, 159], [160, 159], [16, 111], [48, 79], [80, 79],
    [8, 55], [24, 39], [40, 39], [56, 23], [104, 7], [767, 0],
  ];
  const probes = locations.map(([x, y]) => ({
    x, y,
    originalRGB: [0, 1, 2].map(c => THREE.DataUtils.fromHalfFloat(pixels[((bake.height - 1 - y) * bake.width + x) * 4 + c])),
  }));
  await mkdir(path.dirname(provenance), { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, hdr);
  await writeFile(provenance, `${JSON.stringify({
    three: threePackage.version,
    source: "three/addons/environments/RoomEnvironment.js",
    method: "PMREMGenerator.fromScene",
    parameters: { sigma: .04, near: .1, far: 100, size: 256, position: [0, 0, 0] },
    width: bake.width, height: bake.height, bytes: hdr.length, sha256,
    storage: "Radiance RGBE, FORMAT=32-bit_rle_rgbe, -Y +X",
    mapping: "CubeUVReflectionMapping", colorSpace: "LinearSRGBColorSpace", flipY: true,
    toneMappingBaked: false, exposureScale: 1,
    probeCoordinates: "top-down atlas pixels; RGB values are original half-float render-target radiance before RGBE encoding",
    tolerance: {
      float: "2^(floor(log2(max(originalRGB)))+1)/255 + abs(decodedFloat)*2^-23",
      half: "2^(floor(log2(max(originalRGB)))+1)/255 + abs(decodedFloat)/1024 + 2^-24",
      zeroPixel: "0 float; 2^-24 half",
    },
    probes,
  }, null, 2)}\n`);
  console.log(JSON.stringify({
    output: path.relative(root, output).replaceAll("\\", "/"),
    three: threePackage.version,
    browser: browser.version(),
    channel: channel ?? "bundled",
    bytes: hdr.length,
    sha256,
    source, numeric, upload,
    timings: { encodeMs: encoded - encodingStarted, validateMs: validated - encoded, totalMs: performance.now() - started },
  }, null, 2));
} finally {
  await browser.close();
}
