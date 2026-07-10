// Exercises the Grudge Ledger (lib/grudges.ts) against real Supabase data:
// builds a small Jeff/Brett history (win, loss, tie, win) plus one
// self-reported-only event that must NOT count, then checks the record,
// belt, and streak math -- especially that a tie doesn't transfer the
// belt and resets the streak. Usage:
// NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-grudges.ts
import { createServerClient } from '../lib/supabase-server';
import { createCasualEvent, addExistingParticipant, recordResult, submitWitness } from '../lib/casual';
import { getGrudgesFor, getGrudgeBetween, getGrudgeContextForEvent } from '../lib/grudges';

const JEFF = '10000000-0000-0000-0000-000000000001';
const BRETT = 'b3927110-1e9a-485a-af94-435390f036af';
const CONNOR = 'd1de7aa8-7545-4066-a2fd-00aca81b8df8'; // outside witness for every matchup

async function playWitnessedMatch(date: string, jeffScore: number, brettScore: number): Promise<void> {
  const supabase = createServerClient();
  const casualEventId = await createCasualEvent(JEFF, `Grudge test ${date}`, date, 'skeet', '12ga');
  const { casualParticipantId: jeffPid } = await addExistingParticipant(casualEventId, JEFF);
  const { casualParticipantId: brettPid } = await addExistingParticipant(casualEventId, BRETT);

  await recordResult(jeffPid, jeffScore, 100);
  await recordResult(brettPid, brettScore, 100);

  const { data: jeffResult } = await supabase.from('casual_results').select('casual_result_id').eq('casual_participant_id', jeffPid).single();
  const { data: brettResult } = await supabase.from('casual_results').select('casual_result_id').eq('casual_participant_id', brettPid).single();

  await submitWitness(jeffResult!.casual_result_id, CONNOR, jeffScore);
  await submitWitness(brettResult!.casual_result_id, CONNOR, brettScore);
}

async function main() {
  const supabase = createServerClient();
  const isolationBefore = await Promise.all(
    ['results', 'shooter_handicaps', 'classifications', 'events', 'rounds'].map(async (t) => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      return [t, count] as const;
    })
  );

  await playWitnessedMatch('2026-01-01', 95, 90); // Jeff wins
  await playWitnessedMatch('2026-01-08', 88, 93); // Brett wins
  await playWitnessedMatch('2026-01-15', 91, 91); // Tie -- must not transfer belt, must reset streak
  await playWitnessedMatch('2026-01-22', 97, 94); // Jeff wins -- flips belt back to Jeff, streak 1

  // Self-reported-only event -- must NOT count toward the ledger.
  const excludedEventId = await createCasualEvent(JEFF, 'Grudge test excluded', '2026-01-29', 'skeet', '12ga');
  const { casualParticipantId: jeffPid2 } = await addExistingParticipant(excludedEventId, JEFF);
  const { casualParticipantId: brettPid2 } = await addExistingParticipant(excludedEventId, BRETT);
  await recordResult(jeffPid2, 80, 100);
  await recordResult(brettPid2, 85, 100);

  const grudges = await getGrudgesFor(JEFF);
  const vsBrett = grudges.find((g) => g.otherShooterId === BRETT);
  console.log('Grudge vs. Brett:', JSON.stringify(vsBrett, null, 2));

  const checks: [string, boolean][] = [
    ['matchups.length === 4 (excludes self-reported-only event)', vsBrett?.matchups.length === 4],
    ['record.wins === 2', vsBrett?.record.wins === 2],
    ['record.losses === 1', vsBrett?.record.losses === 1],
    ['record.ties === 1', vsBrett?.record.ties === 1],
    ["beltHolder === 'me' (tie didn't transfer it, final win flipped it back)", vsBrett?.beltHolder === 'me'],
    ["streak.holder === 'me' && streak.count === 1 (tie reset the streak)", vsBrett?.streak?.holder === 'me' && vsBrett?.streak?.count === 1],
  ];
  for (const [label, pass] of checks) console.log(pass ? 'PASS' : 'FAIL', '-', label);
  if (checks.some(([, pass]) => !pass)) {
    console.error('FAILED: one or more grudge assertions did not hold');
    process.exit(1);
  }

  const between = await getGrudgeBetween(JEFF, BRETT);
  console.log('getGrudgeBetween matches getGrudgesFor entry:', between?.otherShooterId === BRETT && between?.record.wins === 2);

  const context = await getGrudgeContextForEvent(JEFF, [BRETT]);
  console.log('getGrudgeContextForEvent finds the Brett grudge:', context.some((g) => g.otherShooterId === BRETT));

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
