import { spawn } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const shouldRunGitGc = process.argv.includes("--git-gc");

const fixedTargets = [
  ".next",
  ".open-next",
  ".wrangler",
  "test-results",
  "playwright-report",
  "public/engines",
  "tsconfig.tsbuildinfo",
  "supabase",
];

const rootLogPatterns = [
  /^\.next-dev-\d+\.(?:err|out)\.log$/,
  /^tmp-[\w.-]+\.(?:err|out)\.log$/,
];

function assertInsideRepo(targetPath: string): void {
  const relative = path.relative(repoRoot, targetPath);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside repo: ${targetPath}`);
  }
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function collectTargets(): Promise<string[]> {
  const targets = new Set<string>();

  for (const target of fixedTargets) {
    const resolved = path.resolve(repoRoot, target);

    if (await exists(resolved)) {
      targets.add(resolved);
    }
  }

  for (const entry of await readdir(repoRoot)) {
    if (rootLogPatterns.some((pattern) => pattern.test(entry))) {
      targets.add(path.resolve(repoRoot, entry));
    }
  }

  return [...targets].sort((a, b) => a.localeCompare(b));
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

const targets = await collectTargets();

if (targets.length === 0 && !shouldRunGitGc) {
  console.log("No local build artifacts found.");
  process.exit(0);
}

for (const target of targets) {
  assertInsideRepo(target);
  console.log(`${dryRun ? "Would remove" : "Removing"} ${path.relative(repoRoot, target)}`);

  if (!dryRun) {
    await rm(target, { force: true, recursive: true });
  }
}

if (shouldRunGitGc) {
  if (dryRun) {
    console.log("Would run git gc --prune=now");
  } else {
    console.log("Running git gc --prune=now");
    await runCommand("git", ["gc", "--prune=now"]);
  }
}

console.log(`${dryRun ? "Dry run complete" : "Local cleanup complete"}: ${targets.length} artifact target(s)${shouldRunGitGc ? " plus Git maintenance" : ""}.`);
