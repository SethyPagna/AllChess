import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/rules/[variantKey]/route";
import { allVariantRuleSummaries, getVariantRuleSummary } from "@/lib/variants/rules-atlas";
import { variantCatalog } from "@/lib/variants";

describe("rules atlas", () => {
  test("provides a numbered summary for every launch variant", () => {
    const summaries = allVariantRuleSummaries();

    expect(summaries.map((summary) => summary.variantKey)).toEqual(variantCatalog.map((variant) => variant.key));
    for (const summary of summaries) {
      expect(summary.numberedBasics).toHaveLength(4);
      expect(summary.sourceLinks.length).toBeGreaterThanOrEqual(1);
      expect(summary.winConditions.length).toBeGreaterThanOrEqual(1);
      expect(summary.illegalMoveNotes.length).toBeGreaterThanOrEqual(1);
      expect(summary.completion.verifiedEdgeCases.length + summary.completion.remainingGates.length).toBeGreaterThan(0);
    }
  });

  test("captures key native rule differences in plain language", () => {
    expect(getVariantRuleSummary("classic").numberedBasics[1]).toContain("Kings cannot be captured");
    expect(getVariantRuleSummary("classic").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bare kings")]));
    expect(getVariantRuleSummary("xiangqi").numberedBasics[2]).toContain("Flying generals");
    expect(getVariantRuleSummary("xiangqi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("stalemate-loss")]));
    expect(getVariantRuleSummary("shogi").numberedBasics[1]).toContain("Drops");
    expect(getVariantRuleSummary("shogi").completion.remainingGates).toEqual(expect.arrayContaining([expect.stringContaining("Nifu")]));
    expect(getVariantRuleSummary("jungle").numberedBasics[3]).toContain("No check/checkmate");
    expect(getVariantRuleSummary("jungle").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Rat river")]));
    expect(getVariantRuleSummary("jungle").completion.remainingGates).toEqual(expect.arrayContaining([expect.stringContaining("E2E")]));
    expect(getVariantRuleSummary("antichess").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Mandatory captures")]));
    expect(getVariantRuleSummary("horde").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("horde-elimination")]));
    expect(getVariantRuleSummary("horde").completion.remainingGates).toEqual(expect.arrayContaining([expect.stringContaining("E2E")]));
  });

  test("rules API returns a variant summary and rejects unknown variants", async () => {
    const ok = await GET(new Request("http://allchess.test/api/rules/classic"), { params: Promise.resolve({ variantKey: "classic" }) });
    await expect(ok.json()).resolves.toMatchObject({ variantKey: "classic" });

    const missing = await GET(new Request("http://allchess.test/api/rules/unknown"), { params: Promise.resolve({ variantKey: "unknown" }) });
    expect(missing.status).toBe(404);
  });
});
