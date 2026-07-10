// Exercises the "add an existing shooter directly" participant path
// (prerequisite for Grudge Ledger + bracket tournaments). Usage:
// NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-existing-participant.ts
import { createCasualEvent, addExistingParticipant, getCasualEvent } from '../lib/casual';

const JEFF = '10000000-0000-0000-0000-000000000001';
const BRETT = 'b3927110-1e9a-485a-af94-435390f036af';

async function main() {
  const casualEventId = await createCasualEvent(JEFF, 'Existing-participant test', '2026-07-11', 'skeet', '12ga');
  console.log('Created casual event:', casualEventId);

  await addExistingParticipant(casualEventId, BRETT);
  console.log('Added Brett as an existing shooter.');

  const event = await getCasualEvent(casualEventId, JEFF);
  const brett = event!.participants.find((p) => p.shooterId === BRETT);
  console.log('Brett is guest:', brett?.isGuest, '| claim token:', brett?.claimToken); // expect false, null

  try {
    await addExistingParticipant(casualEventId, BRETT);
    console.log('FAILED: expected duplicate-add to throw');
    process.exit(1);
  } catch (e) {
    console.log('Duplicate add correctly rejected:', e instanceof Error ? e.message : e);
  }
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
