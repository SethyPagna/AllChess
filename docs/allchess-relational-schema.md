# AllChess Relational Data Schema Review

Status: proposed migration plan
Scope: D1 relational data, Durable Object active state, R2 artifacts, API payloads, tests, and migration path
Last reviewed: 2026-05-18

## 1. Scan Method

This review scanned first-party source only: Cloudflare D1 migrations, API routes, repository code, Durable Object code, game/rules/bot/catalog types, scripts, and tests. The app does not currently use an ORM. The effective data contract is:

- D1 SQL migrations in `cloudflare/d1/migrations`.
- Raw SQL in `src/lib/cloudflare/d1.ts` and auth SQL in `src/lib/auth/d1.ts`.
- API response and request shapes under `src/app/api`.
- Durable Object snapshots in `src/lib/realtime/durable-objects.ts`.
- Runtime game, room, catalog, and bot types under `src/lib`.
- Tests under `tests`, especially D1, realtime, catalog, bot, and variant tests.

Dependency folders, Next build output, and generated reports are intentionally excluded from the design scan.

### Source Inventory

| Area requested | Current repo equivalent | Files reviewed |
| --- | --- | --- |
| Services | D1 repository, auth repository, realtime helpers, bot/training/rules services | `src/lib/cloudflare/d1.ts`, `src/lib/auth/d1.ts`, `src/lib/realtime/*`, `src/lib/bots.ts`, `src/lib/bot-training.ts`, `src/lib/variants/*`, `src/lib/catalog/*`, `src/lib/game-review.ts`, `src/lib/game-outcome.ts` |
| Controllers | Next API route handlers | `src/app/api/**/route.ts` |
| Models | TypeScript domain types, no ORM models | `src/lib/variants/types.ts`, `src/lib/realtime/types.ts`, `src/lib/catalog/types.ts`, `src/lib/bot-training.ts` |
| Migrations | Cloudflare D1 raw SQL | `cloudflare/d1/migrations/0001_initial.sql` through `0004_bot_knowledge_pipeline.sql` |
| Seeds | No dedicated seed migrations found | Catalog and curated bot knowledge are currently code/generated-data driven |
| Tests | Unit, integration, E2E, Cloudflare schema/persistence tests | `tests/**/*.ts`, `tests/**/*.tsx`, `tests/e2e/*.spec.ts` |
| Scripts | Training, env, deploy/worker patch helpers | `scripts/<domain>/*.mjs` |

## 2. Verification Sweeps

### Sweep 1 - Existing SQL

Current D1 tables:

- Identity: `profiles`, `accounts`, `sessions`, `passkeys`.
- Gameplay: `games`, `game_players`, `moves`.
- Realtime shell: `rooms`, `room_events`.
- Ratings: `ratings`.
- Review: `analysis_reports`, `game_review_summaries`.
- Catalog/rules: `game_catalog_entries`, `rules_versions`.
- Leaderboards: `leaderboards`.
- Bot/training: `training_manifests`, `training_games`, `training_positions`, `engine_labels`, `bot_model_manifests`, `bot_knowledge_entries`, `bot_benchmark_runs`.

Existing strengths:

- `games.board_state` and `moves.board_state_after` preserve full native `GameState` JSON, including `hands`, `variantState`, and review pointers.
- `moves(game_id, ply)` is unique and indexed for replay.
- Rooms, catalog, bot knowledge, and benchmark tables already exist as Cloudflare-first primitives.
- R2 is already the intended target for large artifacts.

Existing gaps:

- `game_players` assumes a real `profile_id`, which does not model bots, offline local players, anonymous local seats, or spectators cleanly.
- `moves.actor_id` is not written by `recordMove`, so historical moves are not reliably tied to a participant.
- Clocks are stored in snapshots and `game_players.clock_ms`, but there is no authoritative per-seat clock state or clock event trail.
- `rooms` has a single `spectator_count`, but no durable relational room participants or spectator rows.
- `leaderboards.entries` is JSON only, so ranking queries require a precomputed blob.
- `ratings` is only `(profile_id, variant_key)`, with no family, time control, rated/casual, rating system, deviation, or history.
- Bot runtime types contain metadata not represented in SQL: `boardSignature`, `tierTargets`, `positionHash`, `sourceFileId`, `sourceLicense`, `labelDepth`, `engine`, `split`, and `generatedAt`.

