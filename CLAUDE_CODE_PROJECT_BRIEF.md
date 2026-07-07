# The Score Book — Project Brief for Claude Code

Hand this file (and the SQL below) directly to Claude Code as the starting point. It has the context, the recommended stack, and the schema already translated into runnable SQL, so the first session can go straight to scaffolding instead of re-deriving decisions.

## What this is

A shooter performance/analytics app for competitive skeet — the "Strava" layer that sits on top of NSSA's own registration and scoring, not a replacement for it. Full context in the two docs referenced at the bottom if Claude Code wants to read them.

## Build order (don't skip ahead)

1. **Auth + account connect flow.** A shooter creates an account, then "connects" their NSSA member number. For the MVP, this can be a manual step (shooter pastes in their NSSA member number and the app fetches their public history pages), not a full OAuth integration — NSSA doesn't offer a public API, so don't build one that assumes it does.
2. **Import + normalize.** Pull a shooter's shoot history and individual event award pages, parse them into the schema below. This is the hardest and most important part — get it right before anything else.
3. **Shooter profile page.** Career scores, trend line by gauge, personal bests, classification history.
4. **Head-to-head.** Given two shooter IDs, show every event/round where both appear, with scores side by side.
5. **Event/club leaderboard page.** Public, shareable, one per event.

Do not start on leaderboards or head-to-head before the import pipeline works end-to-end for at least one real shooter. That pipeline is the whole product; everything else is a view on top of it.

## Phase 2 — after the MVP core works (don't start these early)

Build in this order, each one depends conceptually on the last:

6. **Handicap engine.** Per shooter, per discipline+gauge: trailing average over a rolling window (last N rounds or last 12 months — 12ga and 20ga calculated separately, matching how NSSA already splits classification by gauge). Handicap = 100 − trailing average. Mark as `is_provisional = true` below a minimum sample size (recommend 10–15 registered rounds) rather than showing a precise number too early. This is a batch job that recalculates on a schedule or whenever a shooter's new result lands — not something computed live on page load.
7. **Rivals.** Any shooter can flag another as a rival (mutual or one-directional, your call). The rival's page auto-surfaces every comparable result either of you logs, gross and net side by side, labeled clearly as "same course spec, different day" rather than implying simultaneity.
8. **Challenges.** Time-boxed, opt-in: shooter A invites shooter B to a challenge window (discipline, gauge, deadline). When both have a qualifying registered result in that window, show gross and net side by side and declare a net winner. This is the shareable, inviteable unit — worth a clean "share the result" view since it's the most likely thing to get sent around a group chat.
9. **Ladders.** Opt-in leaderboards filterable by class, gauge, region, and (once handicap exists) a net-score national ladder that doesn't require class-matching at all.
10. **Casual Rounds — build as a genuinely separate track, not a variant of the above.** Self-reported, unverified rounds for club fun-shoots or informal friend groups. Key rules:
    - Its own tables, its own leaderboards — never merges into `results`, the verified trophy shelf, or the handicap calculation
    - Organizer can add participants by name/phone before they have an account; that person gets a claim link — this is the primary viral/invite loop for the whole app, worth real product attention
    - **Three-tier verification within the casual track itself:** Verified (NSSA, from `results`) / Witnessed (a second real account independently entered a matching score, without seeing the shooter's entry first) / Reported (pure self-report). Witnessed requires the witness to be a real, named account — an anonymous or throwaway-account witness has no reputational cost and verifies nothing. A mismatch between the shooter's entry and the witness's is a `disputed` state, shown as-is with both numbers — don't try to auto-resolve which one is correct.
    - **Witnessed stays firmly on the casual side of the wall.** It does not feed the handicap engine, Challenges, or Ladders — those stay NSSA-verified-only. Witnessed is a real trust upgrade over self-report, but it's not backed by an enforcement body the way NSSA is, so it shouldn't become load-bearing for anything competitive.
    - Every casual result surface (UI, exports, shares) should visibly show its tier — this isn't a legal disclaimer, it's what protects the credibility of the verified side

## Design system notes (carry these into every screen, not just the profile page)

- **Medal tiers are not just size — they're different shapes.** Tier 1 (a landmark head-to-head result, e.g. beating a multi-time champion) gets the full medal-and-ribbon treatment plus a laurel and a subtle shine animation — reserve this for genuinely rare things. Tier 2 (a real championship — class win, concurrent-class champion, team title) gets the standard medal-and-ribbon, no laurel, no animation. Tier 3 (a good result that isn't a championship) is a small flat chip with no ribbon at all — different iconography, not just a smaller version of the same icon. If a lower tier ever gets visually confused with tier 1, the system has failed.
- **Peacock zone at the top, substantiation below.** Established on the profile page: name, medals, and gear photos all live in the first screen's worth of scroll with minimal text; the detailed cards, stats, and full history live below for whoever scrolls further. Apply the same split to Challenge results pages, ladder pages, and casual event recaps — best result up top, full detail below.
- **Verification tier needs to be visually obvious at a glance, not just labeled in small text** — different background treatment or a persistent badge for Verified / Witnessed / Reported, not a tooltip. Three tiers, not two, and the gap between "Verified" and everything else should read as the biggest gap in the system.

## Recommended stack (optimize for one person shipping fast, not for scale)

- **Framework:** Next.js (App Router) — one codebase for frontend and API routes, easy to deploy
- **Database + auth:** Supabase (Postgres + built-in auth) — avoids standing up a separate auth system, and Postgres maps directly onto the relational schema below
- **Hosting:** Vercel (pairs naturally with Next.js) for the app; Supabase's own hosting for the database
- **Import/scraping layer:** a small server-side job (Node, using something like Playwright/Puppeteer if pages require JS rendering, or plain fetch + HTML parsing like Cheerio if not) that runs when a shooter connects their account, and can be re-run manually per shooter to refresh
- **Why not no-code (Bubble/Airtable):** the import/parsing logic is genuinely custom and will need real code and iteration; no-code tools will fight you here more than they help

