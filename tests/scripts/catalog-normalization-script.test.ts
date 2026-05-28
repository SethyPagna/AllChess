import { describe, expect, test } from "vitest";

import { buildCatalogNormalizationSql, normalizeAlias } from "../../scripts/data/sync-catalog-d1";

const sampleEntries = [
  {
    id: "jungle",
    variantKey: "jungle",
    name: {
      english: "Jungle",
      native: "鬥獸棋",
      romanization: "Dou Shou Qi",
      short: "Jungle / Dou Shou Qi"
    },
    aliases: ["animal chess", "dou-shou-qi"],
    family: "asian-chess",
    region: ["China", "East Asia"],
    board: { kind: "square-grid", rows: 7, cols: 9, description: "7x9 animal board." },
    piecePresentation: "jungle-animals",
    playability: "learn",
    rulesAdapter: "internal-jungle",
    botAdapter: "internal-search",
    learningStatus: "ready",
    ruleSourceLinks: [{ name: "Sample rules", url: "https://example.com/rules" }],
    shortRules: ["Animals capture by rank.", "Traps weaken pieces."],
    winConditions: ["Enter the opponent den."],
    reviewFocus: ["Den pressure", "Trap tactics"],
    verification: {
      rulesComplete: false,
      botComplete: false,
      reviewComplete: false,
      persistenceComplete: false,
      e2eComplete: false,
      knownGaps: ["Den-entry fixture pending."]
    }
  }
];

describe("catalog D1 normalization script", () => {
  test("normalizes aliases for English, romanized, and native search", () => {
    expect(normalizeAlias("Dou Shou Qi")).toBe("doushouqi");
    expect(normalizeAlias("Jungle / Dou Shou Qi")).toBe("jungledoushouqi");
    expect(normalizeAlias("鬥獸棋")).toBe("鬥獸棋");
  });

  test("generates deterministic catalog, rules, and verification SQL", () => {
    const { sql, counts } = buildCatalogNormalizationSql(sampleEntries, { now: "2026-05-19T00:00:00.000Z" });

    expect(counts).toMatchObject({
      entries: 1,
      aliases: 7,
      regions: 2,
      ruleSources: 1,
      ruleSections: 3,
      verificationRows: 1
    });
    expect(sql).toContain("delete from game_aliases;");
    expect(sql).toContain("insert into game_catalog_entries");
    expect(sql).toContain("'jungle'");
    expect(sql).toContain("'doushouqi'");
    expect(sql).toContain("insert or replace into rule_sources");
    expect(sql).toContain("insert or replace into rule_sections");
    expect(sql).toContain("insert or replace into playable_game_verification");
    expect(sql).toContain("'[\"Den-entry fixture pending.\"]'");
  });
});