### Sweep 2 - API And Repository Flow

Observed write flows:

- `POST /api/games` creates a `GameState`, inserts `games`, and may create a private room.
- `POST /api/games/:id/move` accepts a client-submitted `state`, applies a move, and persists the new state.
- `POST /api/rooms` creates a `RoomSnapshot`, inserts `games`, and inserts `rooms`.
- `POST /api/analysis` can insert `analysis_reports`.
- `POST /api/bots/benchmark` returns a D1/R2 storage plan but does not currently persist benchmark rows.

Architectural risks:

- Move API should load the authoritative current state from D1 or Durable Object by `gameId`, then apply the submitted move. It currently trusts the submitted state shape.
- Drop moves are present in `Move`, but the move API schema validates only normal `from/to` moves.
- D1 and Durable Objects are not yet fully event-sourced together. `GameRoomDO` updates its internal `snapshot`, but does not append D1 move/event records.
- `GET /api/rooms/:id` currently returns a demo snapshot instead of loading D1 or Durable Object room state.

### Sweep 3 - Type And Test Contracts

Important runtime types:

- `GameState` owns board, turn, ply, status, result, outcome reason, clocks, captured pieces, checks, halfmove clock, optional shogi hands, optional variant state, and optional review pointer.
- `RoomSnapshot` owns room id, game id, variant, status, players, spectators, clocks, state, move version, rated flag, and chat policy.
- `GameCatalogEntry` owns family, aliases, native names, board geometry, presentation, playability, adapters, sources, short rules, and verification.
- `BotKnowledgeEntry` and `EngineLabel` are richer than current D1 columns.

Test-backed contracts:

- D1 schema must keep core auth, gameplay, room, analysis, catalog, and bot tables.
- D1 persistence must retain native `GameState` fields in `games.board_state` and `moves.board_state_after`.
- Realtime rooms must reject illegal moves, accept legal moves, and increment authoritative move versions.
- Catalog must gate unfinished variants instead of presenting them as fully playable.

### Sweep 4 - Refined Target

The optimized schema should keep JSON snapshots for variant flexibility, but add normalized tables for queryable data:

- Keep active state in Durable Objects, with D1 event/checkpoint persistence for recovery and history.
- Keep immutable historical game records in D1.
- Keep large engine/model/data artifacts in R2, with D1 manifests and compact lookup indexes.
- Normalize participants, moves, positions, clocks, ratings, leaderboards, room presence, and bot audits.

## 3. Optimized Relational Schema

### 3.1 Identity And Accounts

`profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable profile id. |
| `username` | text unique not null | Login/display handle. |
| `display_name` | text not null | User-facing name. |
| `avatar_url` | text | R2 or external URL. |
| `locale` | text not null | Default language. |
| `theme` | text not null | `light`, `dark`, or `system`. |
| `is_guest` | integer not null | 1 for guest profiles. |
| `created_at`, `updated_at` | text not null | Timestamps. |

Recommended changes:

- Remove generic `profiles.rating`; ratings should live in rating pools.
- Add optional `country_code`, `timezone`, and `profile_visibility` later if profile pages require them.

`accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Account credential id. |
| `profile_id` | text references profiles | Owner. |
| `provider` | text not null | `password`, `google`, future OAuth providers. |
| `provider_account_id` | text | OAuth provider subject. |
| `email` | text unique | Password/OAuth email. |
| `password_hash` | text | Password accounts only. |
| `created_at` | text not null | Timestamp. |

Indexes:

- `accounts(email)`.
- `accounts(provider, provider_account_id)` unique when provider id exists.

`sessions` and `passkeys` can remain close to the current schema.

### 3.2 Games

