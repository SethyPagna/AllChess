create table if not exists game_participants (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  profile_id text references profiles(id) on delete set null,
  participant_type text not null check (participant_type in ('user', 'guest', 'bot', 'local-human', 'spectator')),
  seat text not null,
  display_name text not null,
  is_bot integer not null default 0,
  bot_tier text check (bot_tier in ('easy', 'normal', 'hard', 'very-hard', 'grandmaster', 'legend')),
  bot_model_version text,
  bot_playstyle text,
  rating_pool_id text,
  rating_at_start integer,
  rating_delta integer not null default 0,
  connected integer not null default 0,
  joined_at text not null default (datetime('now')),
  left_at text,
  unique (game_id, seat)
);

create table if not exists game_moves (
  id integer primary key autoincrement,
  game_id text not null references games(id) on delete cascade,
  ply integer not null,
  actor_participant_id text references game_participants(id) on delete set null,
  move_kind text not null default 'move' check (move_kind in ('move', 'drop', 'pass', 'resign', 'offer_draw', 'accept_draw', 'timeout', 'system')),
  from_row integer,
  from_col integer,
  to_row integer,
  to_col integer,
  promotion integer not null default 0,
  drop_code text,
  drop_owner text,
  drop_label_key text,
  move_json text not null,
  notation text not null,
  uci text,
  native_notation text,
  elapsed_ms integer,
  remaining_ms_after integer,
  is_capture integer not null default 0,
  captured_piece_code text,
  move_quality text,
  created_at text not null default (datetime('now')),
  unique (game_id, ply)
);

create table if not exists game_positions (
  game_id text not null references games(id) on delete cascade,
  ply integer not null,
  state_json text not null,
  fen_like_state text,
  position_hash text not null,
  turn text not null,
  status text not null,
  result text,
  outcome_reason text,
  halfmove_clock integer,
  repetition_key text,
  clocks_json text not null default '[]',
  captured_json text not null default '[]',
  hands_json text,
  variant_state_json text,
  created_at text not null default (datetime('now')),
  primary key (game_id, ply)
);

create table if not exists game_clocks (
  game_id text not null references games(id) on delete cascade,
  participant_id text not null references game_participants(id) on delete cascade,
  seat text not null,
  remaining_ms integer not null,
  base_ms integer not null,
  increment_ms integer not null,
  last_started_at text,
  total_elapsed_ms integer not null default 0,
  flagged_at text,
  updated_at text not null default (datetime('now')),
  primary key (game_id, participant_id)
);

create table if not exists clock_events (
  id integer primary key autoincrement,
  game_id text not null references games(id) on delete cascade,
  participant_id text references game_participants(id) on delete set null,
  event_type text not null check (event_type in ('start', 'pause', 'tick', 'increment', 'timeout', 'sync', 'move')),
  remaining_ms integer,
  payload text not null default '{}',
  created_at text not null default (datetime('now'))
);

create table if not exists bot_move_audits (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  move_id integer references game_moves(id) on delete set null,
  participant_id text references game_participants(id) on delete set null,
  variant_key text not null,
  tier text not null check (tier in ('easy', 'normal', 'hard', 'very-hard', 'grandmaster', 'legend')),
  knowledge_source text,
  engine text,
  depth integer,
  nodes integer,
  confidence real,
  elapsed_ms integer not null,
  legal_validated integer not null default 0,
  principal_variation text not null default '[]',
  explanation text not null default '{}',
  created_at text not null default (datetime('now'))
);

create index if not exists idx_game_participants_profile_joined on game_participants(profile_id, joined_at);
create index if not exists idx_game_participants_game_type on game_participants(game_id, participant_type);
create index if not exists idx_game_moves_actor_created on game_moves(actor_participant_id, created_at);
create index if not exists idx_game_positions_hash on game_positions(position_hash);
create index if not exists idx_game_positions_game_status on game_positions(game_id, status);
create index if not exists idx_clock_events_game_created on clock_events(game_id, created_at);
create index if not exists idx_bot_move_audits_game_move on bot_move_audits(game_id, move_id);
