import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import ui from '@/components/ui.module.css';
import { connectAccount, signOut } from './actions';

// The NSSA import can mean many sequential requests to a slow legacy
// server (multi-year lookback, per-round leaderboard fetches) — ask
// Vercel for the most execution time it'll give a serverless function,
// since the default is too short for a shooter with a real multi-year
// history. Actions inherit the maxDuration of the page that invokes them.
export const maxDuration = 60;

export default async function ConnectPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/connect');

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Unlock your trophy case</div>
        <h1>Connect your NSSA account</h1>
        <p>
          Enter your NSSA member number and we&apos;ll pull in your real shoot history — every
          score, class win, and championship — from mynssa.nssa-nsca.org.
        </p>
      </div>
      <div className={ui.wrap}>
        <div className={ui.card}>
          <div style={{ marginBottom: 20, fontSize: 13.5, color: 'rgba(34,40,28,0.6)' }}>
            Logged in as {user.email}.{' '}
            <form action={signOut} style={{ display: 'inline' }}>
              <button
                type="submit"
                style={{ border: 'none', background: 'none', color: 'var(--clay)', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                Log out
              </button>
            </form>
          </div>

          {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

          <form action={connectAccount}>
            <label className={ui.label} htmlFor="memberId">
              NSSA Member Number
            </label>
            <input id="memberId" name="memberId" placeholder="e.g. 367202" required className={ui.input} />
            <button type="submit" className={ui.button}>
              Connect
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
