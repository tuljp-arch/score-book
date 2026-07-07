# Shooter Platform — Data Schema (v0.1)

Purpose: minimum schema to seed Phase 1 (historical import) and support the Phase 2–3 shooter profile, leaderboard, and head-to-head features. Designed to be populated from Score Chaser / Winscore exports first, with an eye toward a live API/webhook feed later.

---

## 1. `shooters`
Core identity record. One row per person.

| Field | Type | Notes |
|---|---|---|
| shooter_id | UUID | Primary key |
| full_name | string | |
| nssa_nsca_number | string | "Crossfire" number — the join key against official results if/when you get data access |
| home_club_id | FK → clubs | |
| state_province | string | For circuit/region grouping |
| joined_at | date | When they created a platform profile (not membership date) |
| gear_gun_make | string, nullable | Self-reported, optional at signup |
| gear_gun_model | string, nullable | |
| gear_load_brand | string, nullable | For the brand/sponsor data layer |
| profile_visibility | enum | public / club-only / private |

## 2. `classifications`
Time-series — classification changes over a season, this is what makes trend lines possible.

| Field | Type | Notes |
|---|---|---|
| classification_id | UUID | PK |
| shooter_id | FK → shooters | |
| discipline | enum | skeet / trap / sporting_clays / 5-stand |
| gauge | enum | 12 / 20 / 28 / .410 |
| class | string | e.g. AA, A, B, C, D, Master |
| effective_date | date | |

## 3. `clubs`
| Field | Type | Notes |
|---|---|---|
| club_id | UUID | PK |
| name | string | |
| location | geo (lat/lng or state+city) | Needed for your venue density mapping |
| affiliation | enum | NSSA / NSCA / both / independent |

## 4. `events`
A tournament, not a single round.

| Field | Type | Notes |
|---|---|---|
| event_id | UUID | PK |
| name | string | e.g. "Massachusetts States 2026" |
| club_id | FK → clubs | Host venue |
| start_date | date | |
| end_date | date | |
| discipline | enum | |
| tier | enum | club / state / regional / national / world |
| registration_source | enum | score_chaser / winscore / manual_import |
| source_event_id | string, nullable | External ID for later reconciliation/API sync |

## 5. `rounds`
A single event/entry within a tournament (e.g. "12ga Class Champion 100 target event").

| Field | Type | Notes |
|---|---|---|
| round_id | UUID | PK |
| event_id | FK → events | |
| discipline | enum | |
| gauge | enum | |
| target_count | integer | e.g. 100, 200 |
| class_at_event | string | Shooter's class for this specific round |

## 6. `results`
The core fact table. One row per shooter per round.

| Field | Type | Notes |
|---|---|---|
| result_id | UUID | PK |
| shooter_id | FK → shooters | |
| round_id | FK → rounds | |
| score | integer | |
| possible | integer | e.g. /100 |
| x_count | integer, nullable | Straight/X's if tracked |
| shootoff_result | string, nullable | won / lost / n/a |
| placement | integer, nullable | Within class |
| squad_id | string, nullable | For head-to-head/rival matching |

## 7. `sponsor_tags` (later — v0.2, optional at launch)
Lightweight join table for the brand data layer. Keep separate from `shooters` so gear data can update independently and you can query "how many active shooters used Brand X this season" cleanly.

| Field | Type | Notes |
|---|---|---|
| tag_id | UUID | PK |
| shooter_id | FK → shooters | |
| brand | string | |
| category | enum | gun / ammo / apparel / optics |
| self_reported | boolean | true unless verified via sponsor partnership |

---

## Build notes

- **Phase 1 import**: you only strictly need `shooters`, `events`, `rounds`, `results` populated from CSV exports to get a working profile + leaderboard. Everything else layers on.
- **Classification history matters more than it looks**: it's the thing that makes a shooter's page feel like a career, not a stat dump — prioritize backfilling this even if it's manual for your circuit's shooters first.
- **Don't overbuild the gear/sponsor layer yet.** It's valuable but self-reported gear data is low-trust until you have real sponsor partnerships to verify against. Ship it as a nice-to-have field, not a core feature, until Phase 4.
- **Squad_id is worth capturing even loosely** (a string, not a strict foreign key) — it's what makes head-to-head and "who have I shot against" features possible without needing a fully normalized squadding system.
