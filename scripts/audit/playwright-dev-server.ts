import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";

const build =
  process.platform === "win32"
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run build"], { stdio: "inherit" })
    : spawnSync("npm", ["run", "build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

copyStandaloneAssets();

const next = spawn(
  process.execPath,
  [".next/standalone/server.js"],
  {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3210" },
    stdio: "inherit"
  }
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

function copyStandaloneAssets() {
  copyDirectory(".next/static", ".next/standalone/.next/static");
  copyDirectory("public", ".next/standalone/public");
}

function copyDirectory(source: string, destination: string): void {
  if (!existsSync(source)) return;
  rmSync(destination, { force: true, recursive: true });
  cpSync(source, destination, { recursive: true });
}
