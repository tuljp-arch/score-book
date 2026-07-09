// Follow-up to test-casual.ts: tests claimParticipant with a real auth
// user id (shooters.user_id has a real FK to auth.users, so a fake UUID
// correctly gets rejected — this is that test, done properly).
import { getClaimInfo, claimParticipant } from '../lib/casual';

const token = process.argv[2];
const JEFF_REAL_USER_ID = '5f2f8043-b0da-445b-8c57-f2579d7b3110';

async function main() {
  const before = await getClaimInfo(token);
  console.log('Before claim:', JSON.stringify(before, null, 2));

  const shooterId = await claimParticipant(token, JEFF_REAL_USER_ID);
  console.log('Claimed — resolved shooter id:', shooterId, '(expect this to equal Jeff\'s existing shooter id, not a new one)');

  const after = await getClaimInfo(token);
  console.log('After claim:', JSON.stringify(after, null, 2));
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
