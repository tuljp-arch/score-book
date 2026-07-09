'use server';

import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { createCasualEvent, addParticipant, recordResult, submitWitness, claimParticipant } from '@/lib/casual';

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

export async function createCasualEventAction(formData: FormData) {
  const myShooterId = await requireMyShooterId('/casual');

  const name = String(formData.get('name') ?? '').trim();
  const eventDate = String(formData.get('eventDate') ?? '');
  const discipline = String(formData.get('discipline') ?? 'skeet');
  const gauge = String(formData.get('gauge') ?? '');

  if (!name || !eventDate || !gauge) {
    redirect(`/casual?error=${encodeURIComponent('Fill in a name, date, and gauge.')}`);
  }

  const casualEventId = await createCasualEvent(myShooterId, name, eventDate, discipline, gauge);
  redirect(`/casual/${casualEventId}`);
}

export async function addParticipantAction(formData: FormData) {
  await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');
  const guestName = String(formData.get('guestName') ?? '').trim();
  const guestPhone = String(formData.get('guestPhone') ?? '').trim();

  if (!guestName) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Enter a name.')}`);
  }

  await addParticipant(casualEventId, guestName, guestPhone || undefined);
  redirect(`/casual/${casualEventId}`);
}

export async function recordResultAction(formData: FormData) {
  await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');
  const casualParticipantId = String(formData.get('casualParticipantId') ?? '');
  const score = Number(formData.get('score'));
  const possible = Number(formData.get('possible'));

  if (!Number.isFinite(score) || !Number.isFinite(possible)) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Enter a valid score.')}`);
  }

  await recordResult(casualParticipantId, score, possible);
  redirect(`/casual/${casualEventId}`);
}

export async function submitWitnessAction(formData: FormData) {
  const myShooterId = await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');
  const casualResultId = String(formData.get('casualResultId') ?? '');
  const witnessedScore = Number(formData.get('witnessedScore'));

  if (!Number.isFinite(witnessedScore)) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Enter what you saw.')}`);
  }

  try {
    await submitWitness(casualResultId, myShooterId, witnessedScore);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not submit witness.';
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/casual/${casualEventId}`);
}

export async function claimAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/casual/claim/${token}`)}`);

  const shooterId = await claimParticipant(token, user!.id);
  redirect(`/profile/${shooterId}`);
}
