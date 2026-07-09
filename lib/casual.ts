import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabase-server';

// Per CLAUDE_CODE_PROJECT_BRIEF.md, item 10: a genuinely separate track for
// self-reported/witnessed casual rounds — club fun-shoots, informal friend
// groups. Its own tables (casual_events/casual_participants/casual_results/
// casual_result_witnesses), never merging into results, the handicap
// engine, Challenges, or Ladders. Nothing in this file writes to any of
// those — that's the whole point of the wall.
//
// Three tiers, only two of which live here: Verified is just a real
// `results` row (the rest of this app) — a casual round never becomes
// Verified. Within casual_results, verification_status is Self-Reported
// by default, upgrades to Witnessed when a second real (named, not guest)
// account independently enters a matching score, or Disputed if it
// doesn't match. Disputed shows both numbers as-is — no auto-resolution.
//
// Blind witnessing: rather than a separate page, self_reported scores are
// simply not shown to anyone except the organizer and the participant who
// owns the result (see getCasualEvent's reveal rule) until a witness has
// been submitted — at which point the tier flips to witnessed/disputed and
// the score is visible to everyone on the event. A witness could still
// defeat this by asking the organizer directly, but the UI itself never
// hands them the number before they commit to what they saw.

type VerificationStatus = 'self_reported' | 'witnessed' | 'disputed';

export interface CasualParticipant {
  casualParticipantId: string;
  shooterId: string | null;
  displayName: string;
  isGuest: boolean;
  claimToken: string | null;
  claimedAt: string | null;
  result: {
    casualResultId: string;
    score: number | null; // null when hidden from this viewer
    possible: number | null;
    verificationStatus: VerificationStatus;
    hidden: boolean;
    witnessedScore: number | null; // shown only when disputed
  } | null;
}

export interface CasualEventDetail {
  casualEventId: string;
  name: string;
  organizerShooterId: string;
  organizerName: string;
  eventDate: string;
  discipline: string | null;
  gauge: string | null;
  participants: CasualParticipant[];
}

export interface CasualEventSummary {
  casualEventId: string;
  name: string;
  eventDate: string;
  organizerName: string;
}

async function getOrCreateShooterForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  fallbackName: string
): Promise<string> {
  const { data: existing } = await supabase.from('shooters').select('shooter_id').eq('user_id', userId).maybeSingle();
  if (existing) return existing.shooter_id;

  const { data: created, error } = await supabase
    .from('shooters')
    .insert({ full_name: fallbackName, user_id: userId })
    .select('shooter_id')
    .single();
  if (error) throw error;
  return created.shooter_id;
}

export async function createCasualEvent(
  organizerShooterId: string,
  name: string,
  eventDate: string,
  discipline: string,
  gauge: string
): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('casual_events')
    .insert({ name, organizer_shooter_id: organizerShooterId, event_date: eventDate, discipline, gauge })
    .select('casual_event_id')
    .single();
  if (error) throw error;
  return data.casual_event_id;
}

export async function addParticipant(
  casualEventId: string,
  guestName: string,
  guestPhone?: string
): Promise<{ claimToken: string }> {
  const supabase = createServerClient();
  const claimToken = randomUUID();
  const { error } = await supabase.from('casual_participants').insert({
    casual_event_id: casualEventId,
    guest_name: guestName,
    guest_phone: guestPhone || null,
    claim_token: claimToken,
  });
  if (error) throw error;
  return { claimToken };
}

export async function recordResult(casualParticipantId: string, score: number, possible: number, notes?: string): Promise<void> {
  const supabase = createServerClient();
  const { data: casualEventId } = await supabase
    .from('casual_participants')
    .select('casual_event_id')
    .eq('casual_participant_id', casualParticipantId)
    .single();

  const { data: existing } = await supabase
    .from('casual_results')
    .select('casual_result_id')
    .eq('casual_participant_id', casualParticipantId)
    .maybeSingle();
  if (existing) return; // one result per participant for this MVP — no re-reporting over an existing entry

  const { error } = await supabase.from('casual_results').insert({
    casual_event_id: casualEventId!.casual_event_id,
    casual_participant_id: casualParticipantId,
    score,
    possible,
    notes: notes || null,
    verification_status: 'self_reported',
  });
  if (error) throw error;
}

