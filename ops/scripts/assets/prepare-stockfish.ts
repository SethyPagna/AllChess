import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "node_modules", "stockfish", "bin");
const targetDir = path.join(root, "public", "engines", "stockfish");
const files = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  const source = path.join(sourceDir, file);
  await stat(source);
  await copyFile(source, path.join(targetDir, file));
}

console.log(`Prepared Stockfish assets in ${path.relative(root, targetDir)}`);
