import { createServerClient } from '@/lib/supabase-server';

// Per CLAUDE_CODE_PROJECT_BRIEF.md, item 9: opt-in leaderboards filterable
// by class, gauge, region, plus a net-score ladder that ignores class
// entirely (only possible now that the handicap engine exists).
//
// "Opt-in" reuses shooters.profile_visibility rather than adding a new
// column — it already defaults to 'public' and exists for exactly this
// purpose (a shooter can go private and drop off public surfaces). Ranking
// is by classifications.five_event_average (class ladder, higher is
// better) or shooter_handicaps.handicap (net ladder, lower is better).
//
// Known gap: region filtering only works for shooters whose
// state_province is actually set — the importer never populates it (NSSA's
// pages don't surface it in a form we've parsed), so real-imported
// shooters (e.g. Connor Ball) won't appear under any specific state, only
// under "All regions." The filter itself is correct; the data just isn't
// there yet for anyone who didn't come from the original hand-seeded rows.

export const GAUGE_OPTIONS = ['12ga', '20ga', '28ga', '410', 'doubles'];

export interface ClassLadderRow {
  shooterId: string;
  shooterName: string;
  klass: string;
  average: number;
  region: string | null;
}

export interface NetLadderRow {
  shooterId: string;
  shooterName: string;
  handicap: number;
  isProvisional: boolean;
  region: string | null;
}

export async function getRegionOptions(): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('shooters')
    .select('state_province')
    .eq('profile_visibility', 'public')
    .not('state_province', 'is', null);
  const regions = new Set((data ?? []).map((r) => r.state_province as string));
  return Array.from(regions).sort();
}

export async function getClassLadder(params: {
  discipline: string;
  gauge: string;
  klass?: string;
  region?: string;
}): Promise<ClassLadderRow[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('classifications')
    .select(
      `class, five_event_average,
       shooters!inner ( shooter_id, full_name, state_province, profile_visibility )`
    )
    .eq('discipline', params.discipline)
    .eq('gauge', params.gauge)
    .eq('shooters.profile_visibility', 'public')
    .not('five_event_average', 'is', null);

  if (params.klass) query = query.eq('class', params.klass);
  if (params.region) query = query.eq('shooters.state_province', params.region);

  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    class: string;
    five_event_average: number;
    shooters: { shooter_id: string; full_name: string; state_province: string | null };
  }[];

  return rows
    .map((r) => ({
      shooterId: r.shooters.shooter_id,
      shooterName: r.shooters.full_name,
      klass: r.class,
      average: r.five_event_average,
      region: r.shooters.state_province,
    }))
    .sort((a, b) => b.average - a.average);
}

export async function getNetLadder(params: { discipline: string; gauge: string; region?: string }): Promise<NetLadderRow[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('shooter_handicaps')
    .select(
      `handicap, is_provisional,
       shooters!inner ( shooter_id, full_name, state_province, profile_visibility )`
    )
    .eq('discipline', params.discipline)
    .eq('gauge', params.gauge)
    .eq('shooters.profile_visibility', 'public');

  if (params.region) query = query.eq('shooters.state_province', params.region);

  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    handicap: number;
    is_provisional: boolean;
    shooters: { shooter_id: string; full_name: string; state_province: string | null };
  }[];

  return rows
    .map((r) => ({
      shooterId: r.shooters.shooter_id,
      shooterName: r.shooters.full_name,
      handicap: r.handicap,
      isProvisional: r.is_provisional,
      region: r.shooters.state_province,
    }))
    .sort((a, b) => a.handicap - b.handicap);
}

export async function getClassOptions(discipline: string, gauge: string): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('classifications')
    .select('class')
    .eq('discipline', discipline)
    .eq('gauge', gauge);
  const classes = new Set((data ?? []).map((r) => r.class as string));
  return Array.from(classes).sort();
}
