import { createServerClient } from '@/lib/supabase-server';

// Grudge Ledger + Title Belt: a running head-to-head record between two
// shooters, computed at read time from casual data only (never touches
// results/shooter_handicaps/etc — same isolation wall as the rest of
// Casual Rounds). No new table: belt/streak are pure functions of an
// ordered list of pairwise outcomes, and persisting a "current holder"
// would need re-deriving on every late witness/dispute anyway.
//
// Only `witnessed` casual_results count toward a matchup (self_reported
// is unverified, disputed is contested) -- plus, once bracket tournaments
// exist, completed casual_tournament_matches rows, which are already a
// decisive 1v1 with a mandatory winner and need no separate witnessing.

export type GrudgeOutcome = 'me' | 'them' | 'tie';

export interface GrudgeMatchup {
  source: 'casual_result' | 'tournament_match';
  casualEventId: string;
  eventName: string;
  eventDate: string;
  discipline: string | null;
  gauge: string | null;
  outcome: GrudgeOutcome;
  myScore: number;
  myPossible: number;
  theirScore: number;
  theirPossible: number;
}

export interface Grudge {
  otherShooterId: string;
  otherShooterName: string;
  record: { wins: number; losses: number; ties: number };
  beltHolder: 'me' | 'them' | null;
  streak: { holder: 'me' | 'them'; count: number } | null;
  lastMatchup: GrudgeMatchup | null;
  matchups: GrudgeMatchup[];
}

// A tie never transfers the belt (the previous holder keeps it, or it
// stays vacant if there isn't one yet) and always resets the streak to
// zero -- "streak" means consecutive wins, so folding a draw into a run
// would misrepresent it as an unbroken winning streak.
function deriveGrudge(matchups: GrudgeMatchup[]): Pick<Grudge, 'record' | 'beltHolder' | 'streak' | 'lastMatchup'> {
  const record = { wins: 0, losses: 0, ties: 0 };
  for (const m of matchups) {
    if (m.outcome === 'me') record.wins++;
    else if (m.outcome === 'them') record.losses++;
    else record.ties++;
  }

  let beltHolder: 'me' | 'them' | null = null;
  for (const m of matchups) {
    if (m.outcome !== 'tie') beltHolder = m.outcome;
  }

  let streak: { holder: 'me' | 'them'; count: number } | null = null;
  for (let i = matchups.length - 1; i >= 0; i--) {
    const outcome = matchups[i].outcome;
    if (outcome === 'tie') break;
    if (!streak) streak = { holder: outcome, count: 1 };
    else if (streak.holder === outcome) streak.count++;
    else break;
  }

  return { record, beltHolder, streak, lastMatchup: matchups.length ? matchups[matchups.length - 1] : null };
}

