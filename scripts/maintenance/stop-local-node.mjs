import { execFileSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");

const candidates = process.platform === "win32" ? findWindowsNodeProcesses(root) : findUnixNodeProcesses(root);
const targets = candidates.filter((candidate) => candidate.pid !== process.pid);

if (!targets.length) {
  console.log("No AllChess Node processes are running.");
  process.exit(0);
}

for (const target of targets) {
  const command = target.commandLine.replace(/\s+/g, " ").trim();
  console.log(`${dryRun ? "Would stop" : "Stopping"} node PID ${target.pid}: ${command}`);
  if (!dryRun) {
    try {
      process.kill(target.pid, "SIGTERM");
    } catch (error) {
      console.warn(`Could not stop PID ${target.pid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

console.log(`${dryRun ? "Dry run complete" : "Stopped"} ${targets.length} AllChess Node process(es).`);

function findWindowsNodeProcesses(workspaceRoot) {
  const script = [
    "$root = [Environment]::GetEnvironmentVariable('ALLCHESS_WORKSPACE_ROOT')",
    "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($root) } | Select-Object @{Name='pid';Expression={[int]$_.ProcessId}}, @{Name='commandLine';Expression={$_.CommandLine}} | ConvertTo-Json -Compress"
  ].join("\n");

  const output = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, ALLCHESS_WORKSPACE_ROOT: workspaceRoot }
  }).trim();

  return parseJsonProcessList(output);
}

function findUnixNodeProcesses(workspaceRoot) {
  const output = execFileSync("ps", ["-eo", "pid=,command="], { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      return { pid: Number(match[1]), commandLine: match[2] };
    })
    .filter((entry) => entry && entry.commandLine.includes("node") && entry.commandLine.includes(workspaceRoot));
}

function parseJsonProcessList(output) {
  if (!output) return [];
  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((entry) => ({
    pid: Number(entry.pid),
    commandLine: String(entry.commandLine ?? "")
  }));
}
