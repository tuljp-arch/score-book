// Recalculates handicaps for a shooter directly, bypassing the import flow.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-handicap.ts <shooterId>
import { recalculateHandicaps } from '../lib/handicap';

const shooterId = process.argv[2];

recalculateHandicaps(shooterId)
  .then((result) => console.log('SUCCESS', JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
