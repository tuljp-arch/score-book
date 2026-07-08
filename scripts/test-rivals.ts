// Exercises the rivalries CRUD directly, bypassing the browser/auth flow.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-rivals.ts
import { addRival, getRivalsFor } from '../lib/rivalries';

const JEFF = '10000000-0000-0000-0000-000000000001';
const BRETT = 'b3927110-1e9a-485a-af94-435390f036af';
const CONNOR = 'd1de7aa8-7545-4066-a2fd-00aca81b8df8';

async function main() {
  await addRival(JEFF, BRETT);
  await addRival(JEFF, CONNOR);
  // duplicate add should be a no-op, not a second row
  await addRival(JEFF, BRETT);

  const jeffRivals = await getRivalsFor(JEFF);
  console.log('Jeff rivals:', JSON.stringify(jeffRivals, null, 2));

  const brettRivals = await getRivalsFor(BRETT);
  console.log('Brett rivals (should see Jeff, from the other side):', JSON.stringify(brettRivals, null, 2));
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
