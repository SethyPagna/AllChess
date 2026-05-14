-- AllChess Cloudflare D1 base schema.
-- Idempotent so existing databases can safely receive this migration.

create table if not exists profiles (
  id text primary key,
  username text not null unique,
  display_name text not null,
  avatar_key text,
  locale text not null default 'en',
  rating_classic integer not null default 1200,
  rating_variant integer not null default 1200,
  is_guest integer not null default 0,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists accounts (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  provider text not null,
  provider_account_id text,
  email text,
  password_hash text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique(provider, provider_account_id),
  unique(provider, email)
);

create table if not exists sessions (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  expires_at text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists passkeys (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  sign_count integer not null default 0,
  transports text,
  created_at text not null default (datetime('now')),
  last_used_at text
);

create table if not exists games (
  id text primary key,
  variant_key text not null,
  status text not null,
  result text not null default 'unfinished',
  board_state text not null,
  current_turn text not null,
  private_code text,
  created_by text references profiles(id) on delete set null,
  time_control text,
  rated integer not null default 0,
  visibility text not null default 'public',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  completed_at text
);

create table if not exists moves (
  id integer primary key autoincrement,
  game_id text not null references games(id) on delete cascade,
  ply integer not null,
  move text not null,
  notation text,
  board_state_after text not null,
  created_at text not null default (datetime('now')),
  unique(game_id, ply)
);

create table if not exists rooms (
  id text primary key,
  host_id text references profiles(id) on delete set null,
  game_id text not null references games(id) on delete cascade,
  variant_key text not null,
  room_code text not null unique,
  is_private integer not null default 1,
  status text not null default 'waiting',
  spectator_count integer not null default 0,
  rated integer not null default 0,
  time_control_key text not null default 'rapid',
  player_ratings_start text,
  final_rating_delta text,
  visibility text not null default 'private',
  chat_policy text not null default 'friendly',
  event_log text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists ratings (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  variant_key text not null,
  time_control_key text not null default 'rapid',
  rating integer not null default 1200,
  games_played integer not null default 0,
  updated_at text not null default (datetime('now')),
  unique(profile_id, variant_key, time_control_key)
);

create table if not exists analysis_reports (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  requested_by text references profiles(id) on delete set null,
  provider text not null,
  model text not null,
  summary text not null,
  report text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists bot_model_manifests (
  id text primary key,
  variant_key text not null,
  tier text not null,
  version text not null,
  status text not null,
  storage text not null,
  object_key text,
  position_count integer not null default 0,
  benchmark_version text not null,
  source_manifest_ids text not null default '[]',
  created_at text not null default (datetime('now'))
);

create table if not exists training_data_manifests (
  id text primary key,
  path text not null,
  kind text not null,
  variant_key text not null,
  bytes integer not null default 0,
  read_status text not null,
  sampled_records integer not null default 0,
  license text not null,
  storage_plan text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists bot_benchmark_runs (
  id text primary key,
  variant_key text not null,
  tier text not null,
  suite text not null,
  positions integer not null default 0,
  score real,
  summary text,
  artifact_key text,
  completed_at text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists bot_knowledge_entries (
  id text primary key,
  variant_key text not null,
  position_key text,
  board_signature text,
  move_uci text not null,
  source text not null,
  min_tier text not null,
  confidence real not null,
  benchmark_version text not null,
  tags text not null default '[]',
  explanation text not null default '{}',
  created_at text not null default (datetime('now'))
);

create index if not exists idx_accounts_profile_id on accounts(profile_id);
create index if not exists idx_accounts_email on accounts(email);
create index if not exists idx_sessions_profile_id on sessions(profile_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);
create index if not exists idx_games_variant_status on games(variant_key, status);
create index if not exists idx_games_created_by on games(created_by);
create index if not exists idx_moves_game_ply on moves(game_id, ply);
create index if not exists idx_rooms_status on rooms(status);
create index if not exists idx_rooms_code on rooms(room_code);
create index if not exists idx_analysis_game_id on analysis_reports(game_id);
create index if not exists idx_bot_knowledge_variant_source on bot_knowledge_entries(variant_key, source);
