import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/bots/models/route";
import { GET as knowledgeGet } from "@/app/api/bots/knowledge/[variantKey]/route";

describe("bot models API", () => {
  test("reports runtime language strategy and indexed knowledge status", async () => {
    const response = GET();
    const body = await response.json();

    expect(body.runtime).toMatchObject({
      primaryRuntime: "typescript",
      hotPathStrategy: "indexed-typescript-plus-wasm-engines"
    });
    expect(body.runtime.runtimeLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "TypeScript", status: "active" }),
        expect.objectContaining({ language: "WebAssembly/C++", status: "active" })
      ])
    );
    expect(body.runtime.architectureBoundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ boundary: "interactive-runtime", runtime: "TypeScript" }),
        expect.objectContaining({ boundary: "engine-hot-path", runtime: "WebAssembly/C++" })
      ])
    );
    expect(body.runtime.optimizationPolicy).toMatchObject({
      maxInteractiveBotReplyMs: 2800,
      cacheFirst: true,
      offlineTraining: true
    });
    expect(body.runtime.cleanupFindings).toEqual(expect.arrayContaining([expect.stringContaining("S3 client dependency")]));
    expect(body.validationRuntime).toMatchObject({
      browserAutomation: {
        status: "unavailable",
        missingClient: "browser-client.mjs",
        fallback: "playwright-plus-live-http-smoke"
      },
      releaseGate: {
        policy: "pass-fallback-validation-when-browser-plugin-unavailable"
      }
    });
    expect(body.trainingGate).toMatchObject({
      claimPolicy: "verified-playable-only",
      requiredCompletionGates: expect.arrayContaining(["native rules", "legal bot moves", "review", "persistence", "E2E fixtures"]),
      notice: expect.stringContaining("guide-first previews")
    });
    expect(body.trainingGate.gatedVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "jungle",
          claim: "not-fully-trained",
          remainingGates: expect.arrayContaining([expect.stringContaining("E2E")])
        })
      ])
    );
    expect(body.knowledgeIndex.entries).toBeGreaterThan(0);
    expect(body.knowledgeIndex.maxBucketSize).toBeLessThan(body.knowledgeIndex.entries);
    expect(body.trainingSummary).toEqual(
      expect.objectContaining({
        scannedRecords: expect.any(Number),
        generatedPositions: expect.any(Number)
      })
    );
    expect(body.readiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "classic",
          coverageStatus: "active",
          runtimePath: "knowledge-cache",
          badgeLabel: "Cache ready",
          responseTargetMs: 2800,
          knowledgeEntries: expect.any(Number),
          engineLabels: expect.any(Number)
        }),
        expect.objectContaining({
          variantKey: "jungle",
          coverageStatus: "rules-gated",
          runtimePath: "rules-gated",
          badgeLabel: "Rules gated"
        })
      ])
    );
    expect(body.strengthBands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "easy", targetElo: 1050, stockfishUciElo: 1320 }),
        expect.objectContaining({ tier: "legend", targetElo: 3190, display: "3190+ benchmark" })
      ])
    );
    expect(body.trainingChecklists).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "classic",
          coverageStatus: "active",
          difficultyTiers: expect.arrayContaining([
            expect.objectContaining({
              tier: "normal",
              strength: expect.objectContaining({ calibrationStatus: "stockfish-calibrated" })
            }),
            expect.objectContaining({
              tier: "easy",
              targetBehavior: expect.stringContaining("not naive"),
              strength: expect.objectContaining({ calibrationStatus: "allchess-estimated" })
            })
          ])
        }),
        expect.objectContaining({
          variantKey: "jungle",
          coverageStatus: "rules-gated"
        })
      ])
    );
    expect(body.trainingRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^training-/),
          mode: "two-track",
          scannedRecords: expect.any(Number),
          generatedPositions: expect.any(Number),
          runtimeBudgetMs: 2800,
          artifacts: expect.objectContaining({
            compactRuntime: "src/data/bot-knowledge.generated.json",
            largeArtifacts: "r2"
          })
        })
      ])
    );
    expect(body.trainingCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "classic",
          claimStatus: "verified",
          tierCoverage: expect.arrayContaining([
            expect.objectContaining({ tier: "easy", policy: expect.stringContaining("not naive") }),
            expect.objectContaining({ tier: "legend", policy: expect.stringContaining("highest confidence") })
          ])
        }),
        expect.objectContaining({
          variantKey: "jungle",
          claimStatus: "preview-only",
          readiness: "rules-gated"
        })
      ])
    );
    expect(body.tierBenchmarks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tier: "grandmaster",
          benchmarkVersion: expect.any(String),
          latencyTargetMs: 2800,
          fixtureFamilies: expect.arrayContaining(["mate", "rescue", "counterattack", "draw-saving"])
        }),
        expect.objectContaining({
          tier: "legend",
          strongerThan: "grandmaster",
          runtimePolicy: "cache-first"
        })
      ])
    );
  });

  test("knowledge API reports coverage and richer source metadata", async () => {
    const response = await knowledgeGet(new Request("http://allchess.test/api/bots/knowledge/classic"), {
      params: Promise.resolve({ variantKey: "classic" })
    });
    const body = await response.json();

    expect(body.coverage).toMatchObject({
      variantKey: "classic",
      claimStatus: "verified",
      readiness: "active",
      lastTrainingRunId: expect.stringMatching(/^training-/)
    });
    expect(body.entries[0]).toEqual(
      expect.objectContaining({
        positionHash: expect.any(String),
        sourceFileId: expect.any(String),
        sourceLicense: expect.any(String),
        tierTargets: expect.arrayContaining(["legend"]),
        labelDepth: expect.any(Number),
        engine: expect.any(String),
        split: expect.stringMatching(/train|eval|test/),
        generatedAt: expect.any(String)
      })
    );
    expect(body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "opening-book",
          tierTargets: expect.arrayContaining(["easy", "legend"])
        })
      ])
    );
  });
});
