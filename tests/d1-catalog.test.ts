import { describe, expect, test } from "vitest";

import { getD1CatalogEntry, listD1CatalogEntries } from "@/lib/cloudflare/d1-catalog";
import type { D1Database } from "@cloudflare/workers-types";

function createCatalogD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return createStatement(sql, values);
        },
        ...createStatement(sql, [])
      };
    }
  } as unknown as D1Database;

  function createStatement(sql: string, values: unknown[]) {
    calls.push({ sql, values });
    return {
      async all() {
        if (sql.includes("from game_catalog_entries")) {
          return {
            results: [
              {
                id: "classic",
                variant_key: "classic",
                family_key: "chess-family",
                english_name: "Classic Chess",
                native_name: null,
                romanization: null,
                aliases: JSON.stringify(["classic", "standard"]),
                region: JSON.stringify(["Global"]),
                board_geometry: JSON.stringify({ kind: "square-grid", rows: 8, cols: 8, description: "8x8 square grid." }),
                piece_presentation: "staunton-svg",
                playability: "playable",
                rules_adapter: "chessops",
                bot_adapter: "fairy-stockfish",
                learning_status: "ready",
                source_links: JSON.stringify([{ name: "FIDE", url: "https://example.com/fide" }]),
                rules_complete: 1,
                bot_complete: 1,
                review_complete: 1,
                persistence_complete: 1,
                e2e_complete: 1,
                known_gaps: JSON.stringify([])
              }
            ]
          };
        }
        if (sql.includes("from rule_sections")) {
          return {
            results: [
              { game_id: "classic", section_type: "basics", body: "Move pieces by FIDE rules.\nKings cannot be captured." },
              { game_id: "classic", section_type: "win", body: "Checkmate\nTimeout with mating material" },
              { game_id: "classic", section_type: "review", body: "Legal moves\nTerminal result" }
            ]
          };
        }
        if (sql.includes("from rule_sources")) {
          return { results: [{ game_id: "classic", name: "FIDE", url: "https://example.com/fide" }] };
        }
        return { results: [] };
      },
      async first() {
        if (sql.includes("from game_aliases")) return { game_id: "classic" };
        return null;
      },
      async run() {
        return { success: true };
      }
    };
  }

  return { db, calls };
}

describe("D1 catalog reader", () => {
  test("hydrates catalog entries from normalized D1 rows", async () => {
    const { db } = createCatalogD1();

    await expect(listD1CatalogEntries(db)).resolves.toEqual([
      expect.objectContaining({
        id: "classic",
        variantKey: "classic",
        family: "chess-family",
        playability: "playable",
        shortRules: ["Move pieces by FIDE rules.", "Kings cannot be captured."],
        winConditions: ["Checkmate", "Timeout with mating material"],
        reviewFocus: ["Legal moves", "Terminal result"],
        ruleSourceLinks: [{ name: "FIDE", url: "https://example.com/fide" }],
        verification: {
          rulesComplete: true,
          botComplete: true,
          reviewComplete: true,
          persistenceComplete: true,
          e2eComplete: true,
          knownGaps: []
        }
      })
    ]);
  });

  test("resolves aliases through normalized D1 search rows", async () => {
    const { db, calls } = createCatalogD1();

    await expect(getD1CatalogEntry(db, "Classic Chess")).resolves.toMatchObject({ id: "classic" });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("from game_aliases"),
          values: ["classicchess"]
        })
      ])
    );
  });
});