export async function submitWitness(casualResultId: string, witnessShooterId: string, witnessedScore: number): Promise<void> {
  const supabase = createServerClient();

  const { data: result } = await supabase
    .from('casual_results')
    .select('score, casual_participant_id')
    .eq('casual_result_id', casualResultId)
    .single();
  if (!result) throw new Error('Result not found.');

  const { data: participant } = await supabase
    .from('casual_participants')
    .select('shooter_id')
    .eq('casual_participant_id', result.casual_participant_id)
    .single();
  if (participant?.shooter_id === witnessShooterId) {
    throw new Error("You can't witness your own score.");
  }

  const { error: witnessError } = await supabase.from('casual_result_witnesses').insert({
    casual_result_id: casualResultId,
    witness_shooter_id: witnessShooterId,
    witnessed_score: witnessedScore,
  });
  if (witnessError) {
    if (witnessError.code === '23505') throw new Error("You've already witnessed this result.");
    throw witnessError;
  }

  const matches = witnessedScore === result.score;
  await supabase
    .from('casual_results')
    .update({ verification_status: matches ? 'witnessed' : 'disputed' })
    .eq('casual_result_id', casualResultId);
}

export async function getCasualEvent(casualEventId: string, viewerShooterId: string): Promise<CasualEventDetail | null> {
  const supabase = createServerClient();

  const { data: event } = await supabase
    .from('casual_events')
    .select('casual_event_id, name, organizer_shooter_id, event_date, discipline, gauge, shooters ( full_name )')
    .eq('casual_event_id', casualEventId)
    .maybeSingle();
  if (!event) return null;

  const { data: participants } = await supabase
    .from('casual_participants')
    .select('casual_participant_id, shooter_id, guest_name, claim_token, claimed_at')
    .eq('casual_event_id', casualEventId);

  const shooterIds = (participants ?? []).map((p) => p.shooter_id).filter((id): id is string => Boolean(id));
  const { data: shooters } = shooterIds.length
    ? await supabase.from('shooters').select('shooter_id, full_name').in('shooter_id', shooterIds)
    : { data: [] as { shooter_id: string; full_name: string }[] };
  const nameById = new Map((shooters ?? []).map((s) => [s.shooter_id, s.full_name]));

  const { data: results } = await supabase
    .from('casual_results')
    .select('casual_result_id, casual_participant_id, score, possible, verification_status')
    .in(
      'casual_participant_id',
      (participants ?? []).map((p) => p.casual_participant_id)
    );
  const resultByParticipant = new Map((results ?? []).map((r) => [r.casual_participant_id, r]));

  // For disputed results, fetch the witness's number to show alongside.
  const disputedResultIds = (results ?? []).filter((r) => r.verification_status === 'disputed').map((r) => r.casual_result_id);
  const { data: witnesses } = disputedResultIds.length
    ? await supabase.from('casual_result_witnesses').select('casual_result_id, witnessed_score').in('casual_result_id', disputedResultIds)
    : { data: [] as { casual_result_id: string; witnessed_score: number }[] };
  const witnessedScoreByResult = new Map((witnesses ?? []).map((w) => [w.casual_result_id, w.witnessed_score]));

  const isOrganizer = event.organizer_shooter_id === viewerShooterId;

  const eventShooters = (event as unknown as { shooters: { full_name: string } | null }).shooters;

  return {
    casualEventId: event.casual_event_id,
    name: event.name,
    organizerShooterId: event.organizer_shooter_id,
    organizerName: eventShooters?.full_name ?? 'Unknown organizer',
    eventDate: event.event_date,
    discipline: event.discipline,
    gauge: event.gauge,
    participants: (participants ?? []).map((p) => {
      const result = resultByParticipant.get(p.casual_participant_id);
      const isSelf = p.shooter_id === viewerShooterId;
      const hidden = Boolean(result) && result!.verification_status === 'self_reported' && !isOrganizer && !isSelf;

      return {
        casualParticipantId: p.casual_participant_id,
        shooterId: p.shooter_id,
        displayName: p.shooter_id ? nameById.get(p.shooter_id) ?? p.guest_name ?? 'Unknown' : p.guest_name ?? 'Unknown',
        isGuest: !p.shooter_id,
        claimToken: isOrganizer ? p.claim_token : null,
        claimedAt: p.claimed_at,
        result: result
          ? {
              casualResultId: result.casual_result_id,
              score: hidden ? null : result.score,
              possible: hidden ? null : result.possible,
              verificationStatus: result.verification_status as VerificationStatus,
              hidden,
              witnessedScore:
                result.verification_status === 'disputed' ? witnessedScoreByResult.get(result.casual_result_id) ?? null : null,
            }
          : null,
      };
    }),
  };
}

