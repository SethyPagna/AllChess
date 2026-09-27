import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep the generated originals intact; only fit and encode runtime artwork.
const source = path.join(process.cwd(), "ops/assets/xiangqi/celadon");
const destination = path.join(process.cwd(), "public/assets/xiangqi/celadon");
const manifest = JSON.parse(await readFile(path.join(source, "prompts.json"), "utf8")) as {
  records: Array<{ name: string; file: string; glyph: string; generationId?: string }>;
};
const roles = ["general", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"];
const glyphs = { red: [..."帥仕相傌俥炮兵"], black: [..."將士象馬車砲卒"] };
const expected = new Map<string, string>(Object.entries(glyphs).flatMap(([owner, faces]) =>
  roles.map((role, index) => [`${owner}-${role}`, faces[index]] as const)));
if (manifest.records.length !== 14 || new Set(manifest.records.map(record => record.name)).size !== 14) {
  throw new Error("Celadon requires fourteen unique Xiangqi faces, seven for each owner.");
}
await mkdir(destination, { recursive: true });
for (const record of manifest.records) {
  if (!record.generationId || expected.get(record.name) !== record.glyph || record.file !== `${record.name}.png`) {
    throw new Error(`Invalid Celadon identity or generation provenance: ${record.name}`);
  }
  const file = path.join(source, record.file);
  const metadata = await sharp(file).metadata(), stats = await sharp(file).stats();
  if (!metadata.hasAlpha || stats.isOpaque) throw new Error(`${record.name} needs genuine transparent alpha`);
  await sharp(file).resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ lossless: true }).toFile(path.join(destination, `${record.name}.webp`));
}
await sharp(path.join(source, "board-colour.png")).resize(1024, 1024).removeAlpha()
  .webp({ quality: 92 }).toFile(path.join(destination, "board-colour.webp"));
console.log("Prepared fourteen transparent Celadon faces and their matching wood board surface.");
