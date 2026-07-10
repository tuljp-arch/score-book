import { createServerClient } from '@/lib/supabase-server';

// Small single-elimination bracket tournament, an alternate "format" for a
// casual_event (the default remains 'reported' -- everyone just self-reports
// a flat score, unchanged). Bracket progression is implicit arithmetic
// (slot_position/2 -> next round's slot) rather than an explicit
// next-match-id column -- simplest choice given the deliberately small,
// bounded scope (2-8 participants, up to 3 rounds). Never touches
// results/shooter_handicaps/etc -- same isolation wall as the rest of
// Casual Rounds.

export type MatchStatus = 'waiting' | 'ready' | 'bye' | 'reported';

export interface BracketMatchView {
  matchId: string;
  roundNumber: number;
  slotPosition: number;
  participantAId: string | null;
  participantBId: string | null;
  participantAShooterId: string | null;
  participantBShooterId: string | null;
  participantAName: string | null;
  participantBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  possible: number | null;
  winnerParticipantId: string | null;
  status: MatchStatus;
}

export interface BracketRound {
  roundNumber: number;
  matches: BracketMatchView[];
}

export interface BracketView {
  rounds: BracketRound[];
  champion: { participantId: string; shooterId: string | null; displayName: string } | null;
  isComplete: boolean;
}

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getMaxRoundNumber(supabase: ReturnType<typeof createServerClient>, casualEventId: string): Promise<number> {
  const { data } = await supabase
    .from('casual_tournament_matches')
    .select('round_number')
    .eq('casual_event_id', casualEventId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.round_number ?? 0;
}

async function advanceWinner(
  supabase: ReturnType<typeof createServerClient>,
  casualEventId: string,
  roundNumber: number,
  slotPosition: number,
  winnerParticipantId: string
): Promise<void> {
  const maxRound = await getMaxRoundNumber(supabase, casualEventId);
  if (roundNumber >= maxRound) return; // this was the final -- champion decided, nothing to advance

  const nextRound = roundNumber + 1;
  const nextSlot = Math.floor(slotPosition / 2);
  const field = slotPosition % 2 === 0 ? 'participant_a_id' : 'participant_b_id';

  await supabase
    .from('casual_tournament_matches')
    .update({ [field]: winnerParticipantId })
    .eq('casual_event_id', casualEventId)
    .eq('round_number', nextRound)
    .eq('slot_position', nextSlot);

  const { data: nextMatch } = await supabase
    .from('casual_tournament_matches')
    .select('casual_tournament_match_id, participant_a_id, participant_b_id, status')
    .eq('casual_event_id', casualEventId)
    .eq('round_number', nextRound)
    .eq('slot_position', nextSlot)
    .single();

  if (nextMatch && nextMatch.participant_a_id && nextMatch.participant_b_id && nextMatch.status === 'waiting') {
    await supabase.from('casual_tournament_matches').update({ status: 'ready' }).eq('casual_tournament_match_id', nextMatch.casual_tournament_match_id);
  }
}

export async function startBracket(casualEventId: string): Promise<void> {
  const supabase = createServerClient();

  const { data: event } = await supabase.from('casual_events').select('format').eq('casual_event_id', casualEventId).maybeSingle();
  if (!event) throw new Error('Casual round not found.');
  if (event.format !== 'bracket') throw new Error('This round is not set up as a bracket tournament.');

  const { count: existingMatches } = await supabase
    .from('casual_tournament_matches')
    .select('*', { count: 'exact', head: true })
    .eq('casual_event_id', casualEventId);
  if (existingMatches && existingMatches > 0) throw new Error('This tournament has already started.');

  const { data: participants } = await supabase
    .from('casual_participants')
    .select('casual_participant_id')
    .eq('casual_event_id', casualEventId);
  const participantIds = (participants ?? []).map((p) => p.casual_participant_id);

  if (participantIds.length < 2) throw new Error('Add at least 2 participants before starting the tournament.');
  if (participantIds.length > 8) throw new Error('Brackets are capped at 8 participants.');

  const bracketSize = nextPowerOfTwo(participantIds.length);
  const totalRounds = Math.log2(bracketSize);
  const numByes = bracketSize - participantIds.length;
  const shuffled = shuffle(participantIds);
  // The first `numByes` shuffled participants get a bye (their own slot, no
  // opponent, auto-advance); everyone else is paired up two-per-slot. This
  // guarantees every round-1 slot has at least one real participant --
  // padding-then-pairing can otherwise strand two byes in the same slot.
  const byeParticipants = shuffled.slice(0, numByes);
  const pairedParticipants = shuffled.slice(numByes);

  const rows: {
    casual_event_id: string;
    round_number: number;
    slot_position: number;
    participant_a_id: string | null;
    participant_b_id: string | null;
    winner_participant_id: string | null;
    status: MatchStatus;
  }[] = [];

  // Round 1: byes first, then real pairings.
  let slot = 0;
  for (const bye of byeParticipants) {
    rows.push({ casual_event_id: casualEventId, round_number: 1, slot_position: slot, participant_a_id: bye, participant_b_id: null, winner_participant_id: bye, status: 'bye' });
    slot++;
  }
  for (let i = 0; i < pairedParticipants.length; i += 2) {
    rows.push({
      casual_event_id: casualEventId,
      round_number: 1,
      slot_position: slot,
      participant_a_id: pairedParticipants[i],
      participant_b_id: pairedParticipants[i + 1],
      winner_participant_id: null,
      status: 'ready',
    });
    slot++;
  }

  // Placeholder rows for every later round, up to the final.
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let slot = 0; slot < matchesInRound; slot++) {
      rows.push({ casual_event_id: casualEventId, round_number: round, slot_position: slot, participant_a_id: null, participant_b_id: null, winner_participant_id: null, status: 'waiting' });
    }
  }

  const { data: inserted, error } = await supabase.from('casual_tournament_matches').insert(rows).select('round_number, slot_position, status, winner_participant_id');
  if (error) throw error;

  // Flow round-1 byes into round 2 immediately.
  for (const row of inserted ?? []) {
    if (row.status === 'bye' && row.winner_participant_id) {
      await advanceWinner(supabase, casualEventId, row.round_number, row.slot_position, row.winner_participant_id);
    }
  }
}

