create table if not exists profiles (
  id text primary key,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  locale text not null default 'en',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  rating integer not null default 1200,
  is_guest integer not null default 0,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists accounts (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('password', 'google')),
  provider_account_id text,
  email text unique,
  password_hash text,
  created_at text not null default (datetime('now')),
  unique (provider, provider_account_id)
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
  credential_id text unique not null,
  public_key text not null,
  counter integer not null default 0,
  transports text not null default '[]',
  created_at text not null default (datetime('now'))
);

create table if not exists games (
  id text primary key,
  variant_key text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'abandoned')),
  result text not null default 'unfinished',
  board_state text not null,
  time_control text not null default '{"baseSeconds":600,"incrementSeconds":5}',
  current_turn text not null default 'white',
  private_code text unique,
  created_by text references profiles(id) on delete set null,
  winner_id text references profiles(id) on delete set null,
  created_at text not null default (datetime('now')),
  started_at text,
  completed_at text
);

create table if not exists game_players (
  game_id text not null references games(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  seat text not null,
  clock_ms integer not null default 600000,
  joined_at text not null default (datetime('now')),
  primary key (game_id, profile_id),
  unique (game_id, seat)
);

create table if not exists moves (
  id integer primary key autoincrement,
  game_id text not null references games(id) on delete cascade,
  ply integer not null,
  actor_id text references profiles(id) on delete set null,
  move text not null,
  notation text not null,
  board_state_after text not null,
  created_at text not null default (datetime('now')),
  unique (game_id, ply)
);

create table if not exists rooms (
  id text primary key,
  host_id text references profiles(id) on delete set null,
  game_id text references games(id) on delete set null,
  variant_key text not null,
  room_code text unique not null,
  is_private integer not null default 1,
  created_at text not null default (datetime('now'))
);

create table if not exists ratings (
  profile_id text not null references profiles(id) on delete cascade,
  variant_key text not null,
  rating integer not null default 1200,
  games_played integer not null default 0,
  updated_at text not null default (datetime('now')),
  primary key (profile_id, variant_key)
);

create table if not exists analysis_reports (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  requested_by text references profiles(id) on delete set null,
  provider text not null default 'workers-ai',
  model text not null,
  summary text not null,
  report text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_games_variant_status on games(variant_key, status);
create index if not exists idx_moves_game_ply on moves(game_id, ply);
create index if not exists idx_rooms_code on rooms(room_code);
create index if not exists idx_accounts_email on accounts(email);
create index if not exists idx_sessions_profile on sessions(profile_id);
create index if not exists idx_passkeys_profile on passkeys(profile_id);
