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
await writeFile(workerPath, patchedWorker);

const defaultFunctionDir = path.join(openNextDir, "server-functions", "default");
await cp(path.join(defaultFunctionDir, ".next", "server"), path.join(defaultFunctionDir, "server"), {
  recursive: true,
  force: true
});

console.log("Bundled realtime Durable Objects and patched OpenNext Worker exports and server chunk paths.");
