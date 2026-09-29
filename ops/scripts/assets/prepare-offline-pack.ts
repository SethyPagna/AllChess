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
const publicFiles = ["assets/khmer/atelier.glb", "assets/khmer/courtyard.glb", "assets/classic/marble.glb", "assets/shogi/collection.glb", "assets/shogi/hori.glb", "assets/xiangqi/collection.glb", "assets/xiangqi/celadon.glb", "assets/janggi/collection.glb", "assets/makruk/collection.glb", "assets/draughts/collection.glb", "assets/draughts/rosette.glb", "assets/draughts/club.glb", "assets/konane/collection.glb", "assets/shatranj/collection.glb", "assets/chaturanga/collection.glb", "assets/jungle/collection.glb", "engines/stockfish/stockfish-18-lite-single.js", "engines/stockfish/stockfish-18-lite-single.wasm", "icons/app-192.png", "icons/app-512.png", "icons/maskable-512.png"];
const sources = [
  { url: "/assets/materials/studio-room.hdr", file: path.join(root, "public/assets/materials/studio-room.hdr") },
  { url: "/manifest.webmanifest", file: path.join(root, ".next/server/app/manifest.webmanifest.body") },
  { url: "/icon.svg", file: path.join(root, ".next/server/app/icon.svg.body") },
  { url: "/offline", file: path.join(root, ".next/server/app/offline.html") },
  ...files.map(file => ({ url: "/_next/static/" + path.relative(staticRoot, file).split(path.sep).map(encodeURIComponent).join("/"), file })),
  ...publicFiles.map(file => ({ url: "/" + file, file: path.join(root, "public", file) }))
];
for (const directory of ["assets/classic/marble", "assets/khmer/atelier", "assets/khmer/courtyard", "assets/shogi/hori", "assets/xiangqi/celadon", "assets/draughts/rosette", "assets/draughts/club", "assets/materials/wood-table"]) {
  for (const file of await walk(path.join(root,"public",directory))) {
    sources.push({url:"/"+path.relative(path.join(root,"public"),file).split(path.sep).join("/"),file});
  }
}
const assets = await Promise.all(sources.map(async ({ url, file }) => { const bytes = await readFile(file); return { url, bytes: bytes.length, sha256: hash(bytes) }; }));
const version = hash(JSON.stringify(assets));
await writeFile(path.join(root, "public/offline-pack.json"), JSON.stringify({ version, assets }));
console.log(`Prepared offline play pack: ${assets.length} public assets, ${(assets.reduce((sum, asset) => sum + asset.bytes, 0) / 1024 / 1024).toFixed(1)} MiB.`);
