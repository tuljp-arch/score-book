import { createServerClient } from '@/lib/supabase-server';

// Per CLAUDE_CODE_PROJECT_BRIEF.md, item 8: shooter A invites shooter B to
// a time-boxed window (discipline, gauge, deadline). Once both have a
// qualifying registered result in that window, show gross and net side by
// side and declare a net winner. Unlike Rivals (no accept step, just a
// saved comparison), Challenges genuinely models a request/response —
// the schema's status enum (pending/active/declined/expired/completed)
// implies the opponent must accept before it's live.
//
// Settlement (checking whether both sides now have a qualifying result)
// happens two ways, both idempotent: right after an import completes for
// either shooter (see lib/nssa-import.ts), and lazily whenever the
// challenges list is read — matching the brief's "batch job... or
// whenever a shooter's new result lands," without needing real cron
// infrastructure for an app this size.
//
// net = gross + handicap, scaled to the round's target count — same
// formula as head-to-head — computed once at settlement and frozen in
// challenge_entries.net_score from then on, per the schema's own comment:
// a shooter's handicap can keep moving after the challenge is decided,
// and the result shouldn't retroactively change because of that.

type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'expired';

interface ChallengeRow {
  challenge_id: string;
  initiator_shooter_id: string;
  opponent_shooter_id: string;
  discipline: string;
  gauge: string;
  window_start: string;
  window_end: string;
  status: ChallengeStatus;
}

export interface ChallengeEntry {
  shooterId: string;
  shooterName: string;
  grossScore: number;
  netScore: number | null;
}

export interface ChallengeSummary {
  challengeId: string;
  initiatorId: string;
  initiatorName: string;
  opponentId: string;
  opponentName: string;
  discipline: string;
  gauge: string;
  windowStart: string;
  windowEnd: string;
  status: ChallengeStatus;
  entries: ChallengeEntry[];
}

const GAUGE_OPTIONS = ['12ga', '20ga', '28ga', '410', 'doubles'];

export function getGaugeOptions(): string[] {
  return GAUGE_OPTIONS;
}

async function findQualifyingResult(
  supabase: ReturnType<typeof createServerClient>,
  shooterId: string,
  discipline: string,
  gauge: string,
  windowStart: string,
  windowEnd: string
): Promise<{ resultId: string; score: number; possible: number } | null> {
  const { data } = await supabase
    .from('results')
    .select(`result_id, score, possible, rounds ( discipline, gauge, events ( start_date, end_date ) )`)
    .eq('shooter_id', shooterId);

  const rows = (data ?? []) as unknown as {
    result_id: string;
    score: number;
    possible: number;
    rounds: { discipline: string | null; gauge: string | null; events: { start_date: string | null; end_date: string | null } | null } | null;
  }[];

  const candidates = rows.filter((r) => {
    if (r.rounds?.discipline !== discipline || r.rounds?.gauge !== gauge) return false;
    const d = r.rounds?.events?.end_date ?? r.rounds?.events?.start_date;
    if (!d) return false;
    return d >= windowStart && d <= windowEnd;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score); // best qualifying result in the window
  const best = candidates[0];
  return { resultId: best.result_id, score: best.score, possible: best.possible };
}

async function getHandicapFor(
  supabase: ReturnType<typeof createServerClient>,
  shooterId: string,
  discipline: string,
  gauge: string
): Promise<number | null> {
  const { data } = await supabase
    .from('shooter_handicaps')
    .select('handicap')
    .eq('shooter_id', shooterId)
    .eq('discipline', discipline)
    .eq('gauge', gauge)
    .maybeSingle();
  return data?.handicap ?? null;
}

// Settles one challenge if both sides now qualify. Safe to call
// repeatedly — does nothing once challenge_entries already exist.
export async function attemptSettlement(challengeId: string): Promise<void> {
  const supabase = createServerClient();
  const { data: challenge } = await supabase
    .from('challenges')
    .select('*')
    .eq('challenge_id', challengeId)
    .maybeSingle();
  if (!challenge || challenge.status !== 'active') return;

  const { data: existingEntries } = await supabase
    .from('challenge_entries')
    .select('challenge_entry_id')
    .eq('challenge_id', challengeId);
  if ((existingEntries ?? []).length > 0) return; // already settled

  const [a, b] = await Promise.all([
    findQualifyingResult(
      supabase,
      challenge.initiator_shooter_id,
      challenge.discipline,
      challenge.gauge,
      challenge.window_start,
      challenge.window_end
    ),
    findQualifyingResult(
      supabase,
      challenge.opponent_shooter_id,
      challenge.discipline,
      challenge.gauge,
      challenge.window_start,
      challenge.window_end
    ),
  ]);
  if (!a || !b) return; // not both qualifying yet

  const [handicapA, handicapB] = await Promise.all([
    getHandicapFor(supabase, challenge.initiator_shooter_id, challenge.discipline, challenge.gauge),
    getHandicapFor(supabase, challenge.opponent_shooter_id, challenge.discipline, challenge.gauge),
  ]);

  const netA = handicapA !== null ? Number((a.score + handicapA * (a.possible / 100)).toFixed(1)) : null;
  const netB = handicapB !== null ? Number((b.score + handicapB * (b.possible / 100)).toFixed(1)) : null;

  const { error } = await supabase.from('challenge_entries').insert([
    {
      challenge_id: challengeId,
      shooter_id: challenge.initiator_shooter_id,
      result_id: a.resultId,
      gross_score: a.score,
      net_score: netA,
    },
    {
      challenge_id: challengeId,
      shooter_id: challenge.opponent_shooter_id,
      result_id: b.resultId,
      gross_score: b.score,
      net_score: netB,
    },
  ]);
  if (error) throw error;

  await supabase.from('challenges').update({ status: 'completed' }).eq('challenge_id', challengeId);
}

// Attempts settlement for every active challenge involving this shooter —
// called right after their import completes (see lib/nssa-import.ts).
export async function settleChallengesForShooter(shooterId: string): Promise<void> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('challenges')
    .select('challenge_id')
    .or(`initiator_shooter_id.eq.${shooterId},opponent_shooter_id.eq.${shooterId}`)
    .eq('status', 'active');
  for (const c of data ?? []) {
    await attemptSettlement(c.challenge_id);
  }
}

