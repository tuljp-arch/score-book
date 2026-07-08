import { getEventOptions } from '@/lib/event-leaderboard';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export default async function EventsPage() {
  const events = await getEventOptions();

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>The season so far</div>
        <h1>Events</h1>
        <p>Every registered event with results on the books.</p>
      </div>
      <div className={ui.wrap}>
        {events.length === 0 ? (
          <div className={ui.emptyState}>No events yet.</div>
        ) : (
          <div className={ui.listCard}>
            {events.map((e) => (
              <a key={e.event_id} href={`/event/${e.event_id}`} className={ui.listRow}>
                <span className={ui.listRowTitle}>{e.name}</span>
                <span className={ui.listRowMeta}>{formatDate(e.start_date)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
