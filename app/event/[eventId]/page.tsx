import { getEventLeaderboard } from '@/lib/event-leaderboard';
import styles from './leaderboard.module.css';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function dateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default async function EventLeaderboardPage({ params }: { params: { eventId: string } }) {
  const data = await getEventLeaderboard(params.eventId);

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.empty}>Couldn&apos;t find that event.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div className={styles.eyebrow}>
            {data.clubName}
            {data.clubLocation ? ` · ${data.clubLocation}` : ''}
          </div>
          <h1>{data.eventName}</h1>
          <div className={styles.meta}>{dateRange(data.startDate, data.endDate)}</div>
        </div>

        {data.rounds.length === 0 ? (
          <div className={styles.empty}>No results recorded for this event yet.</div>
        ) : (
          data.rounds.map((round) => (
            <div key={round.roundId}>
              <div className={styles.sectionHead}>
                {round.gauge} · {round.entries.length} shooter{round.entries.length === 1 ? '' : 's'}
              </div>
              <div className={styles.table}>
                {round.entries.map((entry, i) => (
                  <div key={entry.shooterId} className={styles.row}>
                    <div className={styles.rank}>{i + 1}</div>
                    <div className={styles.name}>
                      <a href={`/profile/${entry.shooterId}`}>{entry.shooterName}</a>
                    </div>
                    <div className={styles.award}>{entry.awardCode ?? ''}</div>
                    <div className={styles.score}>
                      {entry.score}
                      <span>/{entry.possible}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