`games`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Game id. |
| `variant_key` | text not null | Current playable variant/game id. |
| `family_key` | text not null | Catalog family for stats and leaderboards. |
| `mode` | text not null | `online`, `bot`, `offline`, `room`, `matchmaking`, `spectate`, `analysis`. |
| `status` | text not null | `waiting`, `active`, `completed`, `abandoned`. |
| `result` | text not null | `unfinished`, `draw`, or winning side/profile. |
| `outcome_reason` | text | `checkmate`, `stalemate`, `timeout`, `insufficient-material`, `fifty-move`, `resignation`, `objective`, etc. |
| `rated` | integer not null | 1 for rated games. |
| `visibility` | text not null | `public`, `private`, `unlisted`, `local`. |
| `time_control_key` | text not null | `bullet`, `blitz`, `rapid`, `daily`, `none`, custom key. |
| `time_control` | text not null | JSON detail for base/increment/delay/byoyomi if needed. |
| `initial_state` | text | JSON initial state, useful for replay/debug. |
| `board_state` | text not null | Latest full `GameState` JSON checkpoint. |
| `current_turn` | text not null | Active side. |
| `move_count` | integer not null | Latest ply. |
| `private_code` | text unique | Room/join code if applicable. |
| `created_by` | text references profiles | Creator when known. |
| `winner_participant_id` | text | References `game_participants.id`, nullable. |
| `created_at`, `started_at`, `completed_at` | text | Lifecycle. |

Important indexes:

- `games(status, variant_key, created_at)`.
- `games(mode, rated, status, started_at)`.
- `games(created_by, created_at)`.
- `games(private_code)`.
- `games(completed_at)` for archives and stats.

Why: this supports user-vs-user, Bot Mode, bot-vs-bot, offline/local saves, rooms, matchmaking, spectating, and analysis sessions without overloading `status` or `private_code`.

### 3.3 Participants And Seats

`game_participants`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable participant id. |
| `game_id` | text references games | Game. |
| `profile_id` | text references profiles | Null for bot/local-only seat. |
| `participant_type` | text not null | `user`, `guest`, `bot`, `local-human`, `spectator`. |
| `seat` | text not null | `white`, `black`, `red`, `blue`, `sente`, `gote`, etc. |
| `display_name` | text not null | Frozen display name for game history. |
| `is_bot` | integer not null | Fast bot filter. |
| `bot_tier` | text | Easy through Legend. |
| `bot_model_version` | text | Runtime/training version. |
| `bot_playstyle` | text | Optional style. |
| `rating_pool_id` | text | Pool used at start. |
| `rating_at_start` | integer | Frozen rating. |
| `rating_delta` | integer not null | Rating change after game. |
| `connected` | integer not null | Live connection state for room history. |
| `joined_at`, `left_at` | text | Timestamps. |

Constraints and indexes:

- Unique `(game_id, seat)` for player seats.
- Index `(profile_id, joined_at)`.
- Index `(game_id, participant_type)`.

This replaces the current `game_players` shape. Current `game_players` can be migrated into this table.

### 3.4 Moves

`game_moves`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer primary key autoincrement | Internal row id. |
| `game_id` | text references games | Game. |
| `ply` | integer not null | Move number in full ply. |
| `actor_participant_id` | text references game_participants | Seat/user/bot that moved. |
| `move_kind` | text not null | `move`, `drop`, `pass`, `resign`, `offer_draw`, `accept_draw`, `timeout`, `system`. |
| `from_row`, `from_col` | integer | Nullable for drops/pass/system events. |
| `to_row`, `to_col` | integer | Nullable for non-board events. |
| `promotion` | integer not null | 1 when promoted. |
| `drop_code`, `drop_owner`, `drop_label_key` | text | Drop move metadata. |
| `move_json` | text not null | Full backward-compatible `Move` JSON. |
| `notation` | text not null | Display notation. |
| `uci` | text | UCI-like form when available. |
| `native_notation` | text | KIF/SFEN/Xiangqi/Janggi/etc. |
| `elapsed_ms` | integer | Time spent on move. |
| `remaining_ms_after` | integer | Clock for actor after move. |
| `is_capture` | integer not null | Fast capture query. |
| `captured_piece_code` | text | Optional. |
| `move_quality` | text | Review classification. |
| `created_at` | text not null | Timestamp. |

