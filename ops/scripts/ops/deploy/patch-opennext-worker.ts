import { createHash } from "node:crypto";
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const openNextDir = path.join(process.cwd(), ".open-next");
const workerPath = path.join(openNextDir, "worker.js");
const exportMarker = 'from "./durable-objects/allchess.js";';
const realtimeExports = String.raw`
export {
  GameRoomDO, MatchmakingDO, PresenceDO,
  GameRoomDO as GameRoomDurableObject,
  MatchmakingDO as MatchmakingDurableObject,
  PresenceDO as PresenceDurableObject
} from "./durable-objects/allchess.js";

function allchessRoomSocketRequest(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/socket\/?$/);
  if (!match) return null;
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return Response.json({ error: "WebSocket upgrade required." }, { status: 426 });
  }
  if (!env?.GAME_ROOM_DO) {
    return Response.json({ error: "Realtime room storage is not configured." }, { status: 501 });
  }
  const roomId = decodeURIComponent(match[1]);
  const durableId = env.GAME_ROOM_DO.idFromName(roomId);
  return env.GAME_ROOM_DO.get(durableId).fetch(request);
}
`;

const worker = await readFile(workerPath, "utf8");
if (worker.includes("export class GameRoomDO extends DurableObject")) {
  throw new Error("OpenNext worker contains legacy realtime stubs. Run cf:build to regenerate it before patching.");
}
let patchedWorker = worker.includes(exportMarker) ? worker : `${realtimeExports}\n${worker}`;
const entryPointMarker = "            const url = new URL(request.url);";
if (!patchedWorker.includes("const allchessRealtimeResponse = allchessRoomSocketRequest(request, env);")) {
  if (!patchedWorker.includes(entryPointMarker)) {
    throw new Error("Could not find OpenNext fetch entry point to patch realtime sockets.");
  }
  patchedWorker = patchedWorker.replace(
    entryPointMarker,
    `            const url = new URL(request.url);
            const allchessRealtimeResponse = allchessRoomSocketRequest(request, env);
            if (allchessRealtimeResponse) {
                return allchessRealtimeResponse;
            }`
  );
}

const offlineBytes = await readFile(path.join(process.cwd(), ".next/server/app/offline.html"));
const offlineHtml = offlineBytes.toString("utf8");
const manifest = JSON.parse(await readFile(path.join(process.cwd(), "public/offline-pack.json"), "utf8")) as {
  assets: Array<{ url: string; bytes: number; sha256: string }>;
};
const offlineAssets = manifest.assets.filter(asset => asset.url === "/offline");
if (offlineAssets.length !== 1 || offlineAssets[0].bytes !== offlineBytes.length
  || offlineAssets[0].sha256 !== createHash("sha256").update(offlineBytes).digest("hex")
  || !Buffer.from(offlineHtml).equals(offlineBytes)) {
  throw new Error("The built offline shell does not match the offline pack manifest.");
}
const offlineImport = 'import { allchessOfflineRequest } from "./offline-shell.js";';
if (!patchedWorker.includes(offlineImport)) patchedWorker = `${offlineImport}\n${patchedWorker}`;
if (!patchedWorker.includes("const allchessOfflineResponse = allchessOfflineRequest(request);")) {
  if (!patchedWorker.includes(entryPointMarker)) {
    throw new Error("Could not find OpenNext fetch entry point to patch the offline shell.");
  }
  patchedWorker = patchedWorker.replace(entryPointMarker, `${entryPointMarker}
            const allchessOfflineResponse = allchessOfflineRequest(request);
            if (allchessOfflineResponse) {
                return allchessOfflineResponse;
            }`);
}
const offlineModule = `const shell = ${JSON.stringify(offlineHtml)};
export function allchessOfflineRequest(request) {
  if (!['GET', 'HEAD'].includes(request.method)
    || new URL(request.url).pathname !== '/offline'
    || request.headers.get('RSC') === '1') return null;
  return new Response(request.method === 'HEAD' ? null : shell, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-length': '${offlineBytes.length}',
      'cache-control': 'no-store',
      'vary': 'RSC'
    }
  });
}
`;

await build({
  absWorkingDir: projectRoot,
  entryPoints: ["src/lib/realtime/durable-objects.ts"],
  outfile: path.join(openNextDir, "durable-objects", "allchess.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  external: ["cloudflare:workers"],
  tsconfig: path.join(projectRoot, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' }
});
await writeFile(path.join(openNextDir, "offline-shell.js"), offlineModule);
await writeFile(workerPath, patchedWorker);

const defaultFunctionDir = path.join(openNextDir, "server-functions", "default");
await cp(path.join(defaultFunctionDir, ".next", "server"), path.join(defaultFunctionDir, "server"), {
  recursive: true,
  force: true
});

console.log("Bundled realtime Durable Objects, verified the exact offline shell, and patched OpenNext Worker routing and server chunk paths.");
