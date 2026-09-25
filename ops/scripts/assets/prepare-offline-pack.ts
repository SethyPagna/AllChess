import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const staticRoot = path.join(root, ".next/static");
const files = (await walk(staticRoot)).filter(file => /\.(js|css|woff2?)$/.test(file)).sort();
const publicFiles = ["assets/khmer/collection.glb", "assets/classic/collection.glb", "assets/shogi/collection.glb", "engines/stockfish/stockfish-18-lite-single.js", "engines/stockfish/stockfish-18-lite-single.wasm", "icons/app-192.png", "icons/app-512.png", "icons/maskable-512.png"];
const sources = [
  { url: "/icon.svg", file: path.join(root, ".next/server/app/icon.svg.body") },
  { url: "/offline", file: path.join(root, ".next/server/app/offline.html") },
  ...files.map(file => ({ url: "/_next/static/" + path.relative(staticRoot, file).split(path.sep).map(encodeURIComponent).join("/"), file })),
  ...publicFiles.map(file => ({ url: "/" + file, file: path.join(root, "public", file) }))
];
const assets = await Promise.all(sources.map(async ({ url, file }) => { const bytes = await readFile(file); return { url, bytes: bytes.length, sha256: hash(bytes) }; }));
const version = hash(JSON.stringify(assets));
await writeFile(path.join(root, "public/offline-pack.json"), JSON.stringify({ version, assets }));
console.log(`Prepared offline play pack: ${assets.length} public assets, ${(assets.reduce((sum, asset) => sum + asset.bytes, 0) / 1024 / 1024).toFixed(1)} MiB.`);
