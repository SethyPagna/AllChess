create table if not exists training_games (
  id text primary key,
  variant_key text not null,
  source text not null check (source in ('public', 'self-play', 'engine-generated', 'opt-in-user')),
  license text not null,
  object_key text not null,
  result text,
  move_count integer not null default 0,
  created_at text not null default (datetime('now'))
);

create table if not exists training_positions (
  id text primary key,
  variant_key text not null,
  fen_like_state text not null,
  legal_moves text not null default '[]',
  best_moves text not null default '[]',
  source text not null check (source in ('public', 'self-play', 'engine-generated', 'opt-in-user')),
  split text not null check (split in ('train', 'eval', 'test')),
  tags text not null default '[]',
  created_at text not null default (datetime('now'))
);

create table if not exists engine_labels (
  id text primary key,
  training_position_id text not null references training_positions(id) on delete cascade,
  engine text not null,
  depth integer not null default 0,
  nodes integer not null default 0,
  best_moves text not null default '[]',
  evaluation real,
  created_at text not null default (datetime('now'))
);

create table if not exists bot_model_manifests (
  id text primary key,
  variant_key text not null,
  tier text not null check (tier in ('easy', 'normal', 'hard', 'very-hard', 'grandmaster', 'legend')),
  version text not null,
  status text not null check (status in ('planned', 'training', 'evaluating', 'active', 'retired')),
  storage text not null check (storage in ('r2', 'external')),
  object_key text,
  position_count integer not null default 0,
  benchmark_version text not null,
  source_manifest_ids text not null default '[]',
  created_at text not null default (datetime('now'))
);

create table if not exists bot_knowledge_entries (
  id text primary key,
  variant_key text not null,
  position_key text not null,
  move_uci text not null,
  source text not null check (source in ('opening-book', 'tactic-cache', 'endgame-cache', 'ml-policy', 'engine-search', 'internal-search')),
  min_tier text not null check (min_tier in ('easy', 'normal', 'hard', 'very-hard', 'grandmaster', 'legend')),
  confidence real not null default 0,
  benchmark_version text not null,
  tags text not null default '[]',
  explanation text not null default '{}',
  created_at text not null default (datetime('now')),
  unique (variant_key, position_key, move_uci, source)
);

create index if not exists idx_training_games_variant_source on training_games(variant_key, source);
create index if not exists idx_training_positions_variant_split on training_positions(variant_key, split);
create index if not exists idx_engine_labels_position on engine_labels(training_position_id);
create index if not exists idx_bot_model_manifests_variant_tier on bot_model_manifests(variant_key, tier, status);
create index if not exists idx_bot_knowledge_lookup on bot_knowledge_entries(variant_key, position_key, min_tier);
