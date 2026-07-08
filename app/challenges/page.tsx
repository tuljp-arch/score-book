import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { getChallengesFor, getGaugeOptions, type ChallengeSummary } from '@/lib/challenges';
import { getShooterOptions } from '@/lib/head-to-head';
import ui from '@/components/ui.module.css';
import { createChallengeAction, respondToChallengeAction } from './actions';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function otherName(c: ChallengeSummary, myShooterId: string): string {
  return c.initiatorId === myShooterId ? c.opponentName : c.initiatorName;
}

function ChallengeCard({ c, myShooterId }: { c: ChallengeSummary; myShooterId: string }) {
  const iAmOpponent = c.opponentId === myShooterId;
  const mine = c.entries.find((e) => e.shooterId === myShooterId);
  const theirs = c.entries.find((e) => e.shooterId !== myShooterId);
  const winner =
    mine && theirs && mine.netScore !== null && theirs.netScore !== null
      ? mine.netScore > theirs.netScore
        ? 'you'
        : mine.netScore < theirs.netScore
          ? 'them'
          : 'tie'
      : null;

  return (
    <div className={ui.card} style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 18, marginBottom: 4 }}>
        vs {otherName(c, myShooterId)}
      </div>
      <div className={ui.listRowMeta} style={{ marginBottom: 12 }}>
        {c.discipline} · {c.gauge} · through {formatDate(c.windowEnd)} · {c.status}
      </div>

      {c.status === 'pending' && iAmOpponent && (
        <form action={respondToChallengeAction} style={{ display: 'flex', gap: 10 }}>
          <input type="hidden" name="challengeId" value={c.challengeId} />
          <button type="submit" name="accept" value="true" className={ui.button}>
            Accept
          </button>
          <button
            type="submit"
            name="accept"
            value="false"
            className={ui.button}
            style={{ background: 'transparent', color: 'var(--clay-dark)', border: '1px solid var(--clay-dark)' }}
          >
            Decline
          </button>
        </form>
      )}

      {c.status === 'pending' && !iAmOpponent && <div className={ui.helpText}>Waiting on them to accept.</div>}

      {c.status === 'active' && <div className={ui.helpText}>Waiting on a qualifying result from both sides.</div>}

      {c.status === 'completed' && mine && theirs && (
        <div>
          <div>
            Gross — You: {mine.grossScore} · Them: {theirs.grossScore}
          </div>
          <div>
            Net — You: {mine.netScore ?? '—'} · Them: {theirs.netScore ?? '—'}
          </div>
          <div style={{ fontWeight: 600, marginTop: 6, color: winner === 'you' ? 'var(--clay)' : 'inherit' }}>
            {winner === 'you' && 'You won on net.'}
            {winner === 'them' && `${otherName(c, myShooterId)} won on net.`}
            {winner === 'tie' && "It's a net tie."}
            {winner === null && 'Net score unavailable for one side (no handicap yet) — gross only.'}
          </div>
        </div>
      )}

      {(c.status === 'declined' || c.status === 'expired') && (
        <div className={ui.helpText} style={{ textTransform: 'capitalize' }}>{c.status}</div>
      )}
    </div>
  );
}

export default async function ChallengesPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/challenges');

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before starting a challenge.'));
  }

  const [challenges, allShooters] = await Promise.all([getChallengesFor(myShooterId!), getShooterOptions()]);
  const candidates = allShooters.filter((s) => s.shooter_id !== myShooterId);

  const needsResponse = challenges.filter((c) => c.status === 'pending' && c.opponentId === myShooterId);
  const rest = challenges.filter((c) => !(c.status === 'pending' && c.opponentId === myShooterId));

  const minDeadline = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Time-boxed, opt-in</div>
        <h1>Challenges</h1>
        <p>Invite a shooter to a window. Once you both post a qualifying result, net decides the winner.</p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        {needsResponse.length > 0 && (
          <>
            <div className={ui.label} style={{ marginBottom: 10 }}>
              Needs your response
            </div>
            {needsResponse.map((c) => (
              <ChallengeCard key={c.challengeId} c={c} myShooterId={myShooterId!} />
            ))}
          </>
        )}

        {rest.length > 0 && (
          <>
            <div className={ui.label} style={{ marginBottom: 10 }}>
              Your challenges
            </div>
            {rest.map((c) => (
              <ChallengeCard key={c.challengeId} c={c} myShooterId={myShooterId!} />
            ))}
          </>
        )}

        {challenges.length === 0 && <div className={ui.emptyState}>No challenges yet — start one below.</div>}

        <div className={ui.card} style={{ marginTop: 24 }}>
          <label className={ui.label} htmlFor="opponentId">
            Challenge a shooter
          </label>
          <form action={createChallengeAction}>
            <select id="opponentId" name="opponentId" required className={ui.select}>
              <option value="">Select a shooter…</option>
              {candidates.map((s) => (
                <option key={s.shooter_id} value={s.shooter_id}>
                  {s.full_name}
                </option>
              ))}
            </select>

            <label className={ui.label} htmlFor="gauge">
              Gauge
            </label>
            <select id="gauge" name="gauge" required className={ui.select}>
              {getGaugeOptions().map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <label className={ui.label} htmlFor="windowEnd">
              Deadline
            </label>
            <input
              id="windowEnd"
              name="windowEnd"
              type="date"
              required
              min={minDeadline}
              className={ui.input}
            />

            <button type="submit" className={ui.button}>
              Send challenge
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