async function buildGrudgesForShooter(shooterId: string): Promise<Grudge[]> {
  const supabase = createServerClient();

  const { data: myParticipation } = await supabase
    .from('casual_participants')
    .select('casual_participant_id, casual_event_id')
    .eq('shooter_id', shooterId);

  const myEventIds = (myParticipation ?? []).map((p) => p.casual_event_id);
  if (myEventIds.length === 0) return [];

  const myParticipantIdByEvent = new Map((myParticipation ?? []).map((p) => [p.casual_event_id, p.casual_participant_id]));

  const [{ data: events }, { data: allParticipants }, { data: shooters }] = await Promise.all([
    supabase.from('casual_events').select('casual_event_id, name, event_date, discipline, gauge').in('casual_event_id', myEventIds),
    supabase
      .from('casual_participants')
      .select('casual_participant_id, casual_event_id, shooter_id')
      .in('casual_event_id', myEventIds)
      .not('shooter_id', 'is', null),
    supabase.from('shooters').select('shooter_id, full_name'),
  ]);
  const eventById = new Map((events ?? []).map((e) => [e.casual_event_id, e]));
  const nameByShooterId = new Map((shooters ?? []).map((s) => [s.shooter_id, s.full_name]));

  const participantIds = (allParticipants ?? []).map((p) => p.casual_participant_id);
  const { data: results } = participantIds.length
    ? await supabase
        .from('casual_results')
        .select('casual_participant_id, score, possible')
        .in('casual_participant_id', participantIds)
        .eq('verification_status', 'witnessed')
    : { data: [] as { casual_participant_id: string; score: number; possible: number }[] };
  const resultByParticipantId = new Map((results ?? []).map((r) => [r.casual_participant_id, r]));

  const matchupsByOpponent = new Map<string, GrudgeMatchup[]>();

  for (const eventId of myEventIds) {
    const myParticipantId = myParticipantIdByEvent.get(eventId);
    const myResult = myParticipantId ? resultByParticipantId.get(myParticipantId) : undefined;
    if (!myResult) continue; // my score isn't witnessed in this event yet -- no matchup to compute

    const event = eventById.get(eventId);
    if (!event) continue;

    const others = (allParticipants ?? []).filter((p) => p.casual_event_id === eventId && p.shooter_id !== shooterId);

    for (const other of others) {
      const theirResult = resultByParticipantId.get(other.casual_participant_id);
      if (!theirResult) continue;

      const myPct = myResult.score / myResult.possible;
      const theirPct = theirResult.score / theirResult.possible;
      const outcome: GrudgeOutcome = myPct > theirPct ? 'me' : myPct < theirPct ? 'them' : 'tie';

      const matchup: GrudgeMatchup = {
        source: 'casual_result',
        casualEventId: eventId,
        eventName: event.name,
        eventDate: event.event_date,
        discipline: event.discipline,
        gauge: event.gauge,
        outcome,
        myScore: myResult.score,
        myPossible: myResult.possible,
        theirScore: theirResult.score,
        theirPossible: theirResult.possible,
      };

      const list = matchupsByOpponent.get(other.shooter_id!) ?? [];
      list.push(matchup);
      matchupsByOpponent.set(other.shooter_id!, list);
    }
  }

  // Completed bracket matches are already a decisive 1v1 with a mandatory
  // winner -- they count toward the ledger unconditionally, no witnessing
  // required (unlike flat-format casual_results above).
  const participantIdToShooterId = new Map((allParticipants ?? []).map((p) => [p.casual_participant_id, p.shooter_id!]));
  const { data: tournamentMatches } = await supabase
    .from('casual_tournament_matches')
    .select('casual_event_id, participant_a_id, participant_b_id, score_a, score_b, possible, winner_participant_id')
    .in('casual_event_id', myEventIds)
    .eq('status', 'reported');

  for (const match of tournamentMatches ?? []) {
    const myParticipantId = myParticipantIdByEvent.get(match.casual_event_id);
    if (!myParticipantId) continue;

    const mySide: 'a' | 'b' | null =
      match.participant_a_id === myParticipantId ? 'a' : match.participant_b_id === myParticipantId ? 'b' : null;
    if (!mySide) continue;

    const opponentParticipantId = mySide === 'a' ? match.participant_b_id : match.participant_a_id;
    const opponentShooterId = opponentParticipantId ? participantIdToShooterId.get(opponentParticipantId) : undefined;
    if (!opponentShooterId || opponentShooterId === shooterId) continue;

    const event = eventById.get(match.casual_event_id);
    if (!event) continue;

    const myScore = mySide === 'a' ? match.score_a! : match.score_b!;
    const theirScore = mySide === 'a' ? match.score_b! : match.score_a!;
    const outcome: GrudgeOutcome = match.winner_participant_id === myParticipantId ? 'me' : 'them';

    const matchup: GrudgeMatchup = {
      source: 'tournament_match',
      casualEventId: match.casual_event_id,
      eventName: event.name,
      eventDate: event.event_date,
      discipline: event.discipline,
      gauge: event.gauge,
      outcome,
      myScore,
      myPossible: match.possible!,
      theirScore,
      theirPossible: match.possible!,
    };

    const list = matchupsByOpponent.get(opponentShooterId) ?? [];
    list.push(matchup);
    matchupsByOpponent.set(opponentShooterId, list);
  }

  const grudges: Grudge[] = [];
  for (const [otherShooterId, matchups] of Array.from(matchupsByOpponent.entries())) {
    matchups.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    grudges.push({
      otherShooterId,
      otherShooterName: nameByShooterId.get(otherShooterId) ?? 'Unknown shooter',
      matchups,
      ...deriveGrudge(matchups),
    });
  }

  // Most recently active rivalries first.
  grudges.sort((a, b) => (b.lastMatchup?.eventDate ?? '').localeCompare(a.lastMatchup?.eventDate ?? ''));
  return grudges;
}

export async function getGrudgesFor(shooterId: string): Promise<Grudge[]> {
  return buildGrudgesForShooter(shooterId);
}

export async function getGrudgeBetween(shooterIdA: string, shooterIdB: string): Promise<Grudge | null> {
  const grudges = await buildGrudgesForShooter(shooterIdA);
  return grudges.find((g) => g.otherShooterId === shooterIdB) ?? null;
}

export async function getGrudgeContextForEvent(viewerShooterId: string, participantShooterIds: string[]): Promise<Grudge[]> {
  const relevant = new Set(participantShooterIds.filter((id) => id !== viewerShooterId));
  if (relevant.size === 0) return [];
  const grudges = await buildGrudgesForShooter(viewerShooterId);
  return grudges.filter((g) => relevant.has(g.otherShooterId));
}
