-- Players whose data should be scraped nightly
create table tracked_players (
  id uuid primary key default gen_random_uuid(),
  member_id text not null unique,
  first_name text,
  last_name text,
  city text,
  state text,
  apa_id text,
  created_at timestamptz not null default now(),
  last_scraped_at timestamptz,
  scrape_enabled boolean not null default true
);

-- Each team/season a player has been on
create table player_team_seasons (
  id uuid primary key default gen_random_uuid(),
  tracked_player_id uuid not null references tracked_players(id) on delete cascade,
  apa_team_id text not null,
  apa_player_id text not null,
  team_name text not null,
  game_type text not null,
  season text not null,
  season_year int not null,
  skill_level int,
  created_at timestamptz not null default now(),
  unique(tracked_player_id, apa_team_id)
);

-- Team matches
create table team_matches (
  id uuid primary key default gen_random_uuid(),
  apa_match_id text not null unique,
  team_season_id uuid not null references player_team_seasons(id) on delete cascade,
  match_date timestamptz,
  location text,
  home_team_id text,
  home_team_name text,
  away_team_id text,
  away_team_name text,
  home_team_score int,
  away_team_score int,
  created_at timestamptz not null default now()
);

-- Individual player matchups within a team match
create table player_matches (
  id uuid primary key default gen_random_uuid(),
  team_match_id uuid not null references team_matches(id) on delete cascade,
  match_order int not null,
  home_player_id text,
  home_player_name text,
  home_skill_level int,
  home_score int,
  home_innings int,
  home_defensive_shots int,
  home_games_won int,
  away_player_id text,
  away_player_name text,
  away_skill_level int,
  away_score int,
  away_innings int,
  away_defensive_shots int,
  away_games_won int,
  created_at timestamptz not null default now(),
  unique(team_match_id, match_order)
);

-- Indexes
create index idx_player_team_seasons_player on player_team_seasons(tracked_player_id);
create index idx_team_matches_team_season on team_matches(team_season_id);
create index idx_player_matches_team_match on player_matches(team_match_id);
create index idx_tracked_players_member_id on tracked_players(member_id);

-- RLS (service role bypasses)
alter table tracked_players enable row level security;
alter table player_team_seasons enable row level security;
alter table team_matches enable row level security;
alter table player_matches enable row level security;
