alter table rooms add column status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'abandoned'));
alter table rooms add column spectator_count integer not null default 0;
alter table rooms add column rated integer not null default 0;
alter table rooms add column time_control_key text not null default 'rapid';
alter table rooms add column visibility text not null default 'private' check (visibility in ('public', 'private', 'unlisted'));
alter table rooms add column chat_policy text not null default 'players' check (chat_policy in ('disabled', 'players', 'spectators', 'everyone'));

alter table game_players add column rating_at_start integer;
alter table game_players add column rating_delta integer not null default 0;

create table if not exists room_events (
  id integer primary key autoincrement,
  room_id text not null references rooms(id) on delete cascade,
  event_type text not null,
  payload text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists training_manifests (
  id text primary key,
  variant_key text not null,
  source text not null check (source in ('public', 'self-play', 'engine-generated', 'opt-in-user')),
  object_key text not null,
  position_count integer not null default 0,
  license text not null,
  split text not null check (split in ('train', 'eval', 'test')),
  created_at text not null default (datetime('now'))
);

create table if not exists bot_benchmark_runs (
  id text primary key,
  variant_key text not null,
  tier text not null,
  benchmark_version text not null,
  games_played integer not null,
  score real not null,
  illegal_moves integer not null default 0,
  summary text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_rooms_status_variant on rooms(status, variant_key);
create index if not exists idx_room_events_room_created on room_events(room_id, created_at);
create index if not exists idx_training_manifests_variant on training_manifests(variant_key, split);
create index if not exists idx_bot_benchmark_variant_tier on bot_benchmark_runs(variant_key, tier);