export async function reportMatchResult(matchId: string, scoreA: number, scoreB: number, possible: number): Promise<void> {
  const supabase = createServerClient();

  const { data: match } = await supabase
    .from('casual_tournament_matches')
    .select('casual_tournament_match_id, casual_event_id, round_number, slot_position, participant_a_id, participant_b_id, status')
    .eq('casual_tournament_match_id', matchId)
    .maybeSingle();
  if (!match) throw new Error('Match not found.');
  if (match.status === 'reported') throw new Error('This match has already been reported.');
  if (match.status !== 'ready') throw new Error("This match isn't ready to report yet.");
  if (scoreA === scoreB) throw new Error('Bracket matches need a winner — no ties.');

  const winnerParticipantId = scoreA > scoreB ? match.participant_a_id! : match.participant_b_id!;

  const { error } = await supabase
    .from('casual_tournament_matches')
    .update({ score_a: scoreA, score_b: scoreB, possible, winner_participant_id: winnerParticipantId, status: 'reported', reported_at: new Date().toISOString() })
    .eq('casual_tournament_match_id', matchId);
  if (error) throw error;

  await advanceWinner(supabase, match.casual_event_id, match.round_number, match.slot_position, winnerParticipantId);
}

export function canReportMatch(
  match: Pick<BracketMatchView, 'status' | 'participantAShooterId' | 'participantBShooterId'>,
  viewerShooterId: string,
  isOrganizer: boolean
): boolean {
  return match.status === 'ready' && (isOrganizer || match.participantAShooterId === viewerShooterId || match.participantBShooterId === viewerShooterId);
}

export async function getBracket(casualEventId: string): Promise<BracketView | null> {
  const supabase = createServerClient();

  const { data: event } = await supabase.from('casual_events').select('format').eq('casual_event_id', casualEventId).maybeSingle();
  if (!event || event.format !== 'bracket') return null;

  const { data: matches } = await supabase
    .from('casual_tournament_matches')
    .select(
      'casual_tournament_match_id, round_number, slot_position, participant_a_id, participant_b_id, score_a, score_b, possible, winner_participant_id, status'
    )
    .eq('casual_event_id', casualEventId)
    .order('round_number', { ascending: true })
    .order('slot_position', { ascending: true });

  if (!matches || matches.length === 0) return { rounds: [], champion: null, isComplete: false };

  const { data: participants } = await supabase
    .from('casual_participants')
    .select('casual_participant_id, shooter_id, guest_name')
    .eq('casual_event_id', casualEventId);

  const shooterIds = (participants ?? []).map((p) => p.shooter_id).filter((id): id is string => Boolean(id));
  const { data: shooters } = shooterIds.length
    ? await supabase.from('shooters').select('shooter_id, full_name').in('shooter_id', shooterIds)
    : { data: [] as { shooter_id: string; full_name: string }[] };
  const nameByShooterId = new Map((shooters ?? []).map((s) => [s.shooter_id, s.full_name]));

  const participantById = new Map(
    (participants ?? []).map((p) => [
      p.casual_participant_id,
      {
        shooterId: p.shooter_id,
        displayName: p.shooter_id ? nameByShooterId.get(p.shooter_id) ?? 'Unknown' : p.guest_name ?? 'Unknown',
      },
    ])
  );

  const roundsMap = new Map<number, BracketMatchView[]>();
  for (const m of matches) {
    const a = m.participant_a_id ? participantById.get(m.participant_a_id) : null;
    const b = m.participant_b_id ? participantById.get(m.participant_b_id) : null;
    const view: BracketMatchView = {
      matchId: m.casual_tournament_match_id,
      roundNumber: m.round_number,
      slotPosition: m.slot_position,
      participantAId: m.participant_a_id,
      participantBId: m.participant_b_id,
      participantAShooterId: a?.shooterId ?? null,
      participantBShooterId: b?.shooterId ?? null,
      participantAName: a?.displayName ?? null,
      participantBName: b?.displayName ?? null,
      scoreA: m.score_a,
      scoreB: m.score_b,
      possible: m.possible,
      winnerParticipantId: m.winner_participant_id,
      status: m.status as MatchStatus,
    };
    const list = roundsMap.get(m.round_number) ?? [];
    list.push(view);
    roundsMap.set(m.round_number, list);
  }

  const rounds: BracketRound[] = Array.from(roundsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([roundNumber, roundMatches]) => ({ roundNumber, matches: roundMatches }));

  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0] ?? null;
  const isComplete = Boolean(finalMatch && finalMatch.status === 'reported' && finalMatch.winnerParticipantId);
  const champion =
    isComplete && finalMatch
      ? {
          participantId: finalMatch.winnerParticipantId!,
          shooterId: finalMatch.winnerParticipantId === finalMatch.participantAId ? finalMatch.participantAShooterId : finalMatch.participantBShooterId,
          displayName: finalMatch.winnerParticipantId === finalMatch.participantAId ? finalMatch.participantAName! : finalMatch.participantBName!,
        }
      : null;

  return { rounds, champion, isComplete };
}
