import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const migrationsDir = join(process.cwd(), "cloudflare", "d1", "migrations");
const schema = ["0001_initial.sql", "0002_realtime_training.sql", "0003_catalog_leaderboards.sql", "0004_bot_knowledge_pipeline.sql"]
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n")
  .toLowerCase();

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
      "training_games",
      "training_positions",
      "engine_labels",
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
    expect(schema).toContain("idx_bot_knowledge_lookup");
  });
});
