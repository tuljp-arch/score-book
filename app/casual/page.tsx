import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getShooterIdForUser } from '@/lib/rivalries';
import { getMyCasualEvents } from '@/lib/casual';
import { GAUGE_OPTIONS } from '@/lib/ladders';
import ui from '@/components/ui.module.css';
import { createCasualEventAction } from './actions';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export default async function CasualPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/casual');

  const myShooterId = await getShooterIdForUser(user.id);
  if (!myShooterId) {
    redirect('/connect?error=' + encodeURIComponent('Connect your NSSA account before organizing a casual round.'));
  }

  const events = await getMyCasualEvents(myShooterId!);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Unverified, on purpose</div>
        <h1>Casual Rounds</h1>
        <p>
          Self-reported scores for fun-shoots and friend groups — never touches your verified
          record, handicap, or the ladders. Great for inviting people who don&apos;t have an
          account yet.
        </p>
      </div>
      <div className={ui.wrap}>
        {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}

        {events.length === 0 ? (
          <div className={ui.emptyState}>No casual rounds yet — start one below.</div>
        ) : (
          <div className={ui.listCard} style={{ marginBottom: 24 }}>
            {events.map((e) => (
              <a key={e.casualEventId} href={`/casual/${e.casualEventId}`} className={ui.listRow}>
                <span className={ui.listRowTitle}>{e.name}</span>
                <span className={ui.listRowMeta}>
                  {formatDate(e.eventDate)} · organized by {e.organizerName}
                </span>
              </a>
            ))}
          </div>
        )}

        <div className={ui.card}>
          <label className={ui.label} htmlFor="name">
            Start a casual round
          </label>
          <form action={createCasualEventAction}>
            <input id="name" name="name" placeholder="e.g. Saturday fun shoot" required className={ui.input} />

            <label className={ui.label} htmlFor="eventDate">
              Date
            </label>
            <input id="eventDate" name="eventDate" type="date" defaultValue={today} required className={ui.input} />

            <label className={ui.label} htmlFor="gauge">
              Gauge
            </label>
            <select id="gauge" name="gauge" required className={ui.select}>
              {GAUGE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <label className={ui.label} htmlFor="format">
              Format
            </label>
            <select id="format" name="format" defaultValue="reported" className={ui.select}>
              <option value="reported">Reported scores</option>
              <option value="bracket">Bracket tournament</option>
            </select>

            <button type="submit" className={ui.button}>
              Create
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
