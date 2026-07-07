import { createServerClient } from '@/lib/supabase-server';
import { CONCURRENT_CLASS_LABELS, MAIN_CLASS_LETTERS, TEAM_NUMBER_WORDS } from '@/lib/award-codes';

// ---------- Raw row shapes (subset of columns we actually use) ----------

interface ClubRow {
  club_id: string;
  name: string;
  location: string | null;
}

interface EventRow {
  event_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  clubs: ClubRow | null;
}

interface RoundRow {
  round_id: string;
  discipline: string | null;
  gauge: string | null;
  target_count: number | null;
  events: EventRow | null;
}

interface ResultRow {
  result_id: string;
  score: number;
  possible: number;
  award_code: string | null;
  placement_plain_english: string | null;
  rounds: RoundRow | null;
}

interface ClassificationRow {
  discipline: string;
  gauge: string;
  class: string;
  five_event_average: number | null;
}

interface TeamResultRow {
  team_result_id: string;
  event_id: string;
  shooter_ids: string[];
  placement: string | null;
  notes: string | null;
}

// ---------- Shaped output for the page ----------

export interface Medal {
  tier: 1 | 2 | 3;
  iconText: string;
  caption: string;
  eventDate: string;
  // Tier 1 only
  scoreBadge?: string;
  subLabel?: string;
}

export interface TrophyCard {
  featured: boolean;
  iconText: string;
  eventName: string;
  eventDate: string;
  title: string;
  body: string;
  score: number;
  possible: number;
}

export interface GunCase {
  tag: string;
  name: string;
  sub: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
}

export interface TrendPoint {
  label: string;
  score: number;
  x: number;
  y: number;
  accent: boolean;
  labelAbove: boolean;
}

