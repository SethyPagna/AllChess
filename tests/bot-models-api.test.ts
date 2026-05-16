import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/bots/models/route";

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
        missingClient: "scripts/browser-client.mjs",
        fallback: "playwright-plus-live-http-smoke"
      },
      releaseGate: {
        policy: "pass-fallback-validation-when-browser-plugin-unavailable"
      }
    });
    expect(body.trainingGate).toMatchObject({
      claimPolicy: "verified-playable-only",
      requiredCompletionGates: expect.arrayContaining(["native rules", "legal bot moves", "review", "persistence", "E2E fixtures"]),
      notice: expect.stringContaining("not fully trained release bots")
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
  });
});
