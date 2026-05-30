import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("bot knowledge training script", () => {
  test("delegates local AI dataset probes to Python helper scripts", () => {
    const repoRoot = process.cwd();
    const trainingScript = readFileSync(join(repoRoot, "ops", "scripts", "training", "train-bot-knowledge.ts"), "utf8");

    expect(existsSync(join(repoRoot, "ops", "scripts", "training", "python", "read_zstd_sample.py"))).toBe(true);
    expect(existsSync(join(repoRoot, "ops", "scripts", "training", "python", "inspect_parquet_readiness.py"))).toBe(true);
    expect(existsSync(join(repoRoot, "ops", "scripts", "training", "python", "check_local_ai_readiness.py"))).toBe(true);
    expect(trainingScript).toContain("pythonHelpersDir");
    expect(trainingScript).toContain("read_zstd_sample.py");
    expect(trainingScript).toContain("inspect_parquet_readiness.py");
    expect(trainingScript).not.toContain("import io, sys, zstandard");
    expect(trainingScript).not.toContain("import pyarrow.parquet");
  });

  test("exposes a Python readiness probe for local bot and AI dataset tooling", () => {
    const repoRoot = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["bots:local-ai:check"]).toBe("python ops/scripts/training/python/check_local_ai_readiness.py");
  });

  test("records checksums, variant sources, tier coverage, and parquet readiness", () => {
    const root = mkdtempSync(join(tmpdir(), "allchess-training-"));
    const dataRoot = join(root, "CHESS DATA");
    const output = join(root, "knowledge.json");

    try {
      mkdirSync(join(dataRoot, "classic"), { recursive: true });
      mkdirSync(join(dataRoot, "chess960"), { recursive: true });
      mkdirSync(join(dataRoot, "antichess"), { recursive: true });
      mkdirSync(join(dataRoot, "chess"), { recursive: true });
      mkdirSync(join(dataRoot, "archive"), { recursive: true });
      writeFileSync(
        join(dataRoot, "classic", "mini.pgn"),
        ['[Event "Mini"]', '[Variant "Standard"]', "", "1. e4 e5 2. Nf3 Nc6 1-0"].join("\n")
      );
      writeFileSync(
        join(dataRoot, "chess960", "mini.pgn"),
        ['[Event "Mini960"]', '[Variant "Chess960"]', "", "1. e4 e5 2. Nf3 Nc6 1-0"].join("\n")
      );
      writeFileSync(
        join(dataRoot, "antichess", "mini.pgn"),
        ['[Event "MiniAnti"]', '[Variant "Antichess"]', "", "1. e3 e6 2. Qh5 Qh4 1-0"].join("\n")
      );
      writeFileSync(join(dataRoot, "chess", "train-00000.parquet"), "placeholder");
      writeFileSync(join(dataRoot, "archive", "old.pgn"), ['[Event "Archived"]', "", "1. e4 e5 1-0"].join("\n"));

      execFileSync(
        "node",
        [
          "ops/scripts/training/train-bot-knowledge.ts",
          "--data-root",
          dataRoot,
          "--output",
          output,
          "--max-games",
          "3",
          "--max-puzzles",
          "0",
          "--max-opening-ply",
          "4",
          "--allow-regression",
          "true"
        ],
        { cwd: process.cwd(), stdio: "pipe" }
      );

      const generated = JSON.parse(readFileSync(output, "utf8"));
      const archived = generated.manifests.find((manifest: { path: string }) => manifest.path.includes("archive/"));
      const chess960 = generated.manifests.find((manifest: { variantKey: string }) => manifest.variantKey === "chess960");
      const antichess = generated.manifests.find((manifest: { variantKey: string }) => manifest.variantKey === "antichess");
      const parquet = generated.manifests.find((manifest: { kind: string }) => manifest.kind === "parquet");

      expect(archived).toBeUndefined();
      expect(chess960).toEqual(
        expect.objectContaining({
          checksum: expect.stringMatching(/^sha256:/),
          readStatus: "sampled",
          sampledRecords: 1
        })
      );
      expect(antichess).toEqual(expect.objectContaining({ readStatus: "sampled", sampledRecords: 1 }));
      expect(parquet.readStatus).toMatch(/skipped-pyarrow|sampled-parquet/);
      expect(generated.trainingRuns[0]).toMatchObject({
        mode: "two-track",
        sourceRoot: expect.not.stringContaining("CHESS DATA"),
        scannedRecords: expect.any(Number),
        runtimeBudgetMs: 2800
      });
      expect(generated.sourceRoot).not.toBe("CHESS DATA");
      expect(generated.variantCoverage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ variantKey: "classic", claimStatus: "verified" }),
          expect.objectContaining({ variantKey: "chess960", claimStatus: "verified" }),
          expect.objectContaining({ variantKey: "antichess", claimStatus: "verified" })
        ])
      );
      expect(generated.entries[0]).toEqual(
        expect.objectContaining({
          tierTargets: expect.arrayContaining(["easy", "legend"]),
          positionHash: expect.any(String),
          sourceFileId: expect.any(String),
          sourceLicense: expect.any(String),
          labelDepth: expect.any(Number),
          engine: expect.any(String),
          split: expect.stringMatching(/train|eval|test/),
          generatedAt: expect.any(String)
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