export interface ProfileData {
  fullName: string;
  monogram: string;
  nssaNumber: string | null;
  memberSince: string | null;
  season: string;
  clubName: string | null;
  clubLocation: string | null;
  classBadges: { gauge: string; klass: string }[];
  medals: Medal[];
  statStrip: { num: string; label: string }[];
  trophyShelf: TrophyCard[];
  gunCases: GunCase[];
  trend: { title: string; rangeLabel: string; points: TrendPoint[] } | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function monthYear(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Chart axis labels have little room — strip the parenthetical/qualifier
// noise that full event names carry (e.g. "Spring Open (2026)" -> "Spring Open").
function shortEventLabel(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').replace(/\s*-\s*.*$/, '').trim().toUpperCase();
}

function monogramOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

function eventDateOf(result: ResultRow): string {
  return result.rounds?.events?.start_date ?? '';
}

// Multi-day events (e.g. North Atlantic, 05/15-05/17) should display the
// closing date, since that's when the final placement was decided.
function eventDisplayDateOf(result: ResultRow): string {
  const event = result.rounds?.events;
  return event?.end_date ?? event?.start_date ?? '';
}

export async function getProfileData(shooterId: string): Promise<ProfileData | null> {
  const supabase = createServerClient();

  const { data: shooter } = await supabase
    .from('shooters')
    .select('*, home_club:clubs(club_id, name, location)')
    .eq('shooter_id', shooterId)
    .single();

  if (!shooter) return null;

  const { data: classifications } = await supabase
    .from('classifications')
    .select('discipline, gauge, class, five_event_average')
    .eq('shooter_id', shooterId);

  const { data: results } = await supabase
    .from('results')
    .select(
      `result_id, score, possible, award_code, placement_plain_english,
       rounds ( round_id, discipline, gauge, target_count,
         events ( event_id, name, start_date, end_date, clubs ( club_id, name, location ) ) )`
    )
    .eq('shooter_id', shooterId);

  const { data: teamResults } = await supabase
    .from('team_results')
    .select('team_result_id, event_id, shooter_ids, placement, notes')
    .contains('shooter_ids', [shooterId]);

  const allResults = (results ?? []) as unknown as ResultRow[];
  const classificationRows = (classifications ?? []) as ClassificationRow[];
  const teamResultRows = (teamResults ?? []) as TeamResultRow[];

  // Look up teammates' names for team-championship captions.
  const teammateIds = Array.from(
    new Set(teamResultRows.flatMap((t) => t.shooter_ids).filter((id) => id !== shooterId))
  );
  let teammateNames: Record<string, string> = {};
  if (teammateIds.length > 0) {
    const { data: teammates } = await supabase
      .from('shooters')
      .select('shooter_id, full_name')
      .in('shooter_id', teammateIds);
    teammateNames = Object.fromEntries((teammates ?? []).map((s) => [s.shooter_id, s.full_name]));
  }
  const teamResultsByEvent = Object.fromEntries(teamResultRows.map((t) => [t.event_id, t]));

  // ---------- Medals ----------

  const medals: Medal[] = [];
  const tier3Groups: Record<string, { events: string[] }> = {};
  const tier1RoundIds = new Set<string>();

  for (const result of allResults) {
    const text = result.placement_plain_english ?? '';
    const outscoredMatch = /outscored[^.]*/i.exec(text);
    if (outscoredMatch) {
      tier1RoundIds.add(result.rounds?.round_id ?? result.result_id);
      const opponentScore = /\((\d+)\)/.exec(text)?.[1];
      const caption = outscoredMatch[0].replace(/^outscored/i, 'Outscored');
      medals.push({
        tier: 1,
        iconText: opponentScore ? `${result.score}–${opponentScore}` : `${result.score}`,
        caption,
        eventDate: eventDateOf(result),
        scoreBadge: opponentScore ? `${result.score}–${opponentScore}` : `${result.score}`,
        subLabel: /world/i.test(text) ? 'VS. WORLD CH.' : 'HEAD-TO-HEAD',
      });
    }
  }

  for (const result of allResults) {
    const tokens = (result.award_code ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const isTier1Round = tier1RoundIds.has(result.rounds?.round_id ?? result.result_id);

    for (const token of tokens) {
      if (/CH$/.test(token) && !/^\d+MRU$/.test(token)) {
        const teamMatch = /^(\d+)M(CH)$/.exec(token);
        if (teamMatch) {
          const n = Number(teamMatch[1]);
          const label = TEAM_NUMBER_WORDS[n] ?? `${n}`;
          const eventId = result.rounds?.events?.event_id;
          const team = eventId ? teamResultsByEvent[eventId] : undefined;
          const others = team?.shooter_ids
            .filter((id) => id !== shooterId)
            .map((id) => teammateNames[id])
            .filter(Boolean);
          medals.push({
            tier: 2,
            iconText: `${n}M`,
            caption:
              others && others.length > 0
                ? `${label}-Man Championship, with ${others.join(' & ')}`
                : `${label}-Man Championship`,
            eventDate: eventDateOf(result),
          });
          continue;
        }

        const prefix = token.slice(0, -2);
        const label = CONCURRENT_CLASS_LABELS[prefix] ?? prefix;
        medals.push({
          tier: 2,
          iconText: prefix,
          caption: `${label} Class Champion`,
          eventDate: eventDateOf(result),
        });
        continue;
      }

      const classMatch = /^(AA|A|B|C|D|E|M)1$/.exec(token);
      if (classMatch && !isTier1Round) {
        const letter = classMatch[1];
        const eventName = result.rounds?.events?.name ?? '';
        if (!tier3Groups[letter]) tier3Groups[letter] = { events: [] };
        if (eventName) tier3Groups[letter].events.push(eventName);
      }
    }
  }

  for (const [letter, group] of Object.entries(tier3Groups)) {
    medals.push({
      tier: 3,
      iconText: group.events.length > 1 ? `${letter}×${group.events.length}` : letter,
      caption: `Class ${letter} — ${group.events.join(' & ')}`,
      eventDate: '',
    });
  }

  // Within a tier, surface medals from the same event as the tier-1 feature
  // first (keeps the North Atlantic sweep visually grouped), then most
  // recent first.
  const tier1Dates = new Set(medals.filter((m) => m.tier === 1).map((m) => m.eventDate));
  medals.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aGrouped = tier1Dates.has(a.eventDate);
    const bGrouped = tier1Dates.has(b.eventDate);
    if (aGrouped !== bGrouped) return aGrouped ? -1 : 1;
    return b.eventDate.localeCompare(a.eventDate);
  });

  const seasonYear =
    allResults
      .map((r) => eventDateOf(r))
      .filter(Boolean)
      .sort()
      .pop()
      ?.slice(0, 4) ?? new Date().getFullYear().toString();

  // ---------- Stat strip ----------

  const byGauge: Record<string, ResultRow[]> = {};
  for (const r of allResults) {
    const gauge = r.rounds?.gauge ?? 'unknown';
    (byGauge[gauge] ??= []).push(r);
  }
  const primaryGauge =
    Object.entries(byGauge).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null;
  const primaryResults = primaryGauge ? byGauge[primaryGauge] : [];

  const seasonScore = primaryResults.reduce((sum, r) => sum + r.score, 0);
  const seasonPossible = primaryResults.reduce((sum, r) => sum + r.possible, 0);
  const careerHigh = primaryResults.reduce((max, r) => Math.max(max, r.score), 0);
  const distinctEvents = new Set(allResults.map((r) => r.rounds?.events?.event_id).filter(Boolean));
  const championshipWins = medals.filter((m) => m.tier === 1 || m.tier === 2).length;

  const statStrip = [
    { num: `${seasonScore}/${seasonPossible}`, label: `${primaryGauge}, season to date` },
    { num: `${careerHigh}`, label: `career high (${primaryGauge})` },
    { num: `${distinctEvents.size}`, label: 'registered events shot' },
    { num: `${championshipWins}`, label: 'class / championship wins' },
  ];

  // ---------- Trophy shelf ----------

  const medalWorthyRoundIds = new Set<string>(tier1RoundIds);
  for (const result of allResults) {
    const tokens = (result.award_code ?? '').split(',').map((t) => t.trim());
    const hasChampionship = tokens.some((t) => /CH$/.test(t));
    const hasClassWin = tokens.some((t) => MAIN_CLASS_LETTERS.some((l) => t === `${l}1`));
    if (hasChampionship || hasClassWin) {
      medalWorthyRoundIds.add(result.rounds?.round_id ?? result.result_id);
    }
  }

  const shelfCandidates = allResults.filter((r) =>
    medalWorthyRoundIds.has(r.rounds?.round_id ?? r.result_id)
  );
  shelfCandidates.sort((a, b) => eventDateOf(a).localeCompare(eventDateOf(b)));

  const featuredResult = allResults.find((r) =>
    tier1RoundIds.has(r.rounds?.round_id ?? r.result_id)
  );
  const rest = shelfCandidates.filter((r) => r !== featuredResult).slice(0, 3);
  const shelfResults = featuredResult ? [featuredResult, ...rest] : shelfCandidates.slice(0, 4);

  const trophyShelf: TrophyCard[] = shelfResults.map((r) => {
    const tokens = (r.award_code ?? '').split(',').map((t) => t.trim());
    const isFeatured = r === featuredResult;
    const teamToken = tokens.find((t) => /^\d+MCH$/.test(t));
    const classToken = tokens.find((t) => MAIN_CLASS_LETTERS.some((l) => t === `${l}1`));

    let iconText = String(r.score);
    let title = r.placement_plain_english ?? '';
    let body = r.placement_plain_english ?? '';

    if (isFeatured) {
      const titleParts = tokens
        .map((t) => {
          const classMatch = /^(AA|A|B|C|D|E|M)1$/.exec(t);
          if (classMatch) return `Class ${classMatch[1]} Champion`;
          const chMatch = /^(?!\d)([A-Z]+)CH$/.exec(t);
          if (chMatch) return `${CONCURRENT_CLASS_LABELS[chMatch[1]] ?? chMatch[1]} Champion`;
          return null;
        })
        .filter((v): v is string => Boolean(v));
      title = titleParts.length > 0 ? titleParts.join(', ') : title;

      const outscoredMatch = /outscored[^.]*/i.exec(r.placement_plain_english ?? '');
      const opponentScore = outscoredMatch ? /\((\d+)\)/.exec(outscoredMatch[0])?.[1] : undefined;
      body = outscoredMatch
        ? `${outscoredMatch[0].replace(/^outscored/i, 'Outscored').replace(/\s*\(\d+\)$/, '')}${
            opponentScore ? `, ${r.score}–${opponentScore}` : ''
          }.`
        : body;
    } else if (teamToken) {
      iconText = teamToken.replace('CH', '');
      title = 'Two-Man Championship';
    } else if (classToken) {
      iconText = classToken.slice(0, -1);
      title = `Class ${iconText}, 1st Place`;
      const gauge = r.rounds?.gauge ? r.rounds.gauge.replace(/ga$/, ' gauge') : '';
      body = [gauge, r.rounds?.target_count ? `${r.rounds.target_count} targets` : '']
        .filter(Boolean)
        .join(', ') + '.';
    }

    const eventId = r.rounds?.events?.event_id;
    const team = eventId ? teamResultsByEvent[eventId] : undefined;
    if (teamToken && team?.notes) body = team.notes;

    return {
      featured: isFeatured,
      iconText,
      eventName: `${r.rounds?.events?.name ?? ''} · ${formatDate(eventDisplayDateOf(r))}`,
      eventDate: eventDateOf(r),
      title,
      body,
      score: r.score,
      possible: r.possible,
    };
  });

  // ---------- Gun cabinet ----------

  const gunCases: GunCase[] = [];
  if (shooter.gear_gun_make && shooter.gear_gun_model) {
    const segments = shooter.gear_gun_model.split(',').map((s: string) => s.trim());
    for (const segment of segments) {
      const match = /^(.*)\s\((.*)\)$/.exec(segment);
      const model = match ? match[1] : segment;
      const tagRaw = match ? match[2] : 'primary';
      const tag = tagRaw.charAt(0).toUpperCase() + tagRaw.slice(1);
      const isCompetition = /competition/i.test(tagRaw);

      gunCases.push({
        tag,
        name: `${shooter.gear_gun_make} ${model}`,
        sub: isCompetition ? `Primary competition gun, ${seasonYear} season` : `${tag} gun`,
        stat1Value: isCompetition ? `${seasonScore}/${seasonPossible}` : '—',
        stat1Label: isCompetition ? 'events shot with' : 'field days logged',
        stat2Value: isCompetition ? `${careerHigh}` : '—',
        stat2Label: isCompetition ? 'best score with' : 'add a season',
      });
    }
  }

  // ---------- Trend chart ----------

  let trend: ProfileData['trend'] = null;
  if (primaryGauge && primaryResults.length > 0) {
    const sorted = [...primaryResults].sort((a, b) => eventDateOf(a).localeCompare(eventDateOf(b)));
    const scores = sorted.map((r) => r.score);
    const yMax = 100;
    const yMin = Math.floor((Math.min(...scores) - 1) / 5) * 5;
    const maxScore = Math.max(...scores);

    const xStart = 100;
    const xEnd = 820;
    const n = sorted.length;
    const points: TrendPoint[] = sorted.map((r, i) => {
      const x = n > 1 ? xStart + (i * (xEnd - xStart)) / (n - 1) : (xStart + xEnd) / 2;
      const y = 180 - ((r.score - yMin) / (yMax - yMin)) * 160;
      return {
        label: shortEventLabel(r.rounds?.events?.name ?? ''),
        score: r.score,
        x,
        y,
        accent: r.score === maxScore,
        labelAbove: y > 100,
      };
    });

    trend = {
      title: `${primaryGauge} score trend, ${seasonYear} season`,
      rangeLabel: `${yMin}–${yMax} shown`,
      points,
    };
  }

  const classBadges = [...classificationRows].sort((a, b) => parseInt(a.gauge) - parseInt(b.gauge));

  return {
    fullName: shooter.full_name,
    monogram: monogramOf(shooter.full_name),
    nssaNumber: shooter.nssa_nsca_number,
    memberSince: monthYear(shooter.joined_at),
    season: `${seasonYear} Season`,
    clubName: shooter.home_club?.name ?? null,
    clubLocation: shooter.home_club?.location ?? null,
    classBadges: classBadges.map((c) => ({ gauge: c.gauge, klass: c.class })),
    medals,
    statStrip,
    trophyShelf,
    gunCases,
    trend,
  };
}
