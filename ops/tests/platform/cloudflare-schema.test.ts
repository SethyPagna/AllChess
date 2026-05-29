import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const migrationsDir = join(process.cwd(), "ops", "infra", "cloudflare", "d1", "migrations");
const schema = [
  "0001_initial.sql",
  "0002_realtime_training.sql",
  "0003_catalog_leaderboards.sql",
  "0004_bot_knowledge_pipeline.sql",
  "0005_normalized_game_state.sql",
  "0006_matchmaking_tickets.sql",
  "0007_ratings_leaderboards.sql",
  "0008_profile_game_stats.sql",
  "0009_catalog_rules_normalization.sql"
]
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
      "bot_knowledge_entries",
      "game_participants",
      "game_moves",
      "game_positions",
      "game_clocks",
      "clock_events",
      "bot_move_audits",
      "matchmaking_tickets",
      "rating_pools",
      "profile_ratings",
      "rating_events",
      "leaderboard_entries",
      "profile_game_stats",
      "profile_game_results",
      "game_aliases",
      "game_regions",
      "rule_sources",
      "rule_sections",
      "playable_game_verification"
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
  });

  test("keeps live-room and replay queries indexed", () => {
    expect(schema).toContain("idx_rooms_status");
    expect(schema).toContain("idx_moves_game_ply");
    expect(schema).toContain("idx_games_variant_status");
    expect(schema).toContain("idx_bot_knowledge_lookup");
    expect(schema).toContain("idx_game_positions_hash");
    expect(schema).toContain("idx_game_participants_profile_joined");
    expect(schema).toContain("idx_game_moves_actor_created");
    expect(schema).toContain("idx_matchmaking_open");
    expect(schema).toContain("idx_profile_ratings_pool_rating");
    expect(schema).toContain("idx_rating_events_profile_created");
    expect(schema).toContain("idx_leaderboard_entries_rating");
    expect(schema).toContain("idx_profile_game_stats_variant");
    expect(schema).toContain("idx_profile_game_results_profile_completed");
    expect(schema).toContain("idx_game_aliases_normalized");
    expect(schema).toContain("idx_game_regions_region");
    expect(schema).toContain("idx_rule_sections_game_type_order");
    expect(schema).toContain("idx_playable_game_verification_ready");
  });
});
