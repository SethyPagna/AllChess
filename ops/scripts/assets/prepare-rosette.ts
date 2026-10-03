import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Preserve generated masters and alpha; runtime derivatives only resize/encode.
const root = process.cwd();
const destination = path.join(root, "public/assets/draughts/rosette");
await mkdir(destination, { recursive: true });
for (const side of ["light", "dark"]) for (const piece of ["man", "king"]) {
  const name = `${side}-${piece}`;
  const source = path.join(root, "ops/assets/draughts/rosette", `${name}.png`);
  const metadata = await sharp(source).metadata();
  const stats = await sharp(source).stats();
  if (!metadata.hasAlpha || stats.isOpaque) throw new Error(`${name} needs genuine transparent alpha`);
  await sharp(source).resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ lossless: true }).toFile(path.join(destination, `${name}.webp`));
}
console.log("Prepared four transparent rosette draughts assets.");
