import { createServerClient } from '@/lib/supabase-server';

// Public, shareable leaderboard for one registered event — every shooter's
// score per gauge/round, sorted best-to-worst. Per
// CLAUDE_CODE_PROJECT_BRIEF.md's build order, item 5 (the last Phase 1
// piece before the handicap engine and everything downstream of it).

interface ShooterRow {
  shooter_id: string;
  full_name: string;
}

interface ResultRow {
  score: number;
  possible: number;
  award_code: string | null;
  placement_plain_english: string | null;
  shooters: ShooterRow | null;
}

interface RoundQueryRow {
  round_id: string;
  gauge: string | null;
  discipline: string | null;
  target_count: number | null;
  results: ResultRow[] | null;
}

export interface LeaderboardEntry {
  shooterId: string;
  shooterName: string;
  score: number;
  possible: number;
  awardCode: string | null;
  placementPlainEnglish: string | null;
}

export interface RoundLeaderboard {
  roundId: string;
  gauge: string;
  discipline: string;
  targetCount: number | null;
  entries: LeaderboardEntry[];
}

export interface EventLeaderboardData {
  eventId: string;
  eventName: string;
  clubName: string | null;
  clubLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  rounds: RoundLeaderboard[];
}

export interface EventOption {
  event_id: string;
  name: string;
  start_date: string | null;
}

export async function getEventOptions(): Promise<EventOption[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('events')
    .select('event_id, name, start_date')
    .order('start_date', { ascending: false });
  return data ?? [];
}

export async function getEventLeaderboard(eventId: string): Promise<EventLeaderboardData | null> {
  const supabase = createServerClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, name, start_date, end_date, clubs ( name, location )')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return null;

  const { data: rounds } = await supabase
    .from('rounds')
    .select(
      `round_id, gauge, discipline, target_count,
       results ( score, possible, award_code, placement_plain_english, shooters ( shooter_id, full_name ) )`
    )
    .eq('event_id', eventId)
    .order('score', { foreignTable: 'results', ascending: false });

  const roundRows = (rounds ?? []) as unknown as RoundQueryRow[];

  const roundLeaderboards: RoundLeaderboard[] = roundRows
    .filter((r) => (r.results ?? []).length > 0)
    .map((r) => ({
      roundId: r.round_id,
      gauge: r.gauge ?? '',
      discipline: r.discipline ?? '',
      targetCount: r.target_count,
      entries: (r.results ?? [])
        .filter((res) => res.shooters)
        .map((res) => ({
          shooterId: res.shooters!.shooter_id,
          shooterName: res.shooters!.full_name,
          score: res.score,
          possible: res.possible,
          awardCode: res.award_code,
          placementPlainEnglish: res.placement_plain_english,
        })),
    }))
    .sort((a, b) => a.gauge.localeCompare(b.gauge));

  const club = event.clubs as unknown as { name: string; location: string | null } | null;

  return {
    eventId: event.event_id,
    eventName: event.name,
    clubName: club?.name ?? null,
    clubLocation: club?.location ?? null,
    startDate: event.start_date,
    endDate: event.end_date,
    rounds: roundLeaderboards,
  };
}
