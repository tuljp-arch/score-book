import { getEventOptions } from '@/lib/event-leaderboard';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export default async function EventsPage() {
  const events = await getEventOptions();

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 560, margin: '0 auto' }}>
      <h1>Events</h1>
      <p>Every registered event with results on the books.</p>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {events.map((e) => (
            <li key={e.event_id} style={{ padding: '10px 0', borderBottom: '1px solid #ddd' }}>
              <a href={`/event/${e.event_id}`}>{e.name}</a>
              <span style={{ color: '#666', marginLeft: 8 }}>{formatDate(e.start_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
