import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const openNextDir = path.join(process.cwd(), ".open-next");
const workerPath = path.join(openNextDir, "worker.js");
const exportLine = 'export { GameRoomDO, MatchmakingDO, PresenceDO } from "../src/lib/realtime/durable-objects.ts";';

const worker = await readFile(workerPath, "utf8");
if (!worker.includes(exportLine)) {
  await writeFile(workerPath, `${worker.trimEnd()}\n${exportLine}\n`);
}

const defaultFunctionDir = path.join(openNextDir, "server-functions", "default");
await cp(path.join(defaultFunctionDir, ".next", "server"), path.join(defaultFunctionDir, "server"), {
  recursive: true,
  force: true
});

console.log("Patched OpenNext Worker exports and server chunk paths.");
