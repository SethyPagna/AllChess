import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const schema = readFileSync(join(process.cwd(), "migrations", "0001_allchess_cloudflare_schema.sql"), "utf8").toLowerCase();

describe("cloudflare d1 schema", () => {
  test("creates the tables used by auth, gameplay, rooms, analysis, and bot metadata", () => {
    for (const table of [
      "profiles",
      "accounts",
      "sessions",
      "passkeys",
      "games",
      "moves",
      "rooms",
      "ratings",
      "analysis_reports",
      "bot_model_manifests",
      "training_data_manifests",
      "bot_benchmark_runs",
      "bot_knowledge_entries"
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
  });

  test("keeps live-room and replay queries indexed", () => {
    expect(schema).toContain("idx_rooms_status");
    expect(schema).toContain("idx_moves_game_ply");
    expect(schema).toContain("idx_games_variant_status");
    expect(schema).toContain("idx_bot_knowledge_variant_source");
  });
});
