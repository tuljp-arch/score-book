-- The Score Book — full schema, Phase 1 + Phase 2
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).
-- Phase 2 tables are included for completeness but shouldn't be wired into the
-- app until Phase 1 is proven with real shooters — see CLAUDE_CODE_PROJECT_BRIEF.md.

-- ===== Phase 1: core =====

create table clubs (
  club_id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  affiliation text,
  nssa_club_number text
);

create table shooters (
  shooter_id uuid primary key default gen_random_uuid(),
  full_name text not null,
  nssa_nsca_number text unique,
  home_club_id uuid references clubs(club_id),
  state_province text,
  joined_at date,
  gear_gun_make text,
  gear_gun_model text,
  gear_load_brand text,
  profile_visibility text default 'public' check (profile_visibility in ('public','club_only','private'))
);

create table classifications (
  classification_id uuid primary key default gen_random_uuid(),
  shooter_id uuid references shooters(shooter_id),
  discipline text not null,
  gauge text not null,
  class text not null,
  effective_date date,
  five_event_average numeric
);

create table events (
  event_id uuid primary key default gen_random_uuid(),
  name text not null,
  club_id uuid references clubs(club_id),
  start_date date,
  end_date date,
  discipline text,
  tier text,
  registration_source text,
  source_event_id text
);

create table rounds (
  round_id uuid primary key default gen_random_uuid(),
  event_id uuid references events(event_id),
  discipline text,
  gauge text,
  target_count int,
  total_shooters_in_gauge int
);

create table results (
  result_id uuid primary key default gen_random_uuid(),
  shooter_id uuid references shooters(shooter_id),
  round_id uuid references rounds(round_id),
  score int,
  possible int,
  award_code text,
  placement_plain_english text,
  squad_id text
);

create table team_results (
  team_result_id uuid primary key default gen_random_uuid(),
  event_id uuid references events(event_id),
  shooter_ids uuid[] not null,
  placement text,
  notes text
);

create index idx_results_shooter on results(shooter_id);
create index idx_results_round on results(round_id);
create index idx_rounds_event on rounds(event_id);
create index idx_classifications_shooter on classifications(shooter_id);

-- ===== Phase 2: handicap, rivals, challenges, casual (build later — see brief) =====

create table shooter_handicaps (
  handicap_id uuid primary key default gen_random_uuid(),
  shooter_id uuid references shooters(shooter_id),
  discipline text not null,
  gauge text not null,
  trailing_average numeric not null,
  handicap numeric not null,
  rounds_used int not null,
  is_provisional boolean not null default true,
  calculated_at timestamptz not null default now(),
  unique (shooter_id, discipline, gauge)
);

create table rivalries (
  rivalry_id uuid primary key default gen_random_uuid(),
  shooter_id_a uuid references shooters(shooter_id),
  shooter_id_b uuid references shooters(shooter_id),
  discipline text,
  gauge text,
  status text default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  initiator_shooter_id uuid references shooters(shooter_id),
  opponent_shooter_id uuid references shooters(shooter_id),
  discipline text not null,
  gauge text not null,
  window_start date not null,
  window_end date not null,
  status text default 'pending' check (status in ('pending','active','completed','declined','expired')),
  created_at timestamptz not null default now()
);

create table challenge_entries (
  challenge_entry_id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(challenge_id),
  shooter_id uuid references shooters(shooter_id),
  result_id uuid references results(result_id),
  gross_score int not null,
  net_score numeric,
  recorded_at timestamptz not null default now()
);

create table casual_events (
  casual_event_id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_shooter_id uuid references shooters(shooter_id),
  club_id uuid references clubs(club_id),
  event_date date not null,
  discipline text,
  gauge text,
  created_at timestamptz not null default now()
);

create table casual_participants (
  casual_participant_id uuid primary key default gen_random_uuid(),
  casual_event_id uuid references casual_events(casual_event_id),
  shooter_id uuid references shooters(shooter_id),
  guest_name text,
  guest_phone text,
  claim_token text unique,
  claimed_at timestamptz
);

create table casual_results (
  casual_result_id uuid primary key default gen_random_uuid(),
  casual_event_id uuid references casual_events(casual_event_id),
  casual_participant_id uuid references casual_participants(casual_participant_id),
  score int,
  possible int,
  notes text,
  verification_status text default 'self_reported' check (verification_status in ('self_reported','witnessed','disputed')),
  recorded_at timestamptz not null default now()
);

create table casual_result_witnesses (
  witness_id uuid primary key default gen_random_uuid(),
  casual_result_id uuid references casual_results(casual_result_id),
  witness_shooter_id uuid references shooters(shooter_id) not null,
  witnessed_score int not null,
  submitted_at timestamptz not null default now(),
  unique (casual_result_id, witness_shooter_id)
);

create index idx_challenge_entries_challenge on challenge_entries(challenge_id);
create index idx_casual_participants_event on casual_participants(casual_event_id);
create index idx_casual_results_event on casual_results(casual_event_id);
create index idx_casual_result_witnesses_result on casual_result_witnesses(casual_result_id);