Indexes:

- Unique `(game_id, ply)`.
- `game_moves(game_id, ply)`.
- `game_moves(actor_participant_id, created_at)`.
- `game_moves(game_id, move_quality)`.

Keep the existing `moves` table during transition, or rename/backfill to `game_moves` in a later migration.

### 3.5 Positions And Snapshots

`game_positions`

| Column | Type | Notes |
| --- | --- | --- |
| `game_id` | text references games | Game. |
| `ply` | integer not null | Position after this ply; `0` is initial. |
| `state_json` | text not null | Full `GameState` JSON. |
| `fen_like_state` | text | FEN/SFEN/XFEN/native compact state where available. |
| `position_hash` | text not null | Repetition/cache lookup key. |
| `turn` | text not null | Side to move. |
| `status` | text not null | Position status. |
| `result` | text | Result at this ply if terminal. |
| `outcome_reason` | text | Terminal reason if any. |
| `halfmove_clock` | integer | Chess-like draw support. |
| `repetition_key` | text | Rules-specific repetition key. |
| `clocks_json` | text not null | Clock snapshot. |
| `captured_json` | text not null | Captured pieces. |
| `hands_json` | text | Shogi/drop games. |
| `variant_state_json` | text | Native counters and special state. |
| `created_at` | text not null | Timestamp. |

Primary key:

- `(game_id, ply)`.

Indexes:

- `game_positions(position_hash)`.
- `game_positions(game_id, status)`.

Why: replay, review, bot cache, repetition, and audits should not require reparsing every move from a single latest `games.board_state`.

### 3.6 Clocks

`game_clocks`

| Column | Type | Notes |
| --- | --- | --- |
| `game_id` | text references games | Game. |
| `participant_id` | text references game_participants | Seat. |
| `seat` | text not null | Side. |
| `remaining_ms` | integer not null | Current remaining time. |
| `base_ms` | integer not null | Initial base. |
| `increment_ms` | integer not null | Increment. |
| `last_started_at` | text | When this clock started ticking. |
| `total_elapsed_ms` | integer not null | Accumulated time. |
| `flagged_at` | text | Timeout timestamp. |
| `updated_at` | text not null | Timestamp. |

Primary key:

- `(game_id, participant_id)`.

`clock_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer primary key autoincrement | Event id. |
| `game_id` | text | Game. |
| `participant_id` | text | Seat. |
| `event_type` | text | `start`, `pause`, `tick`, `increment`, `timeout`, `sync`. |
| `remaining_ms` | integer | Remaining after event. |
| `payload` | text | JSON details. |
| `created_at` | text | Timestamp. |

Why: bot thinking must not pause the bot clock unless the selected rules say so. A clock table plus events makes timeout bugs easier to detect.

### 3.7 Rooms, Matchmaking, Presence, And Chat

`rooms`

Keep current columns, add:

| Column | Type | Notes |
| --- | --- | --- |
| `active_object_id` | text | Durable Object id/name. |
| `last_snapshot_ply` | integer not null | Last D1 checkpoint. |
| `last_heartbeat_at` | text | Recovery/presence freshness. |
| `max_spectators` | integer | Optional cap. |

Indexes:

- `rooms(status, variant_key, visibility, rated, time_control_key)`.
- `rooms(room_code)`.

`room_participants`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Room participant id. |
| `room_id` | text references rooms | Room. |
| `profile_id` | text references profiles | Nullable guest. |
| `participant_id` | text references game_participants | Nullable for pure spectator. |
| `role` | text not null | `player`, `spectator`, `bot`, `moderator`. |
| `connected` | integer not null | Live presence. |
| `joined_at`, `left_at` | text | Timestamps. |

`room_events`

Extend current table with:

- `game_id`, `actor_participant_id`, `event_version`, `idempotency_key`.
- Unique `(room_id, event_version)`.
- Index `(room_id, created_at)`.

`chat_messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Message id. |
| `room_id` | text references rooms | Room. |
| `profile_id` | text references profiles | Sender. |
| `participant_id` | text references room_participants | Sender in room. |
| `message_type` | text not null | `chat`, `system`, `moderation`. |
| `body` | text not null | Message text. |
| `created_at`, `deleted_at` | text | Timestamps. |

