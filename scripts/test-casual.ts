// Exercises the casual rounds lifecycle directly, bypassing the
// browser/auth flow, including the isolation guarantee (must never touch
// results/shooter_handicaps). Usage:
// NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-casual.ts
import { createServerClient } from '../lib/supabase-server';
import { createCasualEvent, addParticipant, recordResult, submitWitness, getCasualEvent, claimParticipant, getClaimInfo } from '../lib/casual';

const JEFF = '10000000-0000-0000-0000-000000000001'; // organizer
const CONNOR = 'd1de7aa8-7545-4066-a2fd-00aca81b8df8'; // will act as an outside witness
const FAKE_CLAIMER_USER_ID = '00000000-0000-4000-8000-000000000001'; // throwaway, not a real login

async function main() {
  const supabase = createServerClient();

  const { count: resultsBefore } = await supabase.from('results').select('*', { count: 'exact', head: true });
  const { count: handicapsBefore } = await supabase.from('shooter_handicaps').select('*', { count: 'exact', head: true });

  const casualEventId = await createCasualEvent(JEFF, 'Saturday fun shoot', '2026-07-11', 'skeet', '12ga');
  console.log('Created casual event:', casualEventId);

  const { claimToken } = await addParticipant(casualEventId, 'Sam Guest', '555-1234');
  console.log('Added guest participant, claim token:', claimToken);

  const { data: participants } = await supabase
    .from('casual_participants')
    .select('casual_participant_id')
    .eq('casual_event_id', casualEventId);
  const participantId = participants![0].casual_participant_id;

  await recordResult(participantId, 87, 100);
  console.log('Recorded self-reported result: 87/100');

  const { data: results } = await supabase.from('casual_results').select('casual_result_id').eq('casual_participant_id', participantId);
  const resultId = results![0].casual_result_id;

  // View as an outsider (Connor Ball) BEFORE witnessing -- score should be hidden.
  const eventAsOutsider = await getCasualEvent(casualEventId, CONNOR);
  const participantView = eventAsOutsider!.participants[0];
  console.log('Outsider view before witness:', JSON.stringify(participantView.result, null, 2));

  // Witness with a MATCHING score.
  await submitWitness(resultId, CONNOR, 87);
  const eventAfterMatch = await getCasualEvent(casualEventId, CONNOR);
  console.log('After matching witness:', JSON.stringify(eventAfterMatch!.participants[0].result, null, 2));

  // Second participant to test the disputed path.
  const { claimToken: token2 } = await addParticipant(casualEventId, 'Alex Guest');
  const { data: participants2 } = await supabase
    .from('casual_participants')
    .select('casual_participant_id')
    .eq('casual_event_id', casualEventId)
    .neq('casual_participant_id', participantId);
  const participantId2 = participants2![0].casual_participant_id;
  await recordResult(participantId2, 90, 100);
  const { data: results2 } = await supabase.from('casual_results').select('casual_result_id').eq('casual_participant_id', participantId2);
  const resultId2 = results2![0].casual_result_id;

  await submitWitness(resultId2, CONNOR, 85); // mismatched on purpose
  const eventAfterDispute = await getCasualEvent(casualEventId, JEFF); // organizer view, always visible
  console.log('Disputed result (organizer view):', JSON.stringify(eventAfterDispute!.participants[1].result, null, 2));

  // Claim flow.
  const claimInfo = await getClaimInfo(token2);
  console.log('Claim info before claim:', JSON.stringify(claimInfo, null, 2));
  const claimedShooterId = await claimParticipant(token2, FAKE_CLAIMER_USER_ID);
  console.log('Claimed! New/linked shooter id:', claimedShooterId);
  const claimInfoAfter = await getClaimInfo(token2);
  console.log('Claim info after claim:', JSON.stringify(claimInfoAfter, null, 2));

  // Isolation check: results/shooter_handicaps must be untouched.
  const { count: resultsAfter } = await supabase.from('results').select('*', { count: 'exact', head: true });
  const { count: handicapsAfter } = await supabase.from('shooter_handicaps').select('*', { count: 'exact', head: true });
  console.log('Isolation check — results:', resultsBefore, '->', resultsAfter, '| handicaps:', handicapsBefore, '->', handicapsAfter);
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
