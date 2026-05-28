import { describe, expect, test } from "vitest";

import { createCatalogRuleSummary } from "@/lib/catalog/rule-summary";
import { getGameCatalogEntry } from "@/lib/catalog";

describe("catalog rule summary", () => {
  test("turns catalog entries into guide-ready rule summaries", () => {
    const entry = getGameCatalogEntry("oware");
    expect(entry).toBeDefined();

    expect(createCatalogRuleSummary(entry!)).toMatchObject({
      variantKey: "oware",
      numberedBasics: expect.arrayContaining([expect.stringContaining("Sow seeds")]),
      completion: {
        status: "rules-gated",
        verifiedEdgeCases: [],
        remainingGates: expect.arrayContaining([expect.stringContaining("Rules, bot, review")])
      }
    });
  });
});
