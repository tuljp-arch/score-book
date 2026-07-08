import { getShooterOptions } from '@/lib/head-to-head';
import ui from '@/components/ui.module.css';
import { goToHeadToHead } from './actions';

export const dynamic = 'force-dynamic';

export default async function HeadToHeadPickerPage({ searchParams }: { searchParams: { error?: string } }) {
  const shooters = await getShooterOptions();

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Settle it</div>
        <h1>Head-to-head</h1>
        <p>Pick two shooters to see every event where both appear, scores side by side.</p>
      </div>
      <div className={ui.wrap}>
        <div className={ui.card}>
          {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}
          <form action={goToHeadToHead}>
            <label className={ui.label} htmlFor="shooterA">
              Shooter A
            </label>
            <select id="shooterA" name="shooterA" required className={ui.select}>
              <option value="">Select a shooter…</option>
              {shooters.map((s) => (
                <option key={s.shooter_id} value={s.shooter_id}>
                  {s.full_name}
                </option>
              ))}
            </select>

            <label className={ui.label} htmlFor="shooterB">
              Shooter B
            </label>
            <select id="shooterB" name="shooterB" required className={ui.select}>
              <option value="">Select a shooter…</option>
              {shooters.map((s) => (
                <option key={s.shooter_id} value={s.shooter_id}>
                  {s.full_name}
                </option>
              ))}
            </select>

            <button type="submit" className={ui.button}>
              Compare
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
