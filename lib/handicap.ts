import { createServerClient } from '@/lib/supabase-server';

// Per CLAUDE_CODE_PROJECT_BRIEF.md, item 6: a trailing average per shooter
// per discipline+gauge, with handicap = 100 - trailing average. This is a
// batch calculation, not something computed live on page load — it's
// triggered right after an NSSA import (see lib/nssa-import.ts), which
// covers "whenever a shooter's new result lands" without needing a
// separate cron job.
//
// Two parameters the brief leaves to us:
// - ROLLING_WINDOW: how many of the shooter's most recent rounds (for that
//   gauge) feed the trailing average. 20 — enough to smooth out one bad
//   day, short enough to track current form rather than career average.
// - MIN_SAMPLE_SIZE: the "10-15 registered rounds" the brief recommends
//   before showing a number as non-provisional. We use 10, the low end —
//   is_provisional exists precisely so a thin sample is still visible but
//   clearly marked, rather than hidden until an arbitrary cutoff.
const ROLLING_WINDOW = 20;
const MIN_SAMPLE_SIZE = 10;

interface ResultRow {
  score: number;
  possible: number;
  round_id: string;
  rounds: { gauge: string | null; discipline: string | null; events: { start_date: string | null } | null } | null;
}

export interface HandicapResult {
  discipline: string;
  gauge: string;
  trailingAverage: number;
  handicap: number;
  roundsUsed: number;
  isProvisional: boolean;
}

// Recalculates and upserts shooter_handicaps for every discipline+gauge a
// shooter has results in. Safe to call repeatedly — each gauge's row is
// fully replaced with the latest window, not accumulated.
export async function recalculateHandicaps(shooterId: string): Promise<HandicapResult[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('results')
    .select(`score, possible, round_id, rounds ( gauge, discipline, events ( start_date ) )`)
    .eq('shooter_id', shooterId);

  const results = (data ?? []) as unknown as ResultRow[];

  const byGaugeDiscipline = new Map<string, ResultRow[]>();
  for (const r of results) {
    const gauge = r.rounds?.gauge;
    const discipline = r.rounds?.discipline;
    if (!gauge || !discipline) continue;
    const key = `${discipline}::${gauge}`;
    (byGaugeDiscipline.get(key) ?? byGaugeDiscipline.set(key, []).get(key)!).push(r);
  }

  const computed: HandicapResult[] = [];

  for (const [key, rows] of Array.from(byGaugeDiscipline)) {
    const [discipline, gauge] = key.split('::');

    const sorted = [...rows].sort((a, b) => {
      const dateA = a.rounds?.events?.start_date ?? '';
      const dateB = b.rounds?.events?.start_date ?? '';
      return dateB.localeCompare(dateA); // most recent first
    });
    const window = sorted.slice(0, ROLLING_WINDOW);

    const totalScore = window.reduce((sum, r) => sum + r.score, 0);
    const totalPossible = window.reduce((sum, r) => sum + r.possible, 0);
    if (totalPossible === 0) continue;

    const trailingAverage = totalScore / totalPossible; // fraction, e.g. 0.9220 — matches classifications.five_event_average
    const handicap = 100 - trailingAverage * 100;
    const roundsUsed = window.length;
    const isProvisional = roundsUsed < MIN_SAMPLE_SIZE;

    const { error } = await supabase.from('shooter_handicaps').upsert(
      {
        shooter_id: shooterId,
        discipline,
        gauge,
        trailing_average: Number(trailingAverage.toFixed(4)),
        handicap: Number(handicap.toFixed(2)),
        rounds_used: roundsUsed,
        is_provisional: isProvisional,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'shooter_id,discipline,gauge' }
    );
    if (error) throw error;

    computed.push({
      discipline,
      gauge,
      trailingAverage: Number(trailingAverage.toFixed(4)),
      handicap: Number(handicap.toFixed(2)),
      roundsUsed,
      isProvisional,
    });
  }

  return computed;
}