`matchmaking_tickets`

| Column | Type | Notes |
| --- | --- | --- |
| `ticket_id` | text primary key | Ticket id. |
| `profile_id` | text references profiles | User/guest. |
| `variant_key` | text not null | Requested game. |
| `time_control_key` | text not null | Requested time. |
| `rating_min`, `rating_max` | integer not null | Pairing band. |
| `rated` | integer not null | Rated/casual. |
| `status` | text not null | `queued`, `matched`, `cancelled`, `expired`. |
| `matched_room_id` | text references rooms | Result. |
| `created_at`, `updated_at`, `expires_at` | text | Lifecycle. |

Durable Objects can remain the active source of truth, but D1 should receive ticket and room event checkpoints for audit and recovery.

### 3.8 Ratings, Stats, And Leaderboards

`rating_pools`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Pool id. |
| `family_key` | text | Optional family. |
| `variant_key` | text | Optional exact game. |
| `time_control_key` | text | Bullet/blitz/rapid/etc. |
| `rated_only` | integer not null | Usually 1. |
| `system` | text not null | `glicko`, `elo`, or future system. |

`profile_ratings`

| Column | Type | Notes |
| --- | --- | --- |
| `profile_id` | text references profiles | Player. |
| `pool_id` | text references rating_pools | Pool. |
| `rating` | real not null | Rating. |
| `deviation` | real | Glicko RD. |
| `volatility` | real | Glicko volatility. |
| `games_played` | integer not null | Count. |
| `provisional` | integer not null | New rating flag. |
| `updated_at` | text not null | Timestamp. |

Primary key: `(profile_id, pool_id)`.

`rating_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer primary key autoincrement | Event id. |
| `game_id` | text references games | Rated game. |
| `profile_id` | text references profiles | Player. |
| `pool_id` | text references rating_pools | Pool. |
| `before_rating`, `after_rating`, `delta` | real | Rating change. |
| `created_at` | text | Timestamp. |

`profile_stats`

- `profile_id`, `total_games`, `wins`, `losses`, `draws`, `bot_games`, `online_games`, `offline_saved_games`, `updated_at`.

`profile_variant_stats`

- `profile_id`, `variant_key`, `time_control_key`, `games`, `wins`, `losses`, `draws`, `best_rating`, `current_streak`, `updated_at`.

`site_daily_stats`

- `stat_date`, `family_key`, `variant_key`, `games_started`, `games_completed`, `active_rooms_peak`, `spectators_peak`, `bot_games`, `new_profiles`.

`leaderboards`

Keep as cache metadata, but add normalized entries.

`leaderboard_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `leaderboard_id` | text references leaderboards | Board. |
| `rank` | integer not null | Rank. |
| `profile_id` | text references profiles | Player. |
| `rating` | real | Rating. |
| `games_played` | integer | Count. |
| `win_rate` | real | Optional. |
| `computed_at` | text | Timestamp. |

Primary key: `(leaderboard_id, rank)`.

Indexes:

- `profile_ratings(pool_id, rating desc)`.
- `rating_events(profile_id, created_at)`.
- `leaderboard_entries(profile_id)`.

### 3.9 Review And Analysis

`analysis_reports`

Keep current table, add:

- `status`: `queued`, `running`, `completed`, `failed`.
- `summary_id`: optional link to `game_review_summaries`.
- `artifact_key`: R2 key for large engine/LLM artifacts.
- `provider_latency_ms`.

`game_review_summaries`

Keep current table, add:

- `variant_key`, `rules_version`, `review_version`.
- `best_move_count`, `excellent_count`, `inaccuracy_count`, `mistake_count`, `blunder_count`.
- `opening_name`, `accuracy_white`, `accuracy_black` where applicable.

