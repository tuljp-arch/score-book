# Seed Data v2 — Verified from NSSA Records

This replaces the original placeholder seed set. Everything below was pulled directly from your NSSA member history and individual shoot detail pages (member #367202), not reconstructed from memory. Where something still needs your input, it's marked `[FILL IN]`.

## Corrections from the original (v1) seed

1. **Two-Man Championship location was wrong.** v1 guessed this happened at North Atlantic Championship. The actual NSSA record shows both you and Brett Catlin carrying the `2MCH` award code at **Ice Breaker** (Ludlow Fish & Game Club, 04/26/2026), both shooting 90/100. Corrected in `team_results.csv`.

2. **No "Winter League" event appears in the NSSA record.** Your NSSA membership record shows joining 02/20/2026 and zero shoot history prior to that (2025 and earlier years return empty). If Winter League happened, it may have been a non-NSSA-registered club event, or it may be worth double-checking the name/date.

3. **Resolved: the "World Champion" claim checks out, once the name was corrected.** The shooter in question is Connor Ball, not Spencer Ball (both competed at North Atlantic; easy to cross given the shared surname). Connor Ball is a documented two-time NSSA World HOA Champion (2022 and 2024, per NSSA's own event coverage). At North Atlantic 2026, Connor Ball scored 95/100 in the 12ga main; Jeff scored 96/100. This is a real, sourced, head-to-head result — safe to use as a sponsor-facing claim as long as it's phrased precisely (e.g. "outscored two-time NSSA World HOA Champion Connor Ball, 96-95, at North Atlantic 2026" rather than an unqualified "beat the World Champion," since Connor's most recent title was 2024 and the current HOA titleholder is a different shooter — precision protects the claim rather than weakening it).

4. **Current classification is C in both 12ga and 20ga**, not AA/Master. Your scores are trending up within Class A/C range across the season (96, 90, 90, 89, 96 in 12ga), which is a genuinely good trajectory story — just a different one than "veteran champion," more like "fast-rising newer competitor." That may actually be a more compelling sponsor narrative in some ways (growth arc vs. static credential), worth thinking about.

## What's confirmed real

- **You (Jeffrey Tulman, NSSA #367202):** Class A wins at March Madness (96/100) and Spring Open (90/100, 12ga); Class C win + Sub Senior Class Champion at North Atlantic (96/100, 12ga); Two-Man Championship at Ice Breaker with Brett Catlin (90/100)
- **Brett Catlin:** appears in the same events, real scores captured in `results.csv`
- Real clubs, real dates, real gauge-by-gauge breakdowns

## Still needs your input
- Brett's NSSA membership number and home club (not visible on your own member record)
- Confirmation of the "Sub" concurrent class abbreviation (`SU`) — I couldn't fully cross-reference this against the named concurrent-class list on the site (Lady, Sub Junior, Junior, Triple Sub, Sub Sub Senior, Sub Senior, Senior, Veteran, etc.) so I've left it as literally reported rather than guessing
- Host club and confirmed dates for Massachusetts States, Wyoming States, and NSSA Worlds
- The Winter League and World Champion questions above

## Files
- `clubs.csv`, `shooters.csv`, `classifications.csv`, `events.csv`, `rounds.csv`, `results.csv`, `team_results.csv`
