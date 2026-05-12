create extension if not exists "pgcrypto";

create type public.theme_mode as enum ('light', 'dark', 'system');
create type public.game_status as enum ('waiting', 'active', 'completed', 'abandoned');
create type public.game_result as enum ('white_win', 'black_win', 'draw', 'unfinished');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  locale text not null default 'en',
  theme public.theme_mode not null default 'system',
  rating integer not null default 1200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  variant_key text not null,
  status public.game_status not null default 'waiting',
  result public.game_result not null default 'unfinished',
  board_state jsonb not null,
  time_control jsonb not null default '{"baseSeconds":600,"incrementSeconds":5}'::jsonb,
  current_turn text not null default 'white',
  private_code text unique,
  created_by uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  seat text not null check (seat in ('white', 'black', 'red', 'blue', 'sente', 'gote')),
  clock_ms integer not null default 600000,
  joined_at timestamptz not null default now(),
  primary key (game_id, profile_id),
  unique (game_id, seat)
);

create table public.moves (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  move jsonb not null,
  notation text not null,
  board_state_after jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  variant_key text not null,
  room_code text unique not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ratings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  variant_key text not null,
  rating integer not null default 1200,
  games_played integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, variant_key)
);

create table public.variant_stats (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  variant_key text not null,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  best_streak integer not null default 0,
  primary key (profile_id, variant_key)
);

create table public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  provider text not null default 'openai',
  model text not null,
  summary text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id)
);

create table public.user_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.rooms;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.moves enable row level security;
alter table public.rooms enable row level security;
alter table public.ratings enable row level security;
alter table public.variant_stats enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.friendships enable row level security;
alter table public.user_settings enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles are public read" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "games are visible" on public.games for select using (true);
create policy "authenticated users create games" on public.games for insert with check (auth.uid() is not null);
create policy "players update joined games" on public.games for update using (
  exists (
    select 1 from public.game_players gp
    where gp.game_id = games.id and gp.profile_id = auth.uid()
  )
);

create policy "game players visible" on public.game_players for select using (true);
create policy "users join as self" on public.game_players for insert with check (profile_id = auth.uid());

create policy "moves visible" on public.moves for select using (true);
create policy "players insert moves" on public.moves for insert with check (
  exists (
    select 1 from public.game_players gp
    where gp.game_id = moves.game_id and gp.profile_id = auth.uid()
  )
);

create policy "rooms visible" on public.rooms for select using (not is_private or host_id = auth.uid());
create policy "users create rooms" on public.rooms for insert with check (host_id = auth.uid());

create policy "ratings visible" on public.ratings for select using (true);
create policy "variant stats visible" on public.variant_stats for select using (true);
create policy "analysis owner visible" on public.analysis_reports for select using (requested_by = auth.uid());
create policy "users insert analysis" on public.analysis_reports for insert with check (requested_by = auth.uid());
create policy "friendships own rows" on public.friendships for all using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "settings own rows" on public.user_settings for all using (profile_id = auth.uid());
create policy "audit readable by actor" on public.audit_events for select using (actor_id = auth.uid());
