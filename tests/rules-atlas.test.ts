import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/rules/[variantKey]/route";
import { allVariantRuleSummaries, getVariantRuleSummary } from "@/lib/rules-atlas";
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
    }
  });

  test("captures key native rule differences in plain language", () => {
    expect(getVariantRuleSummary("classic").numberedBasics[1]).toContain("Kings cannot be captured");
    expect(getVariantRuleSummary("xiangqi").numberedBasics[2]).toContain("Flying generals");
    expect(getVariantRuleSummary("shogi").numberedBasics[1]).toContain("Drops");
    expect(getVariantRuleSummary("jungle").numberedBasics[3]).toContain("No check/checkmate");
  });

  test("rules API returns a variant summary and rejects unknown variants", async () => {
    const ok = await GET(new Request("http://allchess.test/api/rules/classic"), { params: Promise.resolve({ variantKey: "classic" }) });
    await expect(ok.json()).resolves.toMatchObject({ variantKey: "classic" });

    const missing = await GET(new Request("http://allchess.test/api/rules/unknown"), { params: Promise.resolve({ variantKey: "unknown" }) });
    expect(missing.status).toBe(404);
  });
});
