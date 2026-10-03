import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep individual generated masters untouched; only resize and encode runtime art.
const root = process.cwd();
const destination = path.join(root, "public/assets/khmer/courtyard");
await mkdir(destination, { recursive: true });
for (const side of ["light", "dark"]) for (const piece of ["king", "queen", "bishop", "horse", "rook", "pawn"]) {
  const name = `${side}-${piece}`;
  const source = path.join(root, "ops/assets/khmer/courtyard", `${name}.png`);
  const metadata = await sharp(source).metadata();
  const stats = await sharp(source).stats();
  if (!metadata.hasAlpha || stats.isOpaque) throw new Error(`${name} needs genuine transparent alpha`);
  await sharp(source).resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ lossless: true }).toFile(path.join(destination, `${name}.webp`));
}
console.log("Prepared twelve transparent Courtyard pieces.");