async function expireStaleChallenges(supabase: ReturnType<typeof createServerClient>, rows: ChallengeRow[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const stale = rows.filter((r) => (r.status === 'pending' || r.status === 'active') && r.window_end < today);
  for (const r of stale) {
    await supabase.from('challenges').update({ status: 'expired' }).eq('challenge_id', r.challenge_id);
    r.status = 'expired';
  }
}

export async function getChallengesFor(shooterId: string): Promise<ChallengeSummary[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('challenges')
    .select('*')
    .or(`initiator_shooter_id.eq.${shooterId},opponent_shooter_id.eq.${shooterId}`)
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as ChallengeRow[];
  if (rows.length === 0) return [];

  await expireStaleChallenges(supabase, rows);

  // Attempt settlement for anything still active — lazy path, in addition
  // to the import-triggered one.
  await Promise.all(rows.filter((r) => r.status === 'active').map((r) => attemptSettlement(r.challenge_id)));

  const shooterIds = Array.from(new Set(rows.flatMap((r) => [r.initiator_shooter_id, r.opponent_shooter_id])));
  const { data: shooters } = await supabase.from('shooters').select('shooter_id, full_name').in('shooter_id', shooterIds);
  const nameById = new Map((shooters ?? []).map((s) => [s.shooter_id, s.full_name]));

  const { data: entries } = await supabase
    .from('challenge_entries')
    .select('challenge_id, shooter_id, gross_score, net_score')
    .in(
      'challenge_id',
      rows.map((r) => r.challenge_id)
    );
  const entriesByChallenge = new Map<string, ChallengeEntry[]>();
  for (const e of entries ?? []) {
    const list = entriesByChallenge.get(e.challenge_id) ?? [];
    list.push({
      shooterId: e.shooter_id,
      shooterName: nameById.get(e.shooter_id) ?? 'Unknown shooter',
      grossScore: e.gross_score,
      netScore: e.net_score,
    });
    entriesByChallenge.set(e.challenge_id, list);
  }

  // Re-fetch statuses that may have just changed via settlement/expiry above.
  const { data: freshRows } = await supabase
    .from('challenges')
    .select('*')
    .in(
      'challenge_id',
      rows.map((r) => r.challenge_id)
    );
  const freshById = new Map(((freshRows ?? []) as ChallengeRow[]).map((r) => [r.challenge_id, r]));

  return rows.map((r) => {
    const fresh = freshById.get(r.challenge_id) ?? r;
    return {
      challengeId: r.challenge_id,
      initiatorId: r.initiator_shooter_id,
      initiatorName: nameById.get(r.initiator_shooter_id) ?? 'Unknown shooter',
      opponentId: r.opponent_shooter_id,
      opponentName: nameById.get(r.opponent_shooter_id) ?? 'Unknown shooter',
      discipline: r.discipline,
      gauge: r.gauge,
      windowStart: r.window_start,
      windowEnd: r.window_end,
      status: fresh.status,
      entries: entriesByChallenge.get(r.challenge_id) ?? [],
    };
  });
}

export async function createChallenge(
  initiatorId: string,
  opponentId: string,
  discipline: string,
  gauge: string,
  windowEnd: string
): Promise<void> {
  if (initiatorId === opponentId) throw new Error("You can't challenge yourself.");
  const windowStart = new Date().toISOString().slice(0, 10);
  if (windowEnd <= windowStart) throw new Error('Deadline must be in the future.');

  const supabase = createServerClient();
  const { error } = await supabase.from('challenges').insert({
    initiator_shooter_id: initiatorId,
    opponent_shooter_id: opponentId,
    discipline,
    gauge,
    window_start: windowStart,
    window_end: windowEnd,
    status: 'pending',
  });
  if (error) throw error;
}

export async function respondToChallenge(
  challengeId: string,
  responderShooterId: string,
  accept: boolean
): Promise<void> {
  const supabase = createServerClient();
  const { data: challenge } = await supabase
    .from('challenges')
    .select('opponent_shooter_id, status')
    .eq('challenge_id', challengeId)
    .maybeSingle();
  if (!challenge) throw new Error('Challenge not found.');
  if (challenge.opponent_shooter_id !== responderShooterId) {
    throw new Error('Only the invited shooter can respond to this challenge.');
  }
  if (challenge.status !== 'pending') return;

  await supabase.from('challenges').update({ status: accept ? 'active' : 'declined' }).eq('challenge_id', challengeId);
}
