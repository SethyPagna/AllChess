create table if not exists matchmaking_tickets (
  ticket_id text primary key,
  profile_id text not null,
  variant_key text not null,
  time_control_key text not null,
  rating_min integer not null,
  rating_max integer not null,
  rated integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'matched', 'cancelled', 'expired')),
  matched_room_id text references rooms(id) on delete set null,
  created_at text not null,
  updated_at text not null default (datetime('now')),
  expires_at text
);

create index if not exists idx_matchmaking_open on matchmaking_tickets(status, variant_key, time_control_key, rated, created_at);
create index if not exists idx_matchmaking_profile_status on matchmaking_tickets(profile_id, status, created_at);
