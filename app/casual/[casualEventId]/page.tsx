import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { getCasualEvent } from '@/lib/casual';
import { getShooterOptions } from '@/lib/head-to-head';
import { getBracket, canReportMatch, type BracketView, type BracketMatchView } from '@/lib/tournaments';
import { getGrudgeContextForEvent } from '@/lib/grudges';
import ui from '@/components/ui.module.css';
import {
  addParticipantAction,
  addExistingParticipantAction,
  recordResultAction,
  submitWitnessAction,
  startTournamentAction,
  reportMatchResultAction,
} from '../actions';

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

function BracketSection({
  bracket,
  casualEventId,
  isOrganizer,
  myShooterId,
}: {
  bracket: BracketView;
  casualEventId: string;
  isOrganizer: boolean;
  myShooterId: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {bracket.isComplete && bracket.champion && (
        <div
          className={ui.card}
          style={{ marginBottom: 16, textAlign: 'center', background: 'var(--clay)', color: '#fff' }}
        >
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Champion</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>🏆 {bracket.champion.displayName}</div>
        </div>
      )}

      {bracket.rounds.map((round) => (
        <div key={round.roundNumber} className={ui.listCard} style={{ marginBottom: 16 }}>
          <div className={ui.listRowMeta} style={{ padding: '10px 16px 0' }}>
            Round {round.roundNumber}
          </div>
          {round.matches.map((match) => (
            <BracketMatchRow
              key={match.matchId}
              match={match}
              casualEventId={casualEventId}
              isOrganizer={isOrganizer}
              myShooterId={myShooterId}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function BracketMatchRow({
  match,
  casualEventId,
  isOrganizer,
  myShooterId,
}: {
  match: BracketMatchView;
  casualEventId: string;
  isOrganizer: boolean;
  myShooterId: string;
}) {
  const nameA = match.participantAName ?? 'TBD';
  const nameB = match.participantBName ?? 'TBD';
  const canReport = canReportMatch(match, myShooterId, isOrganizer);

  return (
    <div className={ui.listRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span className={ui.listRowTitle}>
          {match.status === 'reported' ? (
            <>
              <span style={{ fontWeight: match.winnerParticipantId === match.participantAId ? 700 : 400 }}>{nameA}</span>
              {' vs '}
              <span style={{ fontWeight: match.winnerParticipantId === match.participantBId ? 700 : 400 }}>{nameB}</span>
            </>
          ) : (
            `${nameA} vs ${nameB}`
          )}
        </span>
        <span className={ui.listRowMeta}>
          {match.status === 'bye' && 'BYE'}
          {match.status === 'waiting' && 'Waiting'}
          {match.status === 'ready' && 'Ready'}
          {match.status === 'reported' && `${match.scoreA}/${match.possible} — ${match.scoreB}/${match.possible}`}
        </span>
      </div>

      {canReport && (
        <form action={reportMatchResultAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="casualEventId" value={casualEventId} />
          <input type="hidden" name="matchId" value={match.matchId} />
          <span className={ui.listRowMeta}>{nameA}:</span>
          <input name="scoreA" type="number" placeholder="Score" required style={{ width: 70, padding: 6 }} />
          <span className={ui.listRowMeta}>{nameB}:</span>
          <input name="scoreB" type="number" placeholder="Score" required style={{ width: 70, padding: 6 }} />
          <span>/</span>
          <input name="possible" type="number" placeholder="100" defaultValue={100} required style={{ width: 70, padding: 6 }} />
          <button type="submit" className={ui.button} style={{ padding: '6px 14px' }}>
            Report
          </button>
        </form>
      )}
    </div>
  );
}

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
  const existingParticipantIds = new Set(event.participants.map((p) => p.shooterId).filter((id): id is string => Boolean(id)));
  const shooterCandidates = isOrganizer
    ? (await getShooterOptions()).filter((s) => !existingParticipantIds.has(s.shooter_id))
    : [];

  const bracket = event.format === 'bracket' ? await getBracket(event.casualEventId) : null;
  const bracketStarted = Boolean(bracket && bracket.rounds.length > 0);
  const canManageParticipants = event.format === 'reported' || !bracketStarted;

  const eventParticipantShooterIds = event.participants.map((p) => p.shooterId).filter((id): id is string => Boolean(id));
  const grudgeContext = await getGrudgeContextForEvent(myShooterId!, eventParticipantShooterIds);

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>
          Casual · {event.discipline} · {event.gauge} · not verified{event.format === 'bracket' ? ' · Bracket' : ''}
        </div>
        <h1>{event.name}</h1>
        <p>
          {formatDate(event.eventDate)} · organized by {event.organizerName}
        </p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        {grudgeContext.length > 0 && (
          <div className={ui.card} style={{ marginBottom: 24, background: 'var(--field, #262E1E)', color: '#EDE7D6' }}>
            {grudgeContext.map((g) => (
              <p key={g.otherShooterId} style={{ margin: '4px 0' }}>
                {g.beltHolder === 'me' && g.streak && g.streak.count > 1
                  ? `This round settles it — you're defending a ${g.streak.count}-win streak vs. ${g.otherShooterName}.`
                  : g.beltHolder === 'them' && g.streak && g.streak.count > 1
                    ? `${g.otherShooterName} is defending a ${g.streak.count}-win streak — and the belt.`
                    : g.beltHolder === 'them'
                      ? `${g.otherShooterName} holds the belt against you (${g.record.wins}-${g.record.losses}). Time for a statement win.`
                      : g.beltHolder === 'me'
                        ? `You're defending the belt against ${g.otherShooterName} (${g.record.wins}-${g.record.losses}).`
                        : `You and ${g.otherShooterName} are tied up — no belt holder yet.`}
              </p>
            ))}
          </div>
        )}

        {event.format === 'reported' && (
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
        )}

        {event.format === 'bracket' && !bracketStarted && (
          <div className={ui.listCard} style={{ marginBottom: 24 }}>
            {event.participants.length === 0 ? (
              <div className={ui.emptyState}>No participants yet — add some below.</div>
            ) : (
              event.participants.map((p) => (
                <div key={p.casualParticipantId} className={ui.listRow}>
                  <span className={ui.listRowTitle}>
                    {p.displayName}
                    {p.isGuest && !p.claimedAt ? ' (unclaimed)' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {event.format === 'bracket' && isOrganizer && !bracketStarted && (
          <div className={ui.card} style={{ marginBottom: 24 }}>
            <form action={startTournamentAction}>
              <input type="hidden" name="casualEventId" value={event.casualEventId} />
              <button type="submit" className={ui.button} disabled={event.participants.length < 2}>
                Start Tournament
              </button>
              {event.participants.length < 2 && (
                <p className={ui.helpText}>Add at least 2 participants first.</p>
              )}
              {event.participants.length > 8 && (
                <p className={ui.helpText}>Brackets are capped at 8 participants.</p>
              )}
            </form>
          </div>
        )}

        {event.format === 'bracket' && bracket && bracketStarted && (
          <BracketSection bracket={bracket} casualEventId={event.casualEventId} isOrganizer={isOrganizer} myShooterId={myShooterId!} />
        )}

        {isOrganizer && canManageParticipants && (
          <div className={ui.card}>
            <label className={ui.label} htmlFor="guestName">
              Add a guest
            </label>
            <form action={addParticipantAction}>
              <input type="hidden" name="casualEventId" value={event.casualEventId} />
              <input id="guestName" name="guestName" placeholder="Name" required className={ui.input} />
              <input name="guestPhone" placeholder="Phone (optional)" className={ui.input} />
              <button type="submit" className={ui.button}>
                Add
              </button>
            </form>

            {shooterCandidates.length > 0 && (
              <>
                <label className={ui.label} htmlFor="shooterId" style={{ marginTop: 16 }}>
                  Add an existing shooter
                </label>
                <form action={addExistingParticipantAction}>
                  <input type="hidden" name="casualEventId" value={event.casualEventId} />
                  <select id="shooterId" name="shooterId" required className={ui.select}>
                    <option value="">Select a shooter…</option>
                    {shooterCandidates.map((s) => (
                      <option key={s.shooter_id} value={s.shooter_id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={ui.button}>
                    Add
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
