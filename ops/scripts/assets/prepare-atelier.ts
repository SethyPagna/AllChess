import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Preserve the generated artwork and its alpha. Only resize and encode for delivery.
const root = process.cwd();
const destination = path.join(root, "public/assets/khmer/atelier");
await mkdir(destination, { recursive: true });
for (const side of ["light", "dark"]) for (const piece of ["king", "queen", "bishop", "horse", "rook", "pawn"]) {
  const name = `${side}-${piece}`;
  const source = path.join(root, "ops/assets/khmer/atelier", `${name}.png`);
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${name} must retain a transparent background`);
  await sharp(source).resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ lossless: true }).toFile(path.join(destination, `${name}.webp`));
}
console.log("Prepared 12 transparent Cambodian piece assets.");
