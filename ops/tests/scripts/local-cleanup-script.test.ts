import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const run = promisify(execFile);
const script = fileURLToPath(new URL("../../scripts/ops/maintenance/clean-local-artifacts.ts", import.meta.url));

// A cold Node start that type-strips the script can take several seconds on a loaded Windows runner.
const spawnTimeoutMs = 60_000;

describe("local cleanup script", () => {
  test("includes Python cache folders created by bot training helpers", async () => {
    // The script cleans its cwd, so run it in a tiny fixture instead of walking and mutating the real repo.
    const fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "allchess-cleanup-")));
    const pythonRoot = join(fixtureRoot, "ops", "scripts", "training", "python");
    const bytecodeCache = join(pythonRoot, "__pycache__");
    const pytestCache = join(pythonRoot, ".pytest_cache");

    try {
      mkdirSync(bytecodeCache, { recursive: true });
      mkdirSync(pytestCache, { recursive: true });
      writeFileSync(join(bytecodeCache, "read_zstd_sample.cpython-312.pyc"), "");
      writeFileSync(join(pytestCache, "README.md"), "");
      writeFileSync(join(pythonRoot, "read_zstd_sample.py"), "");

      const { stdout } = await run(process.execPath, [script, "--dry-run"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        timeout: spawnTimeoutMs
      });

      expect(stdout).toContain(`Would remove ${relative(fixtureRoot, bytecodeCache)}`);
      expect(stdout).toContain(`Would remove ${relative(fixtureRoot, pytestCache)}`);
      expect(stdout).not.toContain("read_zstd_sample.py");
      expect(stdout).toContain("Dry run complete: 2 artifact target(s).");
      expect(existsSync(bytecodeCache)).toBe(true);
      expect(existsSync(pytestCache)).toBe(true);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, spawnTimeoutMs + 10_000);
});
