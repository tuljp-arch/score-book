'use server';

import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser, addRival, archiveRival } from '@/lib/rivalries';

export async function addRivalAction(formData: FormData) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/rivals');

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before flagging rivals.'));

  const otherShooterId = String(formData.get('rivalShooterId') ?? '');
  if (!otherShooterId) redirect(`/rivals?error=${encodeURIComponent('Pick a shooter to flag as a rival.')}`);

  try {
    await addRival(myShooterId, otherShooterId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not add rival.';
    redirect(`/rivals?error=${encodeURIComponent(message)}`);
  }

  redirect('/rivals');
}

export async function removeRivalAction(formData: FormData) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/rivals');

  const rivalryId = String(formData.get('rivalryId') ?? '');
  if (rivalryId) await archiveRival(rivalryId);

  redirect('/rivals');
}
