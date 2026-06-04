import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/rules/[variantKey]/route";
import { allVariantRuleSummaries, findVariantRuleCompletion, getVariantRuleSummary } from "@/lib/variants/rules-atlas";
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
    expect(getVariantRuleSummary("shogi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Nifu")]));
    expect(getVariantRuleSummary("shogi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Pawn-drop mate")]));
    expect(getVariantRuleSummary("shogi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Fourfold repetition")]));
    expect(getVariantRuleSummary("shogi").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("shogi").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("mini-shogi").numberedBasics[0]).toContain("5x5");
    expect(getVariantRuleSummary("mini-shogi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("one-rank promotion")]));
    expect(getVariantRuleSummary("mini-shogi").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("crazyhouse").numberedBasics[1]).toContain("pocket");
    expect(getVariantRuleSummary("crazyhouse").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Captured pieces enter the mover pocket")]));
    expect(getVariantRuleSummary("crazyhouse").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("chaturanga").numberedBasics[0]).toContain("minister");
    expect(getVariantRuleSummary("chaturanga").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bare-king objective")]));
    expect(getVariantRuleSummary("chaturanga").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("shatranj").numberedBasics[0]).toContain("ferz");
    expect(getVariantRuleSummary("shatranj").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bare-king objective")]));
    expect(getVariantRuleSummary("shatranj").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("janggi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("palace diagonals")]));
    expect(getVariantRuleSummary("janggi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bikjang")]));
    expect(getVariantRuleSummary("janggi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("consecutive passes")]));
    expect(getVariantRuleSummary("janggi").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bot seed")]));
    expect(getVariantRuleSummary("janggi").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("janggi").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("janggi").completion.remainingGates).not.toEqual(expect.arrayContaining([expect.stringContaining("Pass/scoring")]));
    expect(getVariantRuleSummary("janggi").completion.remainingGates).not.toEqual(expect.arrayContaining([expect.stringContaining("Facing-general")]));
    expect(getVariantRuleSummary("janggi").completion.remainingGates).not.toEqual(expect.arrayContaining([expect.stringContaining("cannon screens")]));
    expect(getVariantRuleSummary("makruk").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Native Met")]));
    expect(getVariantRuleSummary("makruk").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("makruk").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("makruk").completion.remainingGates).not.toEqual(expect.arrayContaining([expect.stringContaining("promotion fixtures")]));
    expect(getVariantRuleSummary("jungle").numberedBasics[3]).toContain("No check/checkmate");
    expect(getVariantRuleSummary("jungle").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Rat river")]));
    expect(getVariantRuleSummary("jungle").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("jungle").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("english-draughts").numberedBasics[1]).toContain("Captures are compulsory");
    expect(getVariantRuleSummary("english-draughts").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Multi-jump continuation")]));
    expect(getVariantRuleSummary("english-draughts").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("english-draughts").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("antichess").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Mandatory captures")]));
    expect(getVariantRuleSummary("horde").completion.status).toBe("verified-playable");
    expect(getVariantRuleSummary("horde").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("horde-elimination")]));
    expect(getVariantRuleSummary("horde").completion.remainingGates).toEqual([]);
    expect(getVariantRuleSummary("racing-kings").numberedBasics[0]).toContain("no pawns");
    expect(getVariantRuleSummary("racing-kings").completion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Checks are forbidden")]));
    expect(getVariantRuleSummary("racing-kings").completion.remainingGates).toEqual([]);
  });

  test("returns nullable completion for optional detail page lookups", () => {
    expect(findVariantRuleCompletion("classic")?.status).toBe("verified-playable");
    expect(findVariantRuleCompletion("unknown")).toBeNull();
  });

  test("rules API returns a variant summary and rejects unknown variants", async () => {
    const ok = await GET(new Request("http://allchess.test/api/rules/classic"), { params: Promise.resolve({ variantKey: "classic" }) });
    await expect(ok.json()).resolves.toMatchObject({ variantKey: "classic" });

    const missing = await GET(new Request("http://allchess.test/api/rules/unknown"), { params: Promise.resolve({ variantKey: "unknown" }) });
    expect(missing.status).toBe(404);
  });
});
