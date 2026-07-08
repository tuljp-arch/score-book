// Runs the NSSA importer directly, bypassing the browser/auth flow —
// useful for testing against a real member number without a session.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx scripts/test-import.ts <memberId> <userId>
//
// IMPORTANT: don't reuse a real logged-in user's id here for a shooter
// that isn't actually theirs (e.g. testing a public figure's number under
// your own account). shooters.user_id is assumed 1:1 with a real login —
// reusing one across two shooter rows breaks any .maybeSingle() lookup
// keyed on user_id (nav bar, /rivals, etc. all error rather than degrade,
// since a 1:1 assumption now returns two rows). Learned this the hard
// way — see git history around "My Profile" / "Rivals" going missing.
// Use a throwaway UUID instead if you just need a userId to satisfy the
// function signature.
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
