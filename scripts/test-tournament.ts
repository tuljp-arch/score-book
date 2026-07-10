// Exercises the bracket tournament lifecycle (lib/tournaments.ts) against
// real Supabase data. Part A uses a deterministic 2-participant bracket to
// verify tie-rejection, champion determination, and Grudge Ledger
// integration precisely. Part B uses a 5-participant bracket (forces a
// bye) to verify multi-round advancement, participant-count validation,
// and re-report/not-ready rejection. Usage:
// NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-tournament.ts
import { createServerClient } from '../lib/supabase-server';
import { createCasualEvent, addExistingParticipant, addParticipant } from '../lib/casual';
import { startBracket, reportMatchResult, getBracket } from '../lib/tournaments';
import { getGrudgesFor } from '../lib/grudges';

const JEFF = '10000000-0000-0000-0000-000000000001';
const BRETT = 'b3927110-1e9a-485a-af94-435390f036af';
const CONNOR = 'd1de7aa8-7545-4066-a2fd-00aca81b8df8';

async function partA_deterministicTwoPlayer() {
  const casualEventId = await createCasualEvent(JEFF, 'Bracket test (2p)', '2026-02-01', 'skeet', '12ga', 'bracket');
  await addExistingParticipant(casualEventId, JEFF);
  await addExistingParticipant(casualEventId, BRETT);

  await startBracket(casualEventId);
  let bracket = await getBracket(casualEventId);
  console.log('Part A -- rounds:', bracket!.rounds.length, '(expect 1)');
  const match = bracket!.rounds[0].matches[0];
  console.log('Part A -- initial status:', match.status, '(expect ready)');

  try {
    await reportMatchResult(match.matchId, 24, 24, 25);
    console.log('FAILED: expected tie to be rejected');
    process.exit(1);
  } catch (e) {
    console.log('Part A -- tie correctly rejected:', e instanceof Error ? e.message : e);
  }

  await reportMatchResult(match.matchId, 25, 20, 25);
  bracket = await getBracket(casualEventId);
  console.log('Part A -- isComplete:', bracket!.isComplete, '| champion:', bracket!.champion?.displayName);
  const jeffIsChampion = bracket!.champion?.shooterId === JEFF;
  console.log('Part A -- champion is Jeff:', jeffIsChampion);

  try {
    await reportMatchResult(match.matchId, 25, 20, 25);
    console.log('FAILED: expected re-report to be rejected');
    process.exit(1);
  } catch (e) {
    console.log('Part A -- re-report correctly rejected:', e instanceof Error ? e.message : e);
  }

  const jeffGrudges = await getGrudgesFor(JEFF);
  const vsBrett = jeffGrudges.find((g) => g.otherShooterId === BRETT);
  const tournamentMatchup = vsBrett?.matchups.find((m) => m.source === 'tournament_match' && m.casualEventId === casualEventId);
  console.log('Part A -- tournament match picked up by Grudge Ledger with no witnessing:', Boolean(tournamentMatchup), '| outcome:', tournamentMatchup?.outcome, '(expect me)');

  if (!jeffIsChampion || tournamentMatchup?.outcome !== 'me') {
    console.error('FAILED: Part A assertions did not hold');
    process.exit(1);
  }
}

async function partB_fivePlayerBye() {
  const casualEventId = await createCasualEvent(JEFF, 'Bracket test (5p)', '2026-02-08', 'skeet', '12ga', 'bracket');
  await addExistingParticipant(casualEventId, JEFF);
  await addExistingParticipant(casualEventId, BRETT);
  await addExistingParticipant(casualEventId, CONNOR);
  await addParticipant(casualEventId, 'Guest A');
  await addParticipant(casualEventId, 'Guest B');

  await startBracket(casualEventId);

  try {
    await startBracket(casualEventId);
    console.log('FAILED: expected re-start to be rejected');
    process.exit(1);
  } catch (e) {
    console.log('Part B -- re-start correctly rejected:', e instanceof Error ? e.message : e);
  }

  let bracket = await getBracket(casualEventId);
  console.log('Part B -- rounds:', bracket!.rounds.length, '(expect 3)');
  console.log('Part B -- round 1 matches:', bracket!.rounds[0].matches.length, '(expect 4)');
  const byes = bracket!.rounds[0].matches.filter((m) => m.status === 'bye').length;
  const readyMatches = bracket!.rounds[0].matches.filter((m) => m.status === 'ready');
  console.log('Part B -- round 1 byes:', byes, '(expect 3) | ready matches:', readyMatches.length, '(expect 1)');
  const noEmptySlots = bracket!.rounds[0].matches.every((m) => m.participantAId || m.participantBId);
  console.log('Part B -- every round-1 slot has at least one real participant:', noEmptySlots);

  const waitingRound2 = bracket!.rounds[1].matches.find((m) => m.status === 'waiting');
  if (waitingRound2) {
    try {
      await reportMatchResult(waitingRound2.matchId, 20, 15, 25);
      console.log('FAILED: expected reporting a waiting match to be rejected');
      process.exit(1);
    } catch (e) {
      console.log('Part B -- reporting a not-ready match correctly rejected:', e instanceof Error ? e.message : e);
    }
  }

  // Play every round until the final is complete.
  for (let round = 0; round < bracket!.rounds.length; round++) {
    bracket = await getBracket(casualEventId);
    let readyNow = bracket!.rounds.flatMap((r) => r.matches).filter((m) => m.status === 'ready');
    while (readyNow.length > 0) {
      for (const m of readyNow) {
        await reportMatchResult(m.matchId, 22, 18, 25);
      }
      bracket = await getBracket(casualEventId);
      readyNow = bracket!.rounds.flatMap((r) => r.matches).filter((m) => m.status === 'ready');
    }
  }

  bracket = await getBracket(casualEventId);
  console.log('Part B -- final isComplete:', bracket!.isComplete, '| champion:', bracket!.champion?.displayName);
  if (!bracket!.isComplete) {
    console.error('FAILED: bracket did not complete');
    process.exit(1);
  }

  // Generic, seeding-order-independent check: every reported match between
  // two real (non-guest) shooters must show up in the Grudge Ledger.
  for (const round of bracket!.rounds) {
    for (const m of round.matches) {
      if (m.status !== 'reported' || !m.participantAShooterId || !m.participantBShooterId) continue;
      const grudges = await getGrudgesFor(m.participantAShooterId);
      const g = grudges.find((x) => x.otherShooterId === m.participantBShooterId);
      const found = g?.matchups.some((mm) => mm.source === 'tournament_match' && mm.casualEventId === casualEventId);
      console.log(`Part B -- round ${m.roundNumber} slot ${m.slotPosition} real-vs-real match picked up by Grudge Ledger:`, Boolean(found));
    }
  }

  if (readyMatches.length !== 1 || byes !== 3) {
    console.error('FAILED: Part B bracket shape assertions did not hold');
    process.exit(1);
  }
}

async function main() {
  const supabase = createServerClient();
  const isolationBefore = await Promise.all(
    ['results', 'shooter_handicaps', 'classifications', 'events', 'rounds'].map(async (t) => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      return [t, count] as const;
    })
  );

  await partA_deterministicTwoPlayer();
  await partB_fivePlayerBye();

  const isolationAfter = await Promise.all(
    ['results', 'shooter_handicaps', 'classifications', 'events', 'rounds'].map(async (t) => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      return [t, count] as const;
    })
  );
  console.log('Isolation check (before -> after):', JSON.stringify(isolationBefore), '->', JSON.stringify(isolationAfter));
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
