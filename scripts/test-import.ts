// Runs the NSSA importer directly, bypassing the browser/auth flow —
// useful for testing against a real member number without a session.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-import.ts <memberId> <userId>
import { importShooterFromNssa } from '../lib/nssa-import';

const memberId = process.argv[2];
const userId = process.argv[3];

importShooterFromNssa(memberId, userId)
  .then((summary) => {
    console.log('SUCCESS', JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });
