create table if not exists rating_pools (
  id text primary key,
  family_key text,
  variant_key text,
  time_control_key text not null default 'rapid',
  rated_only integer not null default 1,
  system text not null default 'glicko' check (system in ('elo', 'glicko')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (family_key, variant_key, time_control_key, rated_only, system)
);

create table if not exists profile_ratings (
  profile_id text not null references profiles(id) on delete cascade,
  pool_id text not null references rating_pools(id) on delete cascade,
  rating real not null default 1200,
  deviation real,
  volatility real,
  games_played integer not null default 0,
  provisional integer not null default 1,
  updated_at text not null default (datetime('now')),
  primary key (profile_id, pool_id)
);

create table if not exists rating_events (
  id integer primary key autoincrement,
  game_id text not null references games(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  pool_id text not null references rating_pools(id) on delete cascade,
  before_rating real not null,
  after_rating real not null,
  delta real not null,
  reason text not null default 'game-result',
  created_at text not null default (datetime('now'))
);

create table if not exists leaderboard_entries (
  leaderboard_id text not null references leaderboards(id) on delete cascade,
  rank integer not null,
  profile_id text references profiles(id) on delete set null,
  display_name text not null,
  rating real,
  games_played integer not null default 0,
  win_rate real,
  streak integer not null default 0,
  metadata text not null default '{}',
  computed_at text not null default (datetime('now')),
  primary key (leaderboard_id, rank)
);

create index if not exists idx_rating_pools_variant_time on rating_pools(variant_key, time_control_key, rated_only);
create index if not exists idx_profile_ratings_pool_rating on profile_ratings(pool_id, rating desc);
create index if not exists idx_profile_ratings_profile_updated on profile_ratings(profile_id, updated_at);
create index if not exists idx_rating_events_profile_created on rating_events(profile_id, created_at);
create index if not exists idx_rating_events_game on rating_events(game_id);
create index if not exists idx_leaderboard_entries_profile on leaderboard_entries(profile_id);
create index if not exists idx_leaderboard_entries_rating on leaderboard_entries(leaderboard_id, rating desc);
