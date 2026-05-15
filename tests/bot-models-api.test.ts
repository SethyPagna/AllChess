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
    expect(body.knowledgeIndex.entries).toBeGreaterThan(0);
    expect(body.knowledgeIndex.maxBucketSize).toBeLessThan(body.knowledgeIndex.entries);
    expect(body.strengthBands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "easy", targetElo: 1050, stockfishUciElo: 1320 }),
        expect.objectContaining({ tier: "legend", targetElo: 3190, display: "3190+ engine Elo-style" })
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
