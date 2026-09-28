/**
 * AllChess Arcade: a static, server-free build of the local play studio.
 *
 * It mounts the real `GameBoard` (bot + pass-and-play, 2D and 3D tabletops,
 * every native piece collection) in a small Vite shell so the result can be
 * hosted from any sub-path, for example inside an iframe at `/play/allchess/`.
 *
 *   npm run build:arcade                         -> dist/arcade
 *   ARCADE_OUT_DIR=/some/dir npm run build:arcade -> /some/dir
 *
 * Differences from the Next.js app, all applied at build time without
 * changing app behaviour:
 * - `/assets/...` and `/engines/...` literals become document-relative, so the
 *   bundle works under any directory (the page itself enforces a trailing slash).
 * - The offline studio's `/offline?game=...` links become `?game=...`.
 * - `next/link` and `next/dynamic` are replaced by tiny shims; any other `next/*`
 *   import fails the build so server-only code cannot slip in.
 * - The ~15 MB bot-knowledge JSON is emitted as a gzip file that is fetched and
 *   decompressed only when a bot first needs to move.
 * - Public assets are copied from the same allow-list as the offline play pack
 *   (models, sprites, table textures, Stockfish WASM); Blender previews and the
 *   service worker are left out.
 */
import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { constants as zlibConstants, gzipSync } from "node:zlib";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig, type Plugin } from "vite";

const arcadeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(arcadeRoot, "../..");
const srcRoot = path.join(repoRoot, "src");
const outDir = process.env.ARCADE_OUT_DIR ? path.resolve(process.env.ARCADE_OUT_DIR) : path.join(repoRoot, "dist", "arcade");
const knowledgeSource = path.join(srcRoot, "data", "bot-knowledge.generated.json");
const knowledgeModuleId = "\0allchess-arcade:bot-knowledge";

/** Same runtime asset list as ops/scripts/assets/prepare-offline-pack.ts. */
const publicFiles = [
  "assets/khmer/atelier.glb", "assets/khmer/courtyard.glb", "assets/classic/marble.glb", "assets/shogi/collection.glb", "assets/shogi/hori.glb",
  "assets/xiangqi/collection.glb", "assets/xiangqi/celadon.glb", "assets/janggi/collection.glb", "assets/makruk/collection.glb",
  "assets/draughts/collection.glb", "assets/draughts/rosette.glb", "assets/draughts/club.glb", "assets/konane/collection.glb",
  "assets/shatranj/collection.glb", "assets/chaturanga/collection.glb", "assets/jungle/collection.glb"
];
const publicDirectories = [
  "assets/classic/marble", "assets/khmer/atelier", "assets/khmer/courtyard", "assets/shogi/hori", "assets/xiangqi/celadon",
  "assets/draughts/rosette", "assets/draughts/club", "assets/materials/wood-table"
];
const stockfishFiles = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

