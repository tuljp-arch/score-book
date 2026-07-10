import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { getGrudgesFor } from '@/lib/grudges';
import ui from '@/components/ui.module.css';
import { rematchAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function GrudgesPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/casual/grudges');

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account to see your grudges.'));
  }

  const grudges = await getGrudgesFor(myShooterId!);

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Casual · settle the score</div>
        <h1>Grudges</h1>
        <p>Head-to-head records from your casual rounds. Win the most recent matchup, hold the belt.</p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        {grudges.length === 0 ? (
          <div className={ui.emptyState}>
            No grudges yet — shoot a witnessed casual round or bracket match against someone to start one.
          </div>
        ) : (
          <div className={ui.listCard}>
            {grudges.map((g) => (
              <div key={g.otherShooterId} className={ui.listRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className={ui.listRowTitle}>{g.otherShooterName}</span>
                  <span className={ui.listRowMeta}>
                    {g.record.wins}-{g.record.losses}
                    {g.record.ties > 0 ? `-${g.record.ties}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {g.beltHolder === 'me' && (
                    <span
                      style={{
                        background: 'var(--clay)',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '2px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      🏆 Belt
                    </span>
                  )}
                  {g.streak && g.streak.count > 1 && (
                    <span className={ui.listRowMeta}>
                      {g.streak.holder === 'me' ? `Won ${g.streak.count} straight` : `${g.otherShooterName} on a ${g.streak.count}-win streak`}
                    </span>
                  )}
                </div>
                <form action={rematchAction}>
                  <input type="hidden" name="otherShooterId" value={g.otherShooterId} />
                  <input type="hidden" name="otherShooterName" value={g.otherShooterName} />
                  <input type="hidden" name="discipline" value={g.lastMatchup?.discipline ?? 'skeet'} />
                  <input type="hidden" name="gauge" value={g.lastMatchup?.gauge ?? '12ga'} />
                  <button type="submit" className={ui.button} style={{ padding: '6px 14px', alignSelf: 'flex-start' }}>
                    Rematch
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