export async function getMyCasualEvents(shooterId: string): Promise<CasualEventSummary[]> {
  const supabase = createServerClient();

  const { data: organized } = await supabase
    .from('casual_events')
    .select('casual_event_id, name, event_date, shooters ( full_name )')
    .eq('organizer_shooter_id', shooterId);

  const { data: myParticipant } = await supabase.from('casual_participants').select('casual_event_id').eq('shooter_id', shooterId);
  const participatedIds = (myParticipant ?? []).map((p) => p.casual_event_id);
  const { data: participated } =
    participatedIds.length > 0
      ? await supabase
          .from('casual_events')
          .select('casual_event_id, name, event_date, shooters ( full_name )')
          .in('casual_event_id', participatedIds)
      : { data: [] as { casual_event_id: string; name: string; event_date: string; shooters: { full_name: string } | null }[] };

  const all = [...(organized ?? []), ...(participated ?? [])] as unknown as {
    casual_event_id: string;
    name: string;
    event_date: string;
    shooters: { full_name: string } | null;
  }[];
  const seen = new Set<string>();
  const summaries: CasualEventSummary[] = [];
  for (const e of all) {
    if (seen.has(e.casual_event_id)) continue;
    seen.add(e.casual_event_id);
    summaries.push({
      casualEventId: e.casual_event_id,
      name: e.name,
      eventDate: e.event_date,
      organizerName: e.shooters?.full_name ?? 'Unknown organizer',
    });
  }
  return summaries.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

export interface ClaimInfo {
  casualParticipantId: string;
  guestName: string | null;
  alreadyClaimed: boolean;
  eventName: string;
  casualEventId: string;
}

export async function getClaimInfo(token: string): Promise<ClaimInfo | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('casual_participants')
    .select('casual_participant_id, guest_name, claimed_at, casual_events ( casual_event_id, name )')
    .eq('claim_token', token)
    .maybeSingle();
  if (!data) return null;

  const event = (data as unknown as { casual_events: { casual_event_id: string; name: string } | null }).casual_events;
  return {
    casualParticipantId: data.casual_participant_id,
    guestName: data.guest_name,
    alreadyClaimed: Boolean(data.claimed_at),
    eventName: event?.name ?? 'Casual round',
    casualEventId: event?.casual_event_id ?? '',
  };
}

export async function claimParticipant(token: string, userId: string): Promise<string> {
  const supabase = createServerClient();
  const { data: participant } = await supabase
    .from('casual_participants')
    .select('casual_participant_id, guest_name, claimed_at')
    .eq('claim_token', token)
    .maybeSingle();
  if (!participant) throw new Error('Claim link not found.');
  if (participant.claimed_at) throw new Error('This invite has already been claimed.');

  const shooterId = await getOrCreateShooterForUser(supabase, userId, participant.guest_name ?? 'New shooter');

  const { error } = await supabase
    .from('casual_participants')
    .update({ shooter_id: shooterId, claimed_at: new Date().toISOString() })
    .eq('casual_participant_id', participant.casual_participant_id);
  if (error) throw error;

  return shooterId;
}
