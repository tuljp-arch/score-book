// Exercises the challenges lifecycle directly, bypassing the browser/auth
// flow. Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-challenges.ts
import { createServerClient } from '../lib/supabase-server';
import { createChallenge, respondToChallenge, attemptSettlement, getChallengesFor } from '../lib/challenges';

const JEFF = '10000000-0000-0000-0000-000000000001';
const BRETT = 'b3927110-1e9a-485a-af94-435390f036af';

async function main() {
  // --- Part 1: create -> accept lifecycle, future window (won't settle) ---
  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await createChallenge(JEFF, BRETT, 'skeet', '12ga', futureDate);

  const supabase = createServerClient();
  const { data: pending } = await supabase
    .from('challenges')
    .select('challenge_id, status')
    .eq('initiator_shooter_id', JEFF)
    .eq('opponent_shooter_id', BRETT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('Created challenge, status:', pending?.status); // expect "pending"

  await respondToChallenge(pending!.challenge_id, BRETT, true);
  const { data: afterAccept } = await supabase
    .from('challenges')
    .select('status')
    .eq('challenge_id', pending!.challenge_id)
    .maybeSingle();
  console.log('After Brett accepts, status:', afterAccept?.status); // expect "active"

  // --- Part 2: settlement logic, past window covering real shared results ---
  const { data: pastChallenge, error } = await supabase
    .from('challenges')
    .insert({
      initiator_shooter_id: JEFF,
      opponent_shooter_id: BRETT,
      discipline: 'skeet',
      gauge: '12ga',
      window_start: '2026-01-01',
      window_end: '2026-12-31',
      status: 'active',
    })
    .select('challenge_id')
    .single();
  if (error) throw error;

  await attemptSettlement(pastChallenge.challenge_id);

  const results = await getChallengesFor(JEFF);
  const settled = results.find((c) => c.challengeId === pastChallenge.challenge_id);
  console.log('Settled challenge:', JSON.stringify(settled, null, 2));
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
