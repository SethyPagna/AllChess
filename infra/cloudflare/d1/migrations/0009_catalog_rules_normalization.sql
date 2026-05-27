create table if not exists game_aliases (
  game_id text not null references game_catalog_entries(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale text not null default 'und',
  kind text not null check (kind in ('english', 'native', 'romanization', 'common', 'abbreviation')),
  created_at text not null default (datetime('now')),
  primary key (game_id, alias, locale, kind)
);

create table if not exists game_regions (
  game_id text not null references game_catalog_entries(id) on delete cascade,
  region_code text not null,
  region_name text not null,
  created_at text not null default (datetime('now')),
  primary key (game_id, region_code)
);

create table if not exists rule_sources (
  id text primary key,
  game_id text not null references game_catalog_entries(id) on delete cascade,
  name text not null,
  url text not null,
  publisher text,
  accessed_at text,
  sort_order integer not null default 0,
  created_at text not null default (datetime('now')),
  unique (game_id, url)
);

create table if not exists rule_sections (
  id text primary key,
  game_id text not null references game_catalog_entries(id) on delete cascade,
  rules_version_id text references rules_versions(id) on delete set null,
  section_type text not null check (section_type in ('basics', 'special', 'win', 'draw', 'illegal', 'examples', 'review')),
  sort_order integer not null default 0,
  title text not null,
  body text not null,
  examples text not null default '[]',
  created_at text not null default (datetime('now'))
);

create table if not exists playable_game_verification (
  game_id text primary key references game_catalog_entries(id) on delete cascade,
  rules_complete integer not null default 0,
  bot_complete integer not null default 0,
  review_complete integer not null default 0,
  persistence_complete integer not null default 0,
  e2e_complete integer not null default 0,
  known_gaps text not null default '[]',
  verified_at text,
  updated_at text not null default (datetime('now'))
);

create index if not exists idx_game_aliases_normalized on game_aliases(normalized_alias, kind);
create index if not exists idx_game_aliases_game_kind on game_aliases(game_id, kind);
create index if not exists idx_game_regions_region on game_regions(region_code, game_id);
create index if not exists idx_rule_sources_game_order on rule_sources(game_id, sort_order);
create index if not exists idx_rule_sections_game_type_order on rule_sections(game_id, section_type, sort_order);
create index if not exists idx_playable_game_verification_ready on playable_game_verification(
  rules_complete,
  bot_complete,
  review_complete,
  persistence_complete,
  e2e_complete
);
