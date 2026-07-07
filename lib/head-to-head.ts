import { createServerClient } from '@/lib/supabase-server';

// Given two shooter IDs, show every round where both appear, gross scores
// side by side — per CLAUDE_CODE_PROJECT_BRIEF.md's build order, item 4.
// Deliberately gross-only: net/handicap comparison is Phase 2 and depends
// on the handicap engine, which doesn't exist yet.

interface EventRow {
  event_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

interface RoundRow {
  round_id: string;
  discipline: string | null;
  gauge: string | null;
  events: EventRow | null;
}

interface ResultRow {
  score: number;
  possible: number;
  round_id: string;
  rounds: RoundRow | null;
}

export interface HeadToHeadRow {
  eventName: string;
  eventDate: string;
  sortDate: string;
  gauge: string;
  discipline: string;
  scoreA: number;
  possibleA: number;
  scoreB: number;
  possibleB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface HeadToHeadData {
  shooterA: { id: string; name: string };
  shooterB: { id: string; name: string };
  rows: HeadToHeadRow[];
  record: { aWins: number; bWins: number; ties: number };
}

export interface ShooterOption {
  shooter_id: string;
  full_name: string;
}

export async function getShooterOptions(): Promise<ShooterOption[]> {
  const supabase = createServerClient();
  const { data } = await supabase.from('shooters').select('shooter_id, full_name').order('full_name');
  return data ?? [];
}

async function fetchResultsByRound(
  supabase: ReturnType<typeof createServerClient>,
  shooterId: string
): Promise<Map<string, ResultRow>> {
  const { data } = await supabase
    .from('results')
    .select(
      `score, possible, round_id,
       rounds ( round_id, discipline, gauge,
         events ( event_id, name, start_date, end_date ) )`
    )
    .eq('shooter_id', shooterId);

  const rows = (data ?? []) as unknown as ResultRow[];
  return new Map(rows.map((r) => [r.round_id, r]));
}

export async function getHeadToHeadData(shooterIdA: string, shooterIdB: string): Promise<HeadToHeadData | null> {
  const supabase = createServerClient();

  const { data: shooters } = await supabase
    .from('shooters')
    .select('shooter_id, full_name')
    .in('shooter_id', [shooterIdA, shooterIdB]);
  const shooterA = shooters?.find((s) => s.shooter_id === shooterIdA);
  const shooterB = shooters?.find((s) => s.shooter_id === shooterIdB);
  if (!shooterA || !shooterB) return null;

  const [resultsA, resultsB] = await Promise.all([
    fetchResultsByRound(supabase, shooterIdA),
    fetchResultsByRound(supabase, shooterIdB),
  ]);

  const rows: HeadToHeadRow[] = [];
  for (const [roundId, a] of Array.from(resultsA)) {
    const b = resultsB.get(roundId);
    if (!b || !a.rounds?.events) continue;

    const winner: HeadToHeadRow['winner'] = a.score > b.score ? 'A' : a.score < b.score ? 'B' : 'tie';
    rows.push({
      eventName: a.rounds.events.name,
      // Multi-day events (e.g. North Atlantic) should display the closing
      // date, matching the profile page's convention — see eventDisplayDateOf
      // in lib/profile-data.ts.
      eventDate: a.rounds.events.end_date ?? a.rounds.events.start_date ?? '',
      sortDate: a.rounds.events.start_date ?? '',
      gauge: a.rounds.gauge ?? '',
      discipline: a.rounds.discipline ?? '',
      scoreA: a.score,
      possibleA: a.possible,
      scoreB: b.score,
      possibleB: b.possible,
      winner,
    });
  }
  rows.sort((x, y) => x.sortDate.localeCompare(y.sortDate));

  const record = rows.reduce(
    (acc, r) => {
      if (r.winner === 'A') acc.aWins += 1;
      else if (r.winner === 'B') acc.bWins += 1;
      else acc.ties += 1;
      return acc;
    },
    { aWins: 0, bWins: 0, ties: 0 }
  );

  return {
    shooterA: { id: shooterA.shooter_id, name: shooterA.full_name },
    shooterB: { id: shooterB.shooter_id, name: shooterB.full_name },
    rows,
    record,
  };
}
