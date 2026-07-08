'use server';

import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { createChallenge, respondToChallenge } from '@/lib/challenges';

async function requireMyShooterId(): Promise<string> {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/challenges');

  const myShooterId = await getShooterIdForUser(user!.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before starting a challenge.'));
  }
  return myShooterId!;
}

export async function createChallengeAction(formData: FormData) {
  const myShooterId = await requireMyShooterId();

  const opponentId = String(formData.get('opponentId') ?? '');
  const discipline = String(formData.get('discipline') ?? 'skeet');
  const gauge = String(formData.get('gauge') ?? '');
  const windowEnd = String(formData.get('windowEnd') ?? '');

  if (!opponentId || !gauge || !windowEnd) {
    redirect(`/challenges?error=${encodeURIComponent('Fill in an opponent, gauge, and deadline.')}`);
  }

  try {
    await createChallenge(myShooterId, opponentId, discipline, gauge, windowEnd);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not create challenge.';
    redirect(`/challenges?error=${encodeURIComponent(message)}`);
  }

  redirect('/challenges');
}

export async function respondToChallengeAction(formData: FormData) {
  const myShooterId = await requireMyShooterId();

  const challengeId = String(formData.get('challengeId') ?? '');
  const accept = formData.get('accept') === 'true';

  try {
    await respondToChallenge(challengeId, myShooterId, accept);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not respond to challenge.';
    redirect(`/challenges?error=${encodeURIComponent(message)}`);
  }

  redirect('/challenges');
}
