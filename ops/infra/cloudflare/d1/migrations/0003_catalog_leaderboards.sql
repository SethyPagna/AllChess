create table if not exists game_catalog_entries (
  id text primary key,
  variant_key text,
  family_key text not null,
  english_name text not null,
  native_name text,
  romanization text,
  aliases text not null default '[]',
  region text not null default '[]',
  board_geometry text not null,
  piece_presentation text not null,
  playability text not null check (playability in ('playable', 'learn', 'coming-soon')),
  rules_adapter text not null,
  bot_adapter text not null,
  learning_status text not null check (learning_status in ('ready', 'draft', 'researching')),
  source_links text not null default '[]',
  rules_version text not null default 'catalog-v1',
  updated_at text not null default (datetime('now'))
);

create table if not exists rules_versions (
  id text primary key,
  game_id text not null references game_catalog_entries(id) on delete cascade,
  version text not null,
  source_links text not null default '[]',
  numbered_basics text not null default '[]',
  special_rules text not null default '[]',
  win_conditions text not null default '[]',
  draw_conditions text not null default '[]',
  illegal_move_notes text not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at text not null default (datetime('now')),
  unique (game_id, version)
);

create table if not exists leaderboards (
  id text primary key,
  scope_id text not null,
  game_id text,
  family_key text,
  rated_only integer not null default 1,
  period text not null default 'all-time',
  entries text not null default '[]',
  computed_at text not null default (datetime('now'))
);

create table if not exists game_review_summaries (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  game_family_key text not null,
  summary text not null,
  move_classification_counts text not null default '{}',
  result_context text not null default '{}',
  created_at text not null default (datetime('now'))
);

create index if not exists idx_game_catalog_family_playability on game_catalog_entries(family_key, playability);
create index if not exists idx_rules_versions_game_status on rules_versions(game_id, status);
create index if not exists idx_leaderboards_scope_period on leaderboards(scope_id, period);
create index if not exists idx_game_review_summaries_game on game_review_summaries(game_id);
