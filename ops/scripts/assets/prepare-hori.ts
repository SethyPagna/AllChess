import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Preserve the individually generated originals; only fit and encode runtime art.
const source = path.join(process.cwd(), "ops/assets/shogi/hori");
const destination = path.join(process.cwd(), "public/assets/shogi/hori");
const manifest = JSON.parse(await readFile(path.join(source, "prompts.json"), "utf8")) as {
  records: Array<{ name: string; file: string; glyph: string; generationId?: string }>;
};
if (manifest.records.length !== 15 || new Set(manifest.records.map(record => record.name)).size !== 15) {
  throw new Error("The Carved collection requires fifteen unique faces, including both kings and six promotions.");
}
await mkdir(destination, { recursive: true });
for (const record of manifest.records) {
  if (!record.generationId) throw new Error(`Missing generation provenance for ${record.name}`);
  const file = path.join(source, record.file);
  const metadata = await sharp(file).metadata(), stats = await sharp(file).stats();
  if (!metadata.hasAlpha || stats.isOpaque) throw new Error(`${record.name} needs genuine transparent alpha`);
  await sharp(file).resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ lossless: true }).toFile(path.join(destination, `${record.name}.webp`));
}
console.log("Prepared fifteen transparent Carved Shogi faces.");
await sharp(path.join(source, "board-colour.png")).resize(1024, 1024).removeAlpha()
  .webp({ quality: 92 }).toFile(path.join(destination, "board-colour.webp"));
console.log("Prepared the matching kaya-style board surface.");
