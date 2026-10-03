import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "ops/assets/konane/shore");
const destination = path.join(process.cwd(), "public/assets/konane/shore");
const manifest = JSON.parse(await readFile(path.join(source, "source.json"), "utf8")) as {
  assets: Array<{ name: string; file: string; generationId: string; transparentBackground: boolean }>;
};
const expected = ["light-stone", "dark-stone", "board-colour"];
if (manifest.assets.length !== 3 || expected.some(name => !manifest.assets.some(asset => asset.name === name))) {
  throw new Error("Shore requires two independently generated stones and one board surface.");
}
await mkdir(destination, { recursive: true });
const files = [];
for (const asset of manifest.assets) {
  if (asset.file !== `${asset.name}.png` || !/^exec-[a-f0-9-]{36}$/.test(asset.generationId)) {
    throw new Error(`Invalid Shore source identity: ${asset.name}`);
  }
  const bytes = await readFile(path.join(source, asset.file));
  const metadata = await sharp(bytes).metadata(), stats = await sharp(bytes).stats();
  const piece = asset.name !== "board-colour";
  if (piece && (!asset.transparentBackground || !metadata.hasAlpha || stats.isOpaque)) {
    throw new Error(`${asset.name} requires genuine transparent alpha`);
  }
  const runtime = path.join(destination, `${asset.name}.webp`);
  if (piece) {
    await sharp(bytes).resize(512, 512, { fit: "contain", background: "#00000000" }).webp({ lossless: true }).toFile(runtime);
  } else {
    await sharp(bytes).resize(1024, 1024).removeAlpha().webp({ quality: 92 }).toFile(runtime);
  }
  const encoded = await readFile(runtime);
  files.push({ name: asset.name, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    runtimeSha256: createHash("sha256").update(encoded).digest("hex"), bytes: encoded.length });
}
await writeFile(path.join(source, "prepared.json"), JSON.stringify({ files }, null, 2) + "\n");
console.log(`Prepared Shore: ${files.reduce((sum, file) => sum + file.bytes, 0)} bytes across two transparent stones and one stone surface.`);
