import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { getCasualEvent } from '@/lib/casual';
import ui from '@/components/ui.module.css';
import { addParticipantAction, recordResultAction, submitWitnessAction } from '../actions';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

const TIER_LABEL: Record<string, string> = {
  self_reported: 'Reported',
  witnessed: 'Witnessed',
  disputed: 'Disputed',
};
const TIER_COLOR: Record<string, string> = {
  self_reported: 'rgba(34,40,28,0.55)',
  witnessed: 'var(--clay)',
  disputed: '#B0413E',
};

export default async function CasualEventPage({
  params,
  searchParams,
}: {
  params: { casualEventId: string };
  searchParams: { error?: string };
}) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/casual/${params.casualEventId}`);

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account to view casual rounds.'));
  }

  const event = await getCasualEvent(params.casualEventId, myShooterId!);
  if (!event) {
    return (
      <div className={ui.page}>
        <div className={ui.wrap} style={{ paddingTop: 56 }}>
          <div className={ui.emptyState}>Couldn&apos;t find that casual round.</div>
        </div>
      </div>
    );
  }

  const isOrganizer = event.organizerShooterId === myShooterId;

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>
          Casual · {event.discipline} · {event.gauge} · not verified
        </div>
        <h1>{event.name}</h1>
        <p>
          {formatDate(event.eventDate)} · organized by {event.organizerName}
        </p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        <div className={ui.listCard} style={{ marginBottom: 24 }}>
          {event.participants.map((p) => {
            const canRecord = !p.result && (isOrganizer || p.shooterId === myShooterId);
            const canWitness =
              p.result &&
              p.result.verificationStatus === 'self_reported' &&
              !isOrganizer &&
              p.shooterId !== myShooterId;

            return (
              <div key={p.casualParticipantId} className={ui.listRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className={ui.listRowTitle}>
                    {p.displayName}
                    {p.isGuest && !p.claimedAt ? ' (unclaimed)' : ''}
                  </span>
                  <span>
                    {p.result ? (
                      <>
                        {p.result.hidden ? (
                          <span style={{ color: TIER_COLOR[p.result.verificationStatus], fontWeight: 600 }}>
                            {TIER_LABEL[p.result.verificationStatus]} — pending witness
                          </span>
                        ) : (
                          <>
                            <span className={ui.listRowMeta} style={{ marginRight: 8 }}>
                              {p.result.score}/{p.result.possible}
                              {p.result.verificationStatus === 'disputed' && p.result.witnessedScore !== null
                                ? ` (witness saw ${p.result.witnessedScore})`
                                : ''}
                            </span>
                            <span style={{ color: TIER_COLOR[p.result.verificationStatus], fontWeight: 600 }}>
                              {TIER_LABEL[p.result.verificationStatus]}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className={ui.listRowMeta}>no score yet</span>
                    )}
                  </span>
                </div>

                {isOrganizer && p.isGuest && !p.claimedAt && p.claimToken && (
                  <div className={ui.listRowMeta}>
                    Claim link: {`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/casual/claim/${p.claimToken}`}
                  </div>
                )}

                {canRecord && (
                  <form action={recordResultAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="hidden" name="casualEventId" value={event.casualEventId} />
                    <input type="hidden" name="casualParticipantId" value={p.casualParticipantId} />
                    <input name="score" type="number" placeholder="Score" required style={{ width: 80, padding: 6 }} />
                    <span>/</span>
                    <input name="possible" type="number" placeholder="100" defaultValue={100} required style={{ width: 70, padding: 6 }} />
                    <button type="submit" className={ui.button} style={{ padding: '6px 14px' }}>
                      Report
                    </button>
                  </form>
                )}

                {canWitness && (
                  <form action={submitWitnessAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="hidden" name="casualEventId" value={event.casualEventId} />
                    <input type="hidden" name="casualResultId" value={p.result!.casualResultId} />
                    <span className={ui.listRowMeta}>Witness — enter what you saw:</span>
                    <input name="witnessedScore" type="number" placeholder="Score" required style={{ width: 80, padding: 6 }} />
                    <button type="submit" className={ui.button} style={{ padding: '6px 14px' }}>
                      Submit
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {isOrganizer && (
          <div className={ui.card}>
            <label className={ui.label} htmlFor="guestName">
              Add a participant
            </label>
            <form action={addParticipantAction}>
              <input type="hidden" name="casualEventId" value={event.casualEventId} />
              <input id="guestName" name="guestName" placeholder="Name" required className={ui.input} />
              <input name="guestPhone" placeholder="Phone (optional)" className={ui.input} />
              <button type="submit" className={ui.button}>
                Add
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
