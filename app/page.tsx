import ui from '@/components/ui.module.css';
import styles from './home.module.css';

export default function Home() {
  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Skeet · Trap · Sporting Clays</div>
        <h1>The Score Book</h1>
        <p>
          Your competitive record, kept like it actually matters — scores, classifications, and
          every trophy you&apos;ve earned, in one place.
        </p>
      </div>
      <div className={ui.wrap}>
        <div className={styles.cards}>
          <a href="/connect" className={styles.linkCard}>
            <div className={styles.eyebrow}>Get started</div>
            <h3>Connect your account</h3>
            <p>Link your NSSA member number and pull in your real shoot history.</p>
          </a>
          <a href="/events" className={styles.linkCard}>
            <div className={styles.eyebrow}>Browse</div>
            <h3>Event leaderboards</h3>
            <p>See every shooter&apos;s score for a registered event, gauge by gauge.</p>
          </a>
          <a href="/head-to-head" className={styles.linkCard}>
            <div className={styles.eyebrow}>Compare</div>
            <h3>Head-to-head</h3>
            <p>Pick two shooters and see every round where both appear, side by side.</p>
          </a>
        </div>
      </div>
    </div>
  );
}
