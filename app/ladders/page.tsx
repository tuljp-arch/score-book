import { getClassLadder, getNetLadder, getRegionOptions, getClassOptions, GAUGE_OPTIONS } from '@/lib/ladders';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function LaddersPage({
  searchParams,
}: {
  searchParams: { mode?: string; gauge?: string; klass?: string; region?: string };
}) {
  const discipline = 'skeet';
  const mode = searchParams.mode === 'net' ? 'net' : 'class';
  const gauge = searchParams.gauge ?? GAUGE_OPTIONS[0];
  const region = searchParams.region ?? '';
  const klass = searchParams.klass ?? '';

  const [regions, classes] = await Promise.all([getRegionOptions(), getClassOptions(discipline, gauge)]);

  const classRows = mode === 'class' ? await getClassLadder({ discipline, gauge, klass: klass || undefined, region: region || undefined }) : [];
  const netRows = mode === 'net' ? await getNetLadder({ discipline, gauge, region: region || undefined }) : [];

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Opt-in leaderboards</div>
        <h1>Ladders</h1>
        <p>Ranked by class average, or net score across every class — public profiles only.</p>
      </div>
      <div className={ui.wrap}>
        <form method="get" className={ui.card} style={{ marginBottom: 24 }}>
          <label className={ui.label} htmlFor="mode">
            Ranking
          </label>
          <select id="mode" name="mode" defaultValue={mode} className={ui.select}>
            <option value="class">By class average</option>
            <option value="net">Net (all classes)</option>
          </select>

          <label className={ui.label} htmlFor="gauge">
            Gauge
          </label>
          <select id="gauge" name="gauge" defaultValue={gauge} className={ui.select}>
            {GAUGE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {mode === 'class' && (
            <>
              <label className={ui.label} htmlFor="klass">
                Class
              </label>
              <select id="klass" name="klass" defaultValue={klass} className={ui.select}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className={ui.label} htmlFor="region">
            Region
          </label>
          <select id="region" name="region" defaultValue={region} className={ui.select}>
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button type="submit" className={ui.button}>
            Apply
          </button>
        </form>

        {mode === 'class' ? (
          classRows.length === 0 ? (
            <div className={ui.emptyState}>No shooters match these filters.</div>
          ) : (
            <div className={ui.listCard}>
              {classRows.map((r, i) => (
                <a key={r.shooterId} href={`/profile/${r.shooterId}`} className={ui.listRow}>
                  <span className={ui.listRowTitle}>
                    {i + 1}. {r.shooterName}
                  </span>
                  <span className={ui.listRowMeta}>
                    Class {r.klass} · {(r.average * 100).toFixed(2)}% {r.region ? `· ${r.region}` : ''}
                  </span>
                </a>
              ))}
            </div>
          )
        ) : netRows.length === 0 ? (
          <div className={ui.emptyState}>No shooters match these filters.</div>
        ) : (
          <div className={ui.listCard}>
            {netRows.map((r, i) => (
              <a key={r.shooterId} href={`/profile/${r.shooterId}`} className={ui.listRow}>
                <span className={ui.listRowTitle}>
                  {i + 1}. {r.shooterName}
                </span>
                <span className={ui.listRowMeta}>
                  HC {r.handicap.toFixed(1)}
                  {r.isProvisional ? '*' : ''} {r.region ? `· ${r.region}` : ''}
                </span>
              </a>
            ))}
          </div>
        )}
        {mode === 'net' && netRows.some((r) => r.isProvisional) && (
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>*provisional — fewer than 10 rounds</div>
        )}
      </div>
    </div>
  );
}
