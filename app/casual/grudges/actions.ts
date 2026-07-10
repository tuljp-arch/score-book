'use server';

import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { createCasualEvent, addExistingParticipant } from '@/lib/casual';

async function requireMyShooterId(next: string): Promise<string> {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const myShooterId = await getShooterIdForUser(user!.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before organizing a casual round.'));
  }
  return myShooterId!;
}

export async function rematchAction(formData: FormData) {
  const myShooterId = await requireMyShooterId('/casual/grudges');

  const otherShooterId = String(formData.get('otherShooterId') ?? '');
  const otherShooterName = String(formData.get('otherShooterName') ?? 'your rival');
  const discipline = String(formData.get('discipline') ?? 'skeet');
  const gauge = String(formData.get('gauge') ?? '12ga');

  const today = new Date().toISOString().slice(0, 10);
  const casualEventId = await createCasualEvent(myShooterId, `Rematch vs. ${otherShooterName}`, today, discipline, gauge, 'reported');
  await addExistingParticipant(casualEventId, myShooterId);
  await addExistingParticipant(casualEventId, otherShooterId);

  redirect(`/casual/${casualEventId}`);
}
