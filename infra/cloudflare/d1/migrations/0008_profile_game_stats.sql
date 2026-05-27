create table if not exists profile_game_stats (
  profile_id text not null references profiles(id) on delete cascade,
  family_key text not null default 'all',
  variant_key text not null default 'all',
  time_control_key text not null default 'all',
  mode text not null default 'all' check (mode in ('all', 'online', 'bot', 'offline', 'room', 'matchmaking')),
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  bot_games integer not null default 0,
  online_games integer not null default 0,
  local_games integer not null default 0,
  rated_games integer not null default 0,
  total_moves integer not null default 0,
  best_rating real,
  updated_at text not null default (datetime('now')),
  primary key (profile_id, family_key, variant_key, time_control_key, mode)
);

create table if not exists profile_game_results (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  game_id text not null references games(id) on delete cascade,
  family_key text not null,
  variant_key text not null,
  time_control_key text not null default 'rapid',
  mode text not null check (mode in ('online', 'bot', 'offline', 'room', 'matchmaking')),
  opponent_profile_id text references profiles(id) on delete set null,
  opponent_type text not null default 'unknown' check (opponent_type in ('user', 'bot', 'local-human', 'unknown')),
  result text not null check (result in ('win', 'loss', 'draw', 'unfinished')),
  outcome_reason text,
  rated integer not null default 0,
  rating_delta real,
  moves_played integer not null default 0,
  duration_ms integer,
  completed_at text,
  created_at text not null default (datetime('now')),
  unique (profile_id, game_id)
);

create index if not exists idx_profile_game_stats_variant on profile_game_stats(variant_key, time_control_key, games_played desc);
create index if not exists idx_profile_game_results_profile_completed on profile_game_results(profile_id, completed_at desc);
create index if not exists idx_profile_game_results_game on profile_game_results(game_id);
create index if not exists idx_profile_game_results_variant_result on profile_game_results(variant_key, result, completed_at desc);
