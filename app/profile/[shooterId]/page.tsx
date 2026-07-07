import { getProfileData } from '@/lib/profile-data';
import styles from './profile.module.css';
import { FeatureMedalSvg, Tier2MedalSvg, Tier3MedalSvg, GunSilhouetteSvg } from './medals';

// This page reflects whatever a shooter's most recent NSSA import (or an
// admin's manual edits) wrote to Supabase — it must never serve a cached
// render, or a re-imported profile keeps showing stale results.
export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { shooterId: string } }) {
  const profile = await getProfileData(params.shooterId);

  if (!profile) {
    return (
      <main className={styles.notFound}>
        <p>No shooter found for id {params.shooterId}. Seed the database first — see /supabase/schema.sql and seed_data_v2/.</p>
      </main>
    );
  }

  let tier2Index = 0;

  return (
    <div className={styles.page}>
      <header className={styles.profileHead}>
        <div className={styles.headInner}>
          <div className={styles.monogram}>{profile.monogram}</div>
          <div className={styles.headNameBlock}>
            <div className={styles.clubEyebrow}>
              {profile.clubName}
              {profile.clubLocation ? ` · ${profile.clubLocation}` : ''}
            </div>
            <h1>{profile.fullName}</h1>
            <div className={styles.headMeta}>
              {profile.nssaNumber && <span>NSSA #{profile.nssaNumber}</span>}
              {profile.memberSince && <span>Member since {profile.memberSince}</span>}
              <span>{profile.season}</span>
            </div>

            <div className={styles.medalsRow}>
              {profile.medals.map((medal, i) => {
                if (medal.tier === 1) {
                  return (
                    <div key={i} className={`${styles.medalUnit} ${styles.feature}`}>
                      <div className={styles.shine} />
                      <FeatureMedalSvg scoreBadge={medal.scoreBadge ?? ''} subLabel={medal.subLabel ?? ''} />
                      <div className={styles.medalCaption}>{medal.caption}</div>
                    </div>
                  );
                }
                if (medal.tier === 2) {
                  const ribbon = tier2Index % 2 === 0 ? 'clay' : 'field';
                  tier2Index += 1;
                  return (
                    <div key={i} className={styles.medalUnit}>
                      <Tier2MedalSvg iconText={medal.iconText} ribbon={ribbon} />
                      <div className={styles.medalCaption}>{medal.caption}</div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`${styles.medalUnit} ${styles.tier3}`}>
                    <Tier3MedalSvg iconText={medal.iconText} />
                    <div className={styles.medalCaption}>{medal.caption}</div>
                  </div>
                );
              })}
            </div>

            {profile.gunCases.length > 0 && (
              <div className={styles.topGunsRow}>
                {profile.gunCases.map((gun, i) => (
                  <div key={i} className={styles.gunChip}>
                    <div className={styles.chipIcon}>
                      <GunSilhouetteSvg />
                    </div>
                    <div>
                      <div className={styles.chipEyebrow}>{gun.tag}</div>
                      <div className={styles.chipName}>{gun.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.classBadges}>
            {profile.classBadges.map((b, i) => (
              <div key={i} className={styles.badge}>
                {b.gauge} <b>Class {b.klass}</b>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.statStrip}>
          {profile.statStrip.map((s, i) => (
            <div key={i} className={styles.statCell}>
              <div className={styles.statNum}>{s.num}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {profile.trophyShelf.length > 0 && (
        <section className={styles.shelfSection}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>The trophy shelf</div>
            <h2>What the season has earned so far.</h2>
            <div className={styles.shelf}>
              {profile.trophyShelf.map((card, i) => (
                <div key={i} className={`${styles.trophyCard} ${card.featured ? styles.featured : ''}`}>
                  <div className={styles.trophyIcon}>{card.iconText}</div>
                  <div className={styles.eventName}>{card.eventName}</div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <div className={styles.trophyScore}>
                    {card.score}
                    <span>/ {card.possible}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {profile.gunCases.length > 0 && (
        <section className={styles.gearSection}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>The cabinet, in full</div>
            <h2>Every gun&apos;s own record.</h2>
            <div className={styles.cabinet}>
              {profile.gunCases.map((gun, i) => (
                <div key={i} className={styles.gunCase}>
                  <div className={styles.gunPhotoFrame}>
                    <span className={styles.photoTag}>PHOTO — REPLACE</span>
                    <GunSilhouetteSvg />
                  </div>
                  <div className={styles.gunEyebrow}>{gun.tag}</div>
                  <h3>{gun.name}</h3>
                  <div className={styles.gunSub}>{gun.sub}</div>
                  <div className={styles.gunStats}>
                    <div>
                      <b>{gun.stat1Value}</b>
                      {gun.stat1Label}
                    </div>
                    <div>
                      <b>{gun.stat2Value}</b>
                      {gun.stat2Label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {profile.trend && (
        <section className={styles.trendSection}>
          <div className={styles.wrap}>
            <div className={styles.trendCard}>
              <div className={styles.trendTop}>
                <div className={styles.trendTitle}>{profile.trend.title}</div>
                <div className={styles.trendRange}>{profile.trend.rangeLabel}</div>
              </div>
              <div className={styles.trendChart}>
                <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid meet">
                  <line x1="60" y1="20" x2="60" y2="180" stroke="rgba(34,40,28,0.12)" strokeWidth="1" />
                  <line x1="60" y1="180" x2="860" y2="180" stroke="rgba(34,40,28,0.12)" strokeWidth="1" />

                  <polyline
                    points={profile.trend.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#BD5A2C"
                    strokeWidth="2.5"
                  />

                  {profile.trend.points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="5" fill={p.accent ? '#BD5A2C' : '#37402E'} />
                  ))}

                  {profile.trend.points.map((p, i) => (
                    <text
                      key={i}
                      x={p.x}
                      y={p.labelAbove ? p.y - 16 : p.y + 22}
                      textAnchor="middle"
                      className={styles.trendScoreLabel}
                    >
                      {p.score}
                    </text>
                  ))}

                  {profile.trend.points.map((p, i) => (
                    <text key={i} x={p.x} y={204} textAnchor="middle" className={styles.trendLabel}>
                      {p.label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className={styles.footer}>The Score Book — a New England Sporting Life project.</footer>
    </div>
  );
}
