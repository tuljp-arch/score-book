import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser, getRivalsFor } from '@/lib/rivalries';
import { getShooterOptions } from '@/lib/head-to-head';
import ui from '@/components/ui.module.css';
import { addRivalAction, removeRivalAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function RivalsPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/rivals');

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before flagging rivals.'));

  const [rivals, allShooters] = await Promise.all([getRivalsFor(myShooterId), getShooterOptions()]);
  const rivalIds = new Set(rivals.map((r) => r.otherShooterId));
  const candidates = allShooters.filter((s) => s.shooter_id !== myShooterId && !rivalIds.has(s.shooter_id));

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Keep score with someone specific</div>
        <h1>Rivals</h1>
        <p>Flag another shooter as a rival for a permanent, one-click gross-and-net comparison.</p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        {rivals.length === 0 ? (
          <div className={ui.emptyState}>No rivals yet — add one below.</div>
        ) : (
          <div className={ui.listCard} style={{ marginBottom: 24 }}>
            {rivals.map((r) => (
              <div key={r.rivalryId} className={ui.listRow} style={{ textDecoration: 'none' }}>
                <a href={`/head-to-head/${myShooterId}/${r.otherShooterId}`} className={ui.listRowTitle} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                  {r.otherShooterName}
                </a>
                <form action={removeRivalAction}>
                  <input type="hidden" name="rivalryId" value={r.rivalryId} />
                  <button
                    type="submit"
                    className={ui.listRowMeta}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className={ui.card}>
          <label className={ui.label} htmlFor="rivalShooterId">
            Flag a new rival
          </label>
          <form action={addRivalAction}>
            <select id="rivalShooterId" name="rivalShooterId" required className={ui.select}>
              <option value="">Select a shooter…</option>
              {candidates.map((s) => (
                <option key={s.shooter_id} value={s.shooter_id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button type="submit" className={ui.button}>
              Add rival
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
