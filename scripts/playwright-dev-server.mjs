import { spawn, spawnSync } from "node:child_process";

const prepare = spawnSync(process.execPath, ["scripts/prepare-stockfish.mjs"], { stdio: "inherit" });
if (prepare.status !== 0) process.exit(prepare.status ?? 1);

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3210"],
  { stdio: "inherit" }
);

const shutdown = () => {
  if (!next.killed) next.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