If Claude Code or a developer prefers a different stack (e.g. Rails, Django), the schema below translates directly — it's deliberately plain relational SQL, no framework-specific assumptions.

## Important constraint carried over from the pilot

NSSA data was only accessible today because a logged-in member was viewing their own pages. **Any import feature must work the same way** — a shooter authenticates to NSSA (or supplies their own already-authenticated session) and the app reads only what that shooter can already see about themselves. Do not build a feature that scrapes other shooters' data without them individually connecting their own account. This is both an ethical line and the actual foundation of the eventual NSSA relationship (see the one-pager referenced below) — a scraping-without-consent architecture would undermine that conversation before it starts.

## Schema (Postgres DDL)

```sql
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

-- indexes worth having from day one
create index idx_results_shooter on results(shooter_id);
create index idx_results_round on results(round_id);
create index idx_rounds_event on rounds(event_id);
create index idx_classifications_shooter on classifications(shooter_id);
```

## Phase 2 schema additions (handicap, rivals, challenges, casual)

```sql
-- Handicaps: recalculated by a batch job, not computed live.
-- One row per shooter per discipline+gauge.
create table shooter_handicaps (
  handicap_id uuid primary key default gen_random_uuid(),
  shooter_id uuid references shooters(shooter_id),
  discipline text not null,
  gauge text not null,
  trailing_average numeric not null,
  handicap numeric not null,
  rounds_used int not null,
  is_provisional boolean not null default true, -- true below the minimum sample size
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

-- Links a challenge to each participant's qualifying registered result
-- once it lands during the challenge window. Gross comes straight from
-- results.score; net is computed at read time using shooter_handicaps
-- (don't freeze it at insert time — a shooter's handicap can update
-- mid-window, and net should reflect the handicap at settlement, not creation).
create table challenge_entries (
  challenge_entry_id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(challenge_id),
  shooter_id uuid references shooters(shooter_id),
  result_id uuid references results(result_id),
  gross_score int not null,
  net_score numeric,
  recorded_at timestamptz not null default now()
);

-- ---- Casual Rounds: deliberately isolated from everything above.
-- No foreign keys pointing at `results`, `rounds`, or `shooter_handicaps`.
-- This is the whole point: a bug or a bad actor in casual data can
-- never leak into or dilute the verified side.

create table casual_events (
  casual_event_id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_shooter_id uuid references shooters(shooter_id),
  club_id uuid references clubs(club_id), -- nullable; "just friends" has no club
  event_date date not null,
  discipline text,
  gauge text,
  created_at timestamptz not null default now()
);

create table casual_participants (
  casual_participant_id uuid primary key default gen_random_uuid(),
  casual_event_id uuid references casual_events(casual_event_id),
  shooter_id uuid references shooters(shooter_id), -- null until claimed
  guest_name text,
  guest_phone text,
  claim_token text unique, -- used to generate the "claim your score" link
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

-- A witness independently enters the score they observed, without seeing
-- the shooter's own entry first (enforce this in the UI — don't show the
-- shooter's number on the witness's entry screen). App logic on submit:
--   witnessed_score == casual_results.score  -> set verification_status = 'witnessed'
--   witnessed_score != casual_results.score  -> set verification_status = 'disputed'
--     (show both numbers; do not attempt to auto-resolve which is correct)
-- witness_shooter_id must be a real account, not a guest/unclaimed participant —
-- an anonymous witness has no reputational cost and verifies nothing.
create table casual_result_witnesses (
  witness_id uuid primary key default gen_random_uuid(),
  casual_result_id uuid references casual_results(casual_result_id),
  witness_shooter_id uuid references shooters(shooter_id) not null,
  witnessed_score int not null,
  submitted_at timestamptz not null default now(),
  unique (casual_result_id, witness_shooter_id) -- one witness can't submit twice on the same result
);

create index idx_challenge_entries_challenge on challenge_entries(challenge_id);
create index idx_casual_participants_event on casual_participants(casual_event_id);
create index idx_casual_results_event on casual_results(casual_event_id);
create index idx_casual_result_witnesses_result on casual_result_witnesses(casual_result_id);
```

## Reference docs (from earlier planning — bring these into the Claude Code session if useful)

- `shooter_platform_data_schema.md` — original field-level schema this SQL was derived from
- `seed_data_v2/` — real, verified seed data (Jeff Tulman, NSSA #367202, 2026 season) that can be inserted directly for local testing once the tables exist
- `nssa_nsca_pilot_one_pager.md` — the pitch to bring to NSSA before this goes beyond a closed pilot; worth having in mind so the import feature doesn't accidentally violate the spirit of it
- `score_book_landing_page.html` — validation landing page
- `score_book_profile_mockup.html` — visual reference for the profile page, including the medal-tier system and top-of-page showcase layout described above

## Scope discipline

Everything in "Phase 2 schema additions" is real and worth building — but not in the first session, and arguably not before the MVP core has been used by at least a handful of real shooters. The handicap engine in particular is only meaningful once there's enough result data to make the numbers stable; building it against an empty database just produces confident-looking nonsense. Sequence matters more than completeness here.

## First session goal for Claude Code

Get a working local dev environment with the schema above created in Supabase, a basic auth flow (email/password or magic link), and one hardcoded shooter's data (from the seed set) rendering on a profile page. That's the whole first milestone — resist the urge to build more before that works end-to-end.
