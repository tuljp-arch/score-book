-- Seed data — real, verified 2026 season results (see seed_data_v2/README.md
-- for the full provenance and the corrections made along the way).
-- Run after schema.sql. Safe to re-run against an empty database only —
-- this doesn't handle conflicts/upserts.

insert into clubs (club_id, name, location, affiliation, nssa_club_number) values
  ('00000000-0000-0000-0000-000000000001', 'Minute Man Sportsmans Club Inc', 'Massachusetts', 'NSSA', '15562'),
  ('00000000-0000-0000-0000-000000000002', 'Massapoag Sportsmen''s Club', 'Massachusetts', 'NSSA', '15570'),
  ('00000000-0000-0000-0000-000000000003', 'Old Colony Sportsmen''s Assn', 'Massachusetts', 'NSSA', '15564'),
  ('00000000-0000-0000-0000-000000000004', 'Ludlow Fish & Game Club', 'Massachusetts', 'NSSA', '15560'),
  ('00000000-0000-0000-0000-000000000005', 'Fall River Rod & Gun Club', 'Massachusetts', 'NSSA', '16514');

insert into shooters (shooter_id, full_name, nssa_nsca_number, home_club_id, state_province, joined_at, gear_gun_make, gear_gun_model) values
  ('10000000-0000-0000-0000-000000000001', 'Jeffrey Tulman', '367202', '00000000-0000-0000-0000-000000000001', 'MA', '2026-02-20', 'Beretta', 'SO5 (competition), 687 EELL (field)'),
  ('10000000-0000-0000-0000-000000000002', 'Brett Catlin', null, null, null, null, null, null);

insert into classifications (shooter_id, discipline, gauge, class, effective_date, five_event_average) values
  ('10000000-0000-0000-0000-000000000001', 'skeet', '12ga', 'C', '2026-06-01', 0.9220),
  ('10000000-0000-0000-0000-000000000001', 'skeet', '20ga', 'C', '2026-06-01', 0.8800);

insert into events (event_id, name, club_id, start_date, end_date, discipline, tier, registration_source, source_event_id) values
  ('20000000-0000-0000-0000-000000000001', 'March Madness - 12 & 20 Ga', '00000000-0000-0000-0000-000000000002', '2026-03-29', '2026-03-29', 'skeet', 'club/regional', 'nssa_official', '169637'),
  ('20000000-0000-0000-0000-000000000002', 'Spring Open (2026)', '00000000-0000-0000-0000-000000000003', '2026-04-11', '2026-04-11', 'skeet', 'club/regional', 'nssa_official', '169913'),
  ('20000000-0000-0000-0000-000000000003', 'Ice Breaker 2026', '00000000-0000-0000-0000-000000000004', '2026-04-26', '2026-04-26', 'skeet', 'club/regional', 'nssa_official', '169644'),
  ('20000000-0000-0000-0000-000000000004', 'Fall River Spring Open', '00000000-0000-0000-0000-000000000005', '2026-05-09', '2026-05-09', 'skeet', 'club/regional', 'nssa_official', '169439'),
  ('20000000-0000-0000-0000-000000000005', 'North Atlantic', '00000000-0000-0000-0000-000000000001', '2026-05-15', '2026-05-17', 'skeet', 'regional', 'nssa_official', '170517');

insert into rounds (round_id, event_id, discipline, gauge, target_count, total_shooters_in_gauge) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'skeet', '12ga', 100, 11),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'skeet', '12ga', 100, 14),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'skeet', '20ga', 100, 14),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'skeet', '12ga', 100, 28),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'skeet', '12ga', 100, 18),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'skeet', '12ga', 100, 22),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000005', 'skeet', '20ga', 100, 23);

insert into results (shooter_id, round_id, score, possible, award_code, placement_plain_english) values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 96, 100, 'A1', '1st place - Class A'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 90, 100, 'A1', '1st place - Class A'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 88, 100, 'C2,SS3', '2nd Class C; 3rd Sub Senior'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 90, 100, '2MCH', 'Two-Man Championship (with Brett Catlin)'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 89, 100, 'SS3', '3rd Sub Senior'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 96, 100, 'C1,SSCH', '1st Class C; Sub Senior Champion; outscored 2x World HOA Champion Connor Ball (95)'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 88, 100, 'C3,SSRU', '3rd Class C; Sub Senior Runner-up'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 90, 100, 'C3,SURU', '3rd Class C'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 84, 100, 'D2,SURU', '2nd Class D'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 90, 100, '2MCH,C3,SU3', 'Two-Man Championship (with Jeff); 3rd Class C'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', 94, 100, 'SUCH', 'Sub concurrent class Champion'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', 90, 100, 'D1,SURU', '1st Class D');

insert into team_results (event_id, shooter_ids, placement, notes) values
  ('20000000-0000-0000-0000-000000000003', ARRAY['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[], 'Two-Man Championship (2MCH)', 'Ice Breaker, 04/26/2026 — both shooters at 90/100');
