import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workerPath = path.join(process.cwd(), ".open-next", "worker.js");
const exportLine = 'export { GameRoomDO, MatchmakingDO, PresenceDO } from "../src/lib/realtime/durable-objects.ts";';

const worker = await readFile(workerPath, "utf8");
if (!worker.includes(exportLine)) {
  await writeFile(workerPath, `${worker.trimEnd()}\n${exportLine}\n`);
}

console.log("Patched OpenNext worker Durable Object exports.");
