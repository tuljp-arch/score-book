import { getHeadToHeadData } from '@/lib/head-to-head';
import styles from './h2h.module.css';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export default async function HeadToHeadPage({
  params,
}: {
  params: { shooterA: string; shooterB: string };
}) {
  const data = await getHeadToHeadData(params.shooterA, params.shooterB);

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.empty}>Couldn&apos;t find one or both shooters.</div>
        </div>
      </div>
    );
  }

  const { shooterA, shooterB, rows, record, netRecord } = data;
  const anyNetProvisional = rows.some((r) => r.netWinner !== null && r.netProvisional);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div className={styles.matchup}>
            <span>{shooterA.name}</span>
            <span className={styles.vs}>vs</span>
            <span>{shooterB.name}</span>
          </div>
          <div className={styles.record}>
            Gross: {record.aWins}–{record.bWins}
            {record.ties > 0 ? `–${record.ties}` : ''} across {rows.length} shared round
            {rows.length === 1 ? '' : 's'}
          </div>
          {netRecord && (
            <div className={styles.record}>
              Net: {netRecord.aWins}–{netRecord.bWins}
              {netRecord.ties > 0 ? `–${netRecord.ties}` : ''}
              {anyNetProvisional ? ' (some handicaps still provisional)' : ''}
            </div>
          )}
        </div>

        <div className={styles.sectionHead}>
          Every shared round — gross, and net where both have a handicap. Same course spec,
          different day, not a simultaneous match.
        </div>

        {rows.length === 0 ? (
          <div className={styles.empty}>No shared registered events yet.</div>
        ) : (
          <div className={styles.rows}>
            {rows.map((row, i) => (
              <div key={i} className={styles.row}>
                <div className={styles.mainRow}>
                  <div className={styles.eventInfo}>
                    <div className={styles.eventName}>{row.eventName}</div>
                    <div className={styles.eventMeta}>
                      {formatDate(row.eventDate)} · {row.gauge}
                    </div>
                  </div>
                  <div className={`${styles.score} ${row.winner === 'A' ? styles.winner : ''}`}>
                    {row.scoreA}
                    <span>/{row.possibleA}</span>
                  </div>
                  <div className={styles.sep}>–</div>
                  <div className={`${styles.score} ${row.winner === 'B' ? styles.winner : ''}`}>
                    {row.scoreB}
                    <span>/{row.possibleB}</span>
                  </div>
                </div>
                {row.netA !== null && row.netB !== null && (
                  <div className={styles.netRow}>
                    <div className={styles.netLabel}>Net{row.netProvisional ? ' (provisional)' : ''}</div>
                    <div className={`${styles.netScore} ${row.netWinner === 'A' ? styles.winner : ''}`}>
                      {row.netA}
                    </div>
                    <div className={styles.sep}>–</div>
                    <div className={`${styles.netScore} ${row.netWinner === 'B' ? styles.winner : ''}`}>
                      {row.netB}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