/** Rewrites root-absolute public URLs and offline-studio links inside app sources. */
function arcadeSourcePaths(): Plugin {
  const replacements: Array<[RegExp, string]> = [
    [/(["'`])\/(assets|engines)\//g, "$1$2/"],
    [/(["'`])\/offline\?game=/g, "$1?game="],
    [/Connect to the internet and return to the main app for this mode\./g, "Online matches, friend rooms and spectating are available in the full AllChess app."]
  ];
  return {
    name: "allchess-arcade:source-paths",
    enforce: "pre",
    transform(code, id) {
      if (!id.startsWith(srcRoot) || !/\.(tsx?|jsx?)$/.test(id)) return null;
      let next = code;
      for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
      return next === code ? null : { code: next, map: null };
    }
  };
}

/** Only the shimmed Next.js modules may be bundled; everything else under next/* is server-side. */
function arcadeNextGuard(): Plugin {
  return {
    name: "allchess-arcade:next-guard",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "next" || source.startsWith("next/")) {
        throw new Error(`The arcade build has no shim for "${source}" (imported by ${importer ?? "unknown"}). Add one in ops/arcade/shims or keep the module out of the client graph.`);
      }
      return null;
    }
  };
}

/** Serves the bot knowledge as a lazily fetched, gzip-compressed JSON asset. */
function arcadeBotKnowledge(): Plugin {
  let rawBytes = 0;
  let gzipBytes = 0;
  return {
    name: "allchess-arcade:bot-knowledge",
    enforce: "pre",
    resolveId(source) {
      return source.endsWith("bot-knowledge.generated.json") ? knowledgeModuleId : null;
    },
    async load(id) {
      if (id !== knowledgeModuleId) return null;
      const raw = await readFile(knowledgeSource, "utf8");
      const minified = JSON.stringify(JSON.parse(raw));
      const compressed = gzipSync(minified, { level: zlibConstants.Z_BEST_COMPRESSION });
      rawBytes = Buffer.byteLength(raw);
      gzipBytes = compressed.length;
      const referenceId = this.emitFile({ type: "asset", name: "bot-knowledge.json.gz", source: compressed });
      return `
const fallback = { version: "unavailable", entries: [], engineLabels: [], manifests: [], toolManifests: [], variantCoverage: [], trainingRuns: [] };
async function loadKnowledge() {
  try {
    const response = await fetch(import.meta.ROLLUP_FILE_URL_${referenceId});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Some hosts already decode .gz responses; only decompress real gzip bytes.
    const text = bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
      : new TextDecoder().decode(bytes);
    return JSON.parse(text);
  } catch (error) {
    console.warn("AllChess arcade: bot opening knowledge unavailable, bots will search every move.", error);
    return fallback;
  }
}
export default await loadKnowledge();
`;
    },
    closeBundle() {
      if (rawBytes) console.log(`[arcade] bot knowledge: ${(rawBytes / 1048576).toFixed(1)} MiB JSON -> ${(gzipBytes / 1048576).toFixed(2)} MiB gzip (lazy)`);
    }
  };
}

/**
 * Makes CSS public URLs relative to the emitted stylesheet and copies runtime assets.
 * (Vite reports the two `/assets/.../board-colour.webp` CSS URLs as unresolved at
 * build time; that is expected, they are rewritten here.)
 */
function arcadeStaticAssets(): Plugin {
  return {
    name: "allchess-arcade:static-assets",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") {
          // Guard the sub-path and no-service-worker contracts against future app changes.
          const rootPath = file.code.match(/["'`]\/(assets|engines|icons|offline|sw\.js)\b[^"'`]*/);
          if (rootPath) this.error(`${file.fileName} still references the root-absolute path ${rootPath[0].slice(1)}; add a rewrite in arcadeSourcePaths().`);
          if (file.code.includes("serviceWorker.register")) this.error(`${file.fileName} registers a service worker; keep that module out of the arcade.`);
          continue;
        }
        if (!file.fileName.endsWith(".css")) continue;
        const depth = file.fileName.split("/").length - 1;
        const prefix = depth ? "../".repeat(depth) : "./";
        file.source = String(file.source).replace(/url\((["']?)\/assets\//g, `url($1${prefix}assets/`);
      }
    },
    async writeBundle() {
      const copies: Array<[string, string]> = [
        ...publicFiles.map((file): [string, string] => [path.join(repoRoot, "public", file), file]),
        ...stockfishFiles.map((file): [string, string] => [path.join(repoRoot, "node_modules", "stockfish", "bin", file), `engines/stockfish/${file}`]),
        [path.join(srcRoot, "app", "icon.svg"), "icon.svg"]
      ];
      for (const directory of publicDirectories) {
        for (const entry of await readdir(path.join(repoRoot, "public", directory), { recursive: true, withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const absolute = path.join(entry.parentPath, entry.name);
          copies.push([absolute, path.relative(path.join(repoRoot, "public"), absolute).split(path.sep).join("/")]);
        }
      }
      let total = 0;
      for (const [from, to] of copies) {
        const target = path.join(outDir, to);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(from, target);
        total += (await stat(target)).size;
      }
      console.log(`[arcade] copied ${copies.length} runtime assets (${(total / 1048576).toFixed(1)} MiB) into ${path.relative(repoRoot, outDir) || outDir}`);
    }
  };
}

export default defineConfig({
  root: arcadeRoot,
  base: "./",
  publicDir: false,
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: path.join(arcadeRoot, "shims", "next-link.tsx") },
      { find: /^next\/dynamic$/, replacement: path.join(arcadeRoot, "shims", "next-dynamic.tsx") },
      { find: /^@\//, replacement: `${srcRoot}/` }
    ]
  },
  css: {
    postcss: { plugins: [tailwindcss({ base: repoRoot })] }
  },
  plugins: [arcadeBotKnowledge(), arcadeSourcePaths(), arcadeNextGuard(), arcadeStaticAssets()],
  build: {
    outDir,
    emptyOutDir: true,
    assetsDir: "_app",
    target: "es2022",
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2048
  }
});