`move_reviews`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Review row. |
| `game_id` | text references games | Game. |
| `move_id` | integer references game_moves | Move. |
| `ply` | integer not null | Ply. |
| `classification` | text not null | Best/excellent/good/etc. |
| `score_before`, `score_after` | real | Engine/review score. |
| `best_move_json` | text | Suggested move. |
| `explanation` | text | Human-readable detail. |
| `created_at` | text | Timestamp. |

This supports the requested game review flow: play/pause, first/previous/next/last, best/excellent/blunder counts, and position details.

### 3.10 Catalog, Rules, And Release Gates

Current catalog JSON fields are acceptable for initial rendering. For search and filtering, add:

`game_aliases`

- `game_id`, `alias`, `language`, `kind` (`english`, `native`, `romanization`, `common`).

`game_regions`

- `game_id`, `region_code`, `region_name`.

`rule_sources`

- `id`, `game_id`, `name`, `url`, `publisher`, `accessed_at`.

`rule_sections`

- `id`, `game_id`, `rules_version_id`, `section_type` (`basics`, `special`, `win`, `draw`, `illegal`, `examples`), `sort_order`, `body`.

`playable_game_verification`

| Column | Type | Notes |
| --- | --- | --- |
| `game_id` | text references game_catalog_entries | Game. |
| `rules_complete` | integer not null | Native rules pass. |
| `bot_complete` | integer not null | Bot pass. |
| `review_complete` | integer not null | Review pass. |
| `persistence_complete` | integer not null | D1 shape pass. |
| `e2e_complete` | integer not null | E2E pass. |
| `known_gaps` | text not null | JSON list. |
| `verified_at` | text | Last verified. |

Primary key: `game_id`.

### 3.11 Bots, Training, And Runtime Audits

Keep:

- `training_manifests`
- `training_games`
- `training_positions`
- `engine_labels`
- `bot_model_manifests`
- `bot_knowledge_entries`
- `bot_benchmark_runs`

Expand `bot_knowledge_entries` to match runtime types:

| Column | Type | Notes |
| --- | --- | --- |
| `board_signature` | text | Runtime board signature. |
| `tier_targets` | text | JSON target tiers. |
| `position_hash` | text | Fast lookup hash. |
| `source_file_id` | text | Data source manifest id. |
| `source_license` | text | License string. |
| `label_depth` | integer | Engine/search depth. |
| `engine` | text | Stockfish/internal/etc. |
| `split` | text | `train`, `eval`, `test`. |
| `generated_at` | text | Generation timestamp. |

Expand `engine_labels`:

- Add `variant_key`, `position_key`, `board_signature`, `move_uci`, `engine_version`, `legal_validation`, `benchmark_version`, `confidence`, `min_tier`, `tags`, `source_tool`, `explanation`.
- Keep `training_position_id` nullable so labels can be attached to runtime positions before full dataset ingestion.

Add `bot_move_audits`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Audit id. |
| `game_id` | text references games | Game. |
| `move_id` | integer references game_moves | Applied move. |
| `participant_id` | text references game_participants | Bot seat. |
| `variant_key` | text not null | Variant. |
| `tier` | text not null | Easy through Legend. |
| `knowledge_source` | text | Cache/engine/search source. |
| `engine` | text | Engine/router. |
| `depth` | integer | Depth reached. |
| `nodes` | integer | Nodes searched. |
| `confidence` | real | 0-1. |
| `elapsed_ms` | integer not null | Must remain under live budget. |
| `legal_validated` | integer not null | Must be 1. |
| `principal_variation` | text | JSON list. |
| `explanation` | text | JSON plan/threat/risk/fallback. |
| `created_at` | text | Timestamp. |

Indexes:

- `bot_knowledge_entries(variant_key, position_key, min_tier)`.
- `bot_knowledge_entries(variant_key, position_hash)`.
- `bot_knowledge_entries(variant_key, source, confidence desc)`.
- `engine_labels(variant_key, position_key)`.
- `bot_move_audits(game_id, move_id)`.
- `bot_benchmark_runs(variant_key, tier, created_at)`.

