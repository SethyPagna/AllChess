import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

describe("local cleanup script", () => {
  test("includes Python cache folders created by bot training helpers", () => {
    const repoRoot = process.cwd();
    const pythonRoot = join(repoRoot, "ops", "scripts", "training", "python");
    const bytecodeCache = join(pythonRoot, "__pycache__");
    const pytestCache = join(pythonRoot, ".pytest_cache");

    try {
      mkdirSync(bytecodeCache, { recursive: true });
      mkdirSync(pytestCache, { recursive: true });
      writeFileSync(join(bytecodeCache, "read_zstd_sample.cpython-312.pyc"), "");
      writeFileSync(join(pytestCache, "README.md"), "");

      const output = execFileSync("node", ["ops/scripts/ops/maintenance/clean-local-artifacts.ts", "--dry-run"], {
        cwd: repoRoot,
        encoding: "utf8"
      });

      expect(output).toContain(relative(repoRoot, bytecodeCache));
      expect(output).toContain(relative(repoRoot, pytestCache));
    } finally {
      rmSync(bytecodeCache, { recursive: true, force: true });
      rmSync(pytestCache, { recursive: true, force: true });
    }
  });
});
