import { getShooterOptions } from '@/lib/head-to-head';
import { goToHeadToHead } from './actions';

export const dynamic = 'force-dynamic';

export default async function HeadToHeadPickerPage({ searchParams }: { searchParams: { error?: string } }) {
  const shooters = await getShooterOptions();

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 480, margin: '0 auto' }}>
      <h1>Head-to-head</h1>
      <p>Pick two shooters to see every event where both appear, scores side by side.</p>
      {searchParams.error && <p style={{ color: 'crimson' }}>{searchParams.error}</p>}
      <form action={goToHeadToHead}>
        <label style={{ display: 'block', marginBottom: 4 }}>Shooter A</label>
        <select name="shooterA" required style={{ padding: 8, fontSize: 16, width: '100%', marginBottom: 12 }}>
          <option value="">Select a shooter…</option>
          {shooters.map((s) => (
            <option key={s.shooter_id} value={s.shooter_id}>
              {s.full_name}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 4 }}>Shooter B</label>
        <select name="shooterB" required style={{ padding: 8, fontSize: 16, width: '100%', marginBottom: 12 }}>
          <option value="">Select a shooter…</option>
          {shooters.map((s) => (
            <option key={s.shooter_id} value={s.shooter_id}>
              {s.full_name}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: '8px 16px', fontSize: 16 }}>
          Compare
        </button>
      </form>
    </main>
  );
}