## 4. Active And Historical Data Split

Recommended ownership:

| Data | Active source | Historical source | Notes |
| --- | --- | --- | --- |
| Live room state | Durable Object `snapshot` | D1 `games`, `game_positions`, `room_events` | DO is fast path; D1 is recovery/audit. |
| Live clocks | Durable Object plus `game_clocks` checkpoint | D1 `clock_events` | Prevent timer pause/increment regressions. |
| Matchmaking queue | Durable Object | D1 `matchmaking_tickets` | D1 helps reconnect and audit. |
| Presence/live stats | Durable Object | D1 `site_daily_stats` snapshots | No fake counts. |
| Completed games | D1 | D1 plus R2 exports | Immutable archive. |
| Analysis artifacts | Worker/API | D1 summary, R2 large report | Keep D1 compact. |
| Training data/models | Offline jobs | D1 manifests, R2 large data | Do not commit raw datasets. |

## 5. Migration Path

### Migration 0005 - Participants, positions, and clocks

1. Create `game_participants`, `game_positions`, `game_clocks`, and `clock_events`.
2. Backfill `game_participants` from `game_players`.
3. Backfill `game_positions` with `ply = 0` or latest available `games.board_state`.
4. Backfill `game_positions` from existing `moves.board_state_after`.
5. Dual-write:
   - Continue writing `games.board_state`.
   - Also write `game_positions`.
   - Continue writing `moves`.
   - Also write `game_moves`.
6. Update `recordMove` to set `actor_participant_id` and clock fields.

### Migration 0006 - Rooms and authoritative move recovery

1. Add `active_object_id`, `last_snapshot_ply`, and `last_heartbeat_at` to `rooms`.
2. Create `room_participants`, `chat_messages`, and `matchmaking_tickets`.
3. Extend `room_events` with `event_version`, `game_id`, `actor_participant_id`, and `idempotency_key`.
4. Make `GameRoomDO` append D1 room events and move checkpoints after authoritative moves.
5. Make `GET /api/rooms/:id` load from Durable Object or D1 instead of demo-only snapshots.

### Migration 0007 - Ratings, stats, and leaderboards

1. Create `rating_pools`, `profile_ratings`, `rating_events`, `profile_stats`, `profile_variant_stats`, `site_daily_stats`, and `leaderboard_entries`.
2. Backfill `profile_ratings` from current `ratings`.
3. Keep `leaderboards.entries` as a cache, but compute from normalized rows.
4. Move generic `profiles.rating` out of ranking logic.

### Migration 0008 - Bot and training metadata

1. Add missing runtime metadata columns to `bot_knowledge_entries`.
2. Add missing runtime metadata columns to `engine_labels`.
3. Create `bot_move_audits`.
4. Make `/api/bots/benchmark` write `bot_benchmark_runs` when D1 is available.
5. Store raw datasets/models in R2 and only compact manifests/runtime knowledge in D1/app data.

### Migration 0009 - Catalog/rules normalization

1. Create `game_aliases`, `game_regions`, `rule_sources`, `rule_sections`, and `playable_game_verification`.
2. Backfill from code catalog.
3. Keep code catalog as seed/source until an admin update path exists.
4. Make API search use aliases/native/romanized rows.

## 6. Query Patterns And Indexing

High-priority read paths:

- Open game: `games(id)` plus latest `game_positions(game_id, ply desc)` or `games.board_state`.
- Replay/review: `game_moves(game_id, ply)` and `game_positions(game_id, ply)`.
- Profile history: `game_participants(profile_id, joined_at desc)` joined to `games`.
- Room list: `rooms(status, variant_key, visibility, rated, time_control_key)`.
- Live stats: Durable Object first, D1 room/status fallback.
- Leaderboards: `profile_ratings(pool_id, rating desc)`, cached in `leaderboard_entries`.
- Bot move: app data or D1/R2-generated cache by `(variant_key, position_key/min_tier)` or `position_hash`.
- Training audit: `training_positions(variant_key, split)`, `engine_labels(variant_key, position_key)`.

