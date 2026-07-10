'use server';

import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import {
  createCasualEvent,
  addParticipant,
  addExistingParticipant,
  recordResult,
  submitWitness,
  claimParticipant,
  getCasualEvent,
  type CasualEventFormat,
} from '@/lib/casual';
import { startBracket, reportMatchResult, getBracket, canReportMatch } from '@/lib/tournaments';

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
  const format = (String(formData.get('format') ?? 'reported') as CasualEventFormat);

  if (!name || !eventDate || !gauge) {
    redirect(`/casual?error=${encodeURIComponent('Fill in a name, date, and gauge.')}`);
  }

  const casualEventId = await createCasualEvent(myShooterId, name, eventDate, discipline, gauge, format);
  redirect(`/casual/${casualEventId}`);
}

export async function addExistingParticipantAction(formData: FormData) {
  await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');
  const shooterId = String(formData.get('shooterId') ?? '');

  if (!shooterId) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Select a shooter.')}`);
  }

  try {
    await addExistingParticipant(casualEventId, shooterId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not add that shooter.';
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent(message)}`);
  }

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

export async function startTournamentAction(formData: FormData) {
  const myShooterId = await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');

  const event = await getCasualEvent(casualEventId, myShooterId);
  if (!event || event.organizerShooterId !== myShooterId) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Only the organizer can start the tournament.')}`);
  }

  try {
    await startBracket(casualEventId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not start the tournament.';
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/casual/${casualEventId}`);
}

export async function reportMatchResultAction(formData: FormData) {
  const myShooterId = await requireMyShooterId('/casual');

  const casualEventId = String(formData.get('casualEventId') ?? '');
  const matchId = String(formData.get('matchId') ?? '');
  const scoreA = Number(formData.get('scoreA'));
  const scoreB = Number(formData.get('scoreB'));
  const possible = Number(formData.get('possible'));

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || !Number.isFinite(possible)) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Enter valid scores.')}`);
  }

  const event = await getCasualEvent(casualEventId, myShooterId);
  if (!event) redirect(`/casual/${casualEventId}?error=${encodeURIComponent('Round not found.')}`);
  const isOrganizer = event!.organizerShooterId === myShooterId;

  const bracket = await getBracket(casualEventId);
  const match = bracket?.rounds.flatMap((r) => r.matches).find((m) => m.matchId === matchId);
  if (!match || !canReportMatch(match, myShooterId, isOrganizer)) {
    redirect(`/casual/${casualEventId}?error=${encodeURIComponent("You can't report this match.")}`);
  }

  try {
    await reportMatchResult(matchId, scoreA, scoreB, possible);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not report the match.';
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