Recommended D1 indexes:

```sql
create index if not exists idx_games_mode_status_started on games(mode, status, started_at);
create index if not exists idx_games_creator_created on games(created_by, created_at);
create index if not exists idx_game_participants_profile_joined on game_participants(profile_id, joined_at);
create index if not exists idx_game_participants_game_type on game_participants(game_id, participant_type);
create index if not exists idx_game_moves_actor_created on game_moves(actor_participant_id, created_at);
create index if not exists idx_game_positions_hash on game_positions(position_hash);
create index if not exists idx_rooms_list on rooms(status, variant_key, visibility, rated, time_control_key);
create index if not exists idx_matchmaking_open on matchmaking_tickets(status, variant_key, time_control_key, rated, created_at);
create index if not exists idx_profile_ratings_pool_rating on profile_ratings(pool_id, rating desc);
create index if not exists idx_bot_knowledge_hash on bot_knowledge_entries(variant_key, position_hash);
create index if not exists idx_engine_labels_variant_position on engine_labels(variant_key, position_key);
```

## 7. Architectural Rewiring Recommendations

1. Make the server authoritative for moves.
   - Load current state from Durable Object or D1.
   - Validate the move against that state.
   - Reject stale move versions.
   - Persist move, position, clock, and room event in one logical write path.

2. Treat Durable Objects as active state, not the only state.
   - DO handles low-latency WebSocket rooms, matchmaking, clocks, and presence.
   - D1 stores immutable events, checkpoints, and history.

3. Keep snapshots and normalized rows.
   - Full JSON snapshots preserve variant flexibility.
   - Normalized moves, participants, clocks, ratings, and reviews enable fast product queries.

4. Separate players from participants.
   - A profile is an account.
   - A participant is a seat in a specific game.
   - Bots, guests, offline local humans, and spectators should not be forced into `profiles`.

5. Treat bot strength as audited data.
   - Runtime bot results should create optional `bot_move_audits`.
   - Benchmarks should be persisted.
   - Strength claims should come from `bot_benchmark_runs`, not copy.

6. Split rating pools.
   - Classic rapid, Classic blitz, Chess960 rapid, Xiangqi rapid, and bot-training ratings should not collapse into one `variant_key` number.

7. Keep offline saves explicit.
   - Use `games.mode = 'offline'` and `visibility = 'local'` or sync saved local games to D1 only when the user chooses to save/sign in.

8. Keep large artifacts out of D1.
   - R2 should hold PGN/KIF/SGF exports, large analysis reports, training datasets, models, and benchmark artifacts.
   - D1 should hold manifests, checksums, counts, and queryable summaries.

## 8. Immediate Code Follow-ups

These are the highest-value implementation tasks after the schema migration docs:

1. Add `game_participants`, `game_moves`, `game_positions`, and `game_clocks`.
2. Update `recordMove` to write actor, move, position, and clock data.
3. Change `POST /api/games/:id/move` so it loads the authoritative state instead of trusting client-submitted state.
4. Extend the move API schema to support drop/pass/resign/system move kinds.
5. Make `GameRoomDO` append D1 room events and move checkpoints.
6. Add D1 persistence for bot benchmarks and bot move audits.
7. Normalize catalog aliases and release gates so game search and readiness do not depend only on code arrays.
8. Backfill leaderboards and rating pools from current `ratings`.

## 9. Final Schema Position

The current D1 schema is a workable foundation, but it is snapshot-heavy. The optimized AllChess schema should be hybrid:

- JSON snapshots for full variant correctness.
- Normalized rows for participants, moves, positions, clocks, ratings, leaderboards, reviews, rooms, and bot audits.
- Durable Objects for active realtime state.
- D1 for authoritative history, recovery, query, and compact metadata.
- R2 for heavy artifacts and training data.

This model supports human-vs-human, human-vs-bot, bot-vs-bot, offline/local games, rooms, matchmaking, spectating, reviews, ratings, clocks, and long-running bot training without pretending unfinished variants or unverified bot strength are complete.
