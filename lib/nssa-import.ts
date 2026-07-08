import * as cheerio from 'cheerio';
import { createServerClient } from '@/lib/supabase-server';
import { describeAwardCode, TEAM_NUMBER_WORDS } from '@/lib/award-codes';
import { recalculateHandicaps } from '@/lib/handicap';

// Imports one shooter's history from NSSA's public /Lookups/ pages
// (mynssa.nssa-nsca.org) into our schema. These pages require no login —
// verified by fetching them with zero cookies — so this only ever needs a
// member number, not a password. See CLAUDE_CODE_PROJECT_BRIEF.md for why
// we still gate this behind a shooter typing in *their own* number rather
// than exposing an open lookup: NSSA doesn't enforce that boundary, we do.
// Enforced two ways: /connect requires a logged-in account (see
// app/connect/actions.ts), and a given NSSA number, once claimed by a
// user_id, can't be re-imported by a different account.
//
// Known limitations (not built yet, deliberately out of scope for v1):
// - Year lookback is bounded (current year + up to 5 prior, stopping early
//   after 3 consecutive empty years) rather than scanning all the way back
//   to NSSA's earliest records (2001 in the year dropdown). This is a
//   deliberate ceiling, not an oversight: each extra year can mean many
//   sequential requests to NSSA's slow legacy PHP server, and this import
//   runs inside a Vercel serverless function with a real execution time
//   limit — an unbounded scan risks timing out mid-import.
// - Doubles-gauge awards aren't fetched (no confirmed combobox label seen
//   yet for doubles entries).

const BASE = 'https://mynssa.nssa-nsca.org';
const MAX_PRIOR_YEARS = 5;
const MAX_CONSECUTIVE_EMPTY_YEARS = 3;

const GAUGE_LABEL_PATTERNS: Record<string, RegExp> = {
  '12ga': /12 Gauge/i,
  '20ga': /20 Gauge/i,
  '28ga': /28 Gauge/i,
  '410': /\.410 Bore/i,
};

interface HistoryClassification {
  gauge: string;
  average: number;
  klass: string;
}

interface HistoryRow {
  shootId: string;
  date: string; // MM/DD/YYYY as shown on the page
  shootName: string;
  scores: Record<string, { score: number; possible: number }>;
}

interface MemberHistoryPage {
  fullName: string;
  classifications: HistoryClassification[];
  rows: HistoryRow[];
  currentYear: string | null;
  availableYears: string[];
}

interface MemberHistory {
  fullName: string;
  classifications: HistoryClassification[];
  rows: HistoryRow[];
}

async function fetchText(url: string, body?: URLSearchParams): Promise<string> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    body,
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
  });
  if (!res.ok) throw new Error(`NSSA request failed (${res.status}): ${url}`);
  return res.text();
}

function titleCase(lastCommaFirst: string): string {
  const [last, first] = lastCommaFirst.split(',').map((s) => s.trim());
  const cap = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${cap(first)} ${cap(last)}`;
}

function titleCaseWords(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUsDate(iso: string | null): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${mm}/${dd}/${yyyy}`;
}

async function fetchMemberHistoryPage(memberId: string, year?: string): Promise<MemberHistoryPage> {
  // Switching years is a POST against the base URL (the page's own `chgyr`
  // form posts `id` + `year`) — a GET query param like `?y=2024` is
  // silently ignored by the server, which just returns the current year
  // again. Confirmed by comparing both against real data: the GET form
  // always came back "Shoot Year 2026" regardless of the year requested.
  const url = `${BASE}/Lookups/NSSA_Member_History.php`;
  const html = year
    ? await fetchText(url, new URLSearchParams({ id: memberId, year }))
    : await fetchText(`${url}?id=${memberId}`);
  const $ = cheerio.load(html);

  const headerText = $('b').first().text();
  const nameMatch = /-\s*([A-Z\s]+,\s*[A-Z\s]+?)\s*\[/.exec(headerText);
  if (!nameMatch) throw new Error(`Could not find member ${memberId} — check the number and try again.`);
  const fullName = titleCase(nameMatch[1]);

  const classifications: HistoryClassification[] = [];
  $('table[style*="border-width:2px"]').each((_, el) => {
    const cells = $(el)
      .find('tr')
      .slice(1) // first match is the outer wrapper row, real rows follow
      .map((__, tr) => $(tr).find('td').first().text().trim())
      .get();
    const [gaugeLabel, average, klass] = cells;
    if (!gaugeLabel || klass === 'N') return; // "N" = not shot in this discipline/gauge
    // Must match the gauge naming used for rounds/results (see gaugeSlots
    // below) — "410" there, not "410ga", or classifications and results/
    // handicaps for the same gauge silently fail to line up (found via a
    // shooter who actually had a real .410 classification: the handicap
    // engine's key didn't match, so that badge showed no handicap at all).
    const gauge = gaugeLabel === 'Doubles' ? 'doubles' : gaugeLabel === '410' ? '410' : `${gaugeLabel}ga`;
    classifications.push({ gauge, average: parseFloat(average), klass });
  });

  const rows: HistoryRow[] = [];
  const shootTable = $('th:contains("Shoot Name")').closest('table');
  shootTable.find('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 12) return;
    const cellText = (i: number) => $(tds.get(i)).text().trim();
    const shootId = cellText(0);
    if (!/^\d+$/.test(shootId)) return;

    const scores: HistoryRow['scores'] = {};
    const gaugeSlots: [string, number][] = [
      ['12ga', 2],
      ['20ga', 4],
      ['28ga', 6],
      ['410', 8],
      ['doubles', 10],
    ];
    for (const [gauge, idx] of gaugeSlots) {
      const raw = cellText(idx);
      const scoreMatch = /^(\d+)\/(\d+)$/.exec(raw);
      if (scoreMatch) {
        scores[gauge] = { score: Number(scoreMatch[1]), possible: Number(scoreMatch[2]) };
      }
    }

    rows.push({
      shootId,
      date: cellText(1),
      shootName: $(tr).find('a').first().text().trim(),
      scores,
    });
  });

  const yearSelect = $('select[name="year"]');
  const currentYear = yearSelect.find('option[selected]').attr('value') ?? null;
  const availableYears = yearSelect
    .find('option')
    .map((_, o) => $(o).attr('value'))
    .get()
    .filter((v): v is string => Boolean(v));

  return { fullName, classifications, rows, currentYear, availableYears };
}

// Pulls the current season plus a bounded lookback of prior years — see the
// module-level comment for why this isn't an unbounded scan back to 2001.
async function fetchMemberHistory(memberId: string): Promise<MemberHistory> {
  const current = await fetchMemberHistoryPage(memberId);
  const rows = [...current.rows];
  const seenShootIds = new Set(rows.map((r) => r.shootId));

  const priorYears = current.availableYears
    .filter((y) => y !== current.currentYear)
    .slice(0, MAX_PRIOR_YEARS);

  let consecutiveEmpty = 0;
  for (const year of priorYears) {
    if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_YEARS) break;

    const page = await fetchMemberHistoryPage(memberId, year);
    if (page.rows.length === 0) {
      consecutiveEmpty += 1;
      continue;
    }
    consecutiveEmpty = 0;
    for (const r of page.rows) {
      if (!seenShootIds.has(r.shootId)) {
        rows.push(r);
        seenShootIds.add(r.shootId);
      }
    }
  }

  return { fullName: current.fullName, classifications: current.classifications, rows };
}

interface ShootHeader {
  name: string;
  beginDate: string | null;
  endDate: string | null;
  clubNumber: string | null;
  clubName: string | null;
}

async function fetchShootHeader(shootId: string): Promise<ShootHeader> {
  const html = await fetchText(`${BASE}/Lookups/NSSA_Shoot_Details.php?sh=${shootId}`);
  const $ = cheerio.load(html);

  const name = $("td[style*='font-size:20px']").first().text().trim();

  const dateText = (label: string) => {
    const b = $('b').filter((_, el) => $(el).text().trim() === label).first();
    return b.parent().text().replace(label, '').trim() || null;
  };
  const parseUsDate = (s: string | null): string | null => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };

  const clubLink = $("a[href*='nssa-club-details']").first();
  const clubNumber = clubLink.text().trim() || null;
  const clubName = clubLink
    .parent()
    .text()
    .replace('Club:', '')
    .replace(clubNumber ?? '', '')
    .trim() || null;

  return {
    name,
    beginDate: parseUsDate(dateText('Begin Date:')),
    endDate: parseUsDate(dateText('End Date:')),
    clubNumber,
    clubName,
  };
}

async function fetchGaugeOptions(shootId: string): Promise<{ text: string; value: string }[]> {
  const html = await fetchText(`${BASE}/Lookups/NSSA_Shoot_Details.php?sh=${shootId}`);
  const $ = cheerio.load(html);
  return $('select[name="ddlSingleEntries"] option')
    .map((_, o) => ({ text: $(o).text().trim(), value: $(o).attr('value') ?? '' }))
    .get();
}

interface RoundLeaderboardEntry {
  name: string; // as shown by NSSA — all caps, "FIRST LAST"
  awardCode: string | null;
}

// Every shooter's row for one gauge of one shoot — used both to find our
// own award code and (for team awards) to identify who else shares it.
async function fetchRoundLeaderboard(shootId: string, gauge: string): Promise<RoundLeaderboardEntry[]> {
  const pattern = GAUGE_LABEL_PATTERNS[gauge];
  if (!pattern) return [];
  const options = await fetchGaugeOptions(shootId);
  const option = options.find((o) => pattern.test(o.text));
  if (!option) return [];

  const body = new URLSearchParams();
  body.set('ddlSingleEntries', option.value);
  body.set('rbAwards', '0');
  body.set('rbSort', '0');
  body.set('sender', 'Show Results');

  const html = await fetchText(`${BASE}/Lookups/NSSA_Shoot_Details.php?sh=${shootId}`, body);
  const $ = cheerio.load(html);

  const entries: RoundLeaderboardEntry[] = [];
  $('table')
    .find('tr')
    .each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length !== 4) return;
      const cells = tds.map((__, td) => $(td).text().trim()).get();
      if (!/^\d+$/.test(cells[0]) || !/^\d+$/.test(cells[1])) return; // skip header/class-breakdown rows
      entries.push({ name: cells[2].toUpperCase(), awardCode: cells[3] || null });
    });

  return entries;
}

async function findShooterIdByName(
  supabase: ReturnType<typeof createServerClient>,
  fullName: string
): Promise<string | null> {
  const { data } = await supabase.from('shooters').select('shooter_id').ilike('full_name', fullName).maybeSingle();
  return data?.shooter_id ?? null;
}

// Writes (or upgrades) a team_results row when our shooter's award includes
// a team-championship token like "2MCH". Teammates who aren't yet connected
// get named in `notes` but can't be added to `shooter_ids` — there's no
// shooter row to point at until they connect their own account, at which
// point their own import call upgrades this same row rather than creating
// a duplicate (matched by event_id + the award token in `placement`).
async function recordTeamResultIfApplicable(
  supabase: ReturnType<typeof createServerClient>,
  params: {
    eventId: string;
    eventName: string;
    eventDate: string | null;
    shooterId: string;
    shooterFullName: string;
    leaderboard: RoundLeaderboardEntry[];
    score: number;
    possible: number;
  }
): Promise<void> {
  const { eventId, eventName, eventDate, shooterId, shooterFullName, leaderboard, score, possible } = params;

  const ourEntry = leaderboard.find((e) => e.name === shooterFullName.toUpperCase());
  const ourTokens = (ourEntry?.awardCode ?? '').split(',').map((t) => t.trim());
  const teamToken = ourTokens.find((t) => /^\d+MCH$/.test(t));
  if (!teamToken) return;

  const teammateEntries = leaderboard.filter(
    (e) =>
      e.name !== shooterFullName.toUpperCase() &&
      (e.awardCode ?? '')
        .split(',')
        .map((t) => t.trim())
        .includes(teamToken)
  );

  const teammateNames = teammateEntries.map((e) => titleCaseWords(e.name));
  const teammateIds: string[] = [];
  for (const name of teammateNames) {
    const id = await findShooterIdByName(supabase, name);
    if (id) teammateIds.push(id);
  }

  const n = Number(/^(\d+)MCH$/.exec(teamToken)![1]);
  const label = TEAM_NUMBER_WORDS[n] ?? `${n}`;
  const placement = `${label}-Man Championship (${teamToken})`;
  const allNames = [shooterFullName, ...teammateNames].join(' & ');
  const notes = `${eventName}${eventDate ? `, ${formatUsDate(eventDate)}` : ''} — ${allNames} at ${score}/${possible}`;

  const { data: existing } = await supabase
    .from('team_results')
    .select('team_result_id, shooter_ids')
    .eq('event_id', eventId)
    .ilike('placement', `%${teamToken}%`)
    .maybeSingle();

  if (existing) {
    const merged = Array.from(new Set([...existing.shooter_ids, shooterId, ...teammateIds]));
    if (merged.length !== existing.shooter_ids.length) {
      await supabase.from('team_results').update({ shooter_ids: merged }).eq('team_result_id', existing.team_result_id);
    }
    return;
  }

  await supabase.from('team_results').insert({
    event_id: eventId,
    shooter_ids: Array.from(new Set([shooterId, ...teammateIds])),
    placement,
    notes,
  });
}

async function findOrCreateClub(
  supabase: ReturnType<typeof createServerClient>,
  clubNumber: string | null,
  clubName: string | null
): Promise<string | null> {
  if (!clubNumber || !clubName) return null;
  const { data: existing } = await supabase
    .from('clubs')
    .select('club_id')
    .eq('nssa_club_number', clubNumber)
    .maybeSingle();
  if (existing) return existing.club_id;

  const { data: created, error } = await supabase
    .from('clubs')
    .insert({ name: clubName, nssa_club_number: clubNumber, affiliation: 'NSSA' })
    .select('club_id')
    .single();
  if (error) throw error;
  return created.club_id;
}

async function findOrCreateEvent(
  supabase: ReturnType<typeof createServerClient>,
  shootId: string,
  header: ShootHeader,
  clubId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from('events')
    .select('event_id')
    .eq('source_event_id', shootId)
    .eq('registration_source', 'nssa_official')
    .maybeSingle();
  if (existing) return existing.event_id;

  const { data: created, error } = await supabase
    .from('events')
    .insert({
      name: header.name,
      club_id: clubId,
      start_date: header.beginDate,
      end_date: header.endDate,
      discipline: 'skeet',
      tier: 'club/regional',
      registration_source: 'nssa_official',
      source_event_id: shootId,
    })
    .select('event_id')
    .single();
  if (error) throw error;
  return created.event_id;
}

async function findOrCreateRound(
  supabase: ReturnType<typeof createServerClient>,
  eventId: string,
  gauge: string,
  possible: number
): Promise<string> {
  const { data: existing } = await supabase
    .from('rounds')
    .select('round_id')
    .eq('event_id', eventId)
    .eq('gauge', gauge)
    .eq('discipline', 'skeet')
    .maybeSingle();
  if (existing) return existing.round_id;

  const { data: created, error } = await supabase
    .from('rounds')
    .insert({ event_id: eventId, discipline: 'skeet', gauge, target_count: possible })
    .select('round_id')
    .single();
  if (error) throw error;
  return created.round_id;
}

export interface ImportSummary {
  shooterId: string;
  fullName: string;
  eventsImported: number;
  resultsImported: number;
}

export async function importShooterFromNssa(memberId: string, userId: string): Promise<ImportSummary> {
  const supabase = createServerClient();

  const { data: existingShooter } = await supabase
    .from('shooters')
    .select('user_id')
    .eq('nssa_nsca_number', memberId)
    .maybeSingle();
  if (existingShooter?.user_id && existingShooter.user_id !== userId) {
    throw new Error('This NSSA number is already connected to another account.');
  }

  const history = await fetchMemberHistory(memberId);

  const { data: shooter, error: shooterError } = await supabase
    .from('shooters')
    .upsert(
      { nssa_nsca_number: memberId, full_name: history.fullName, user_id: userId },
      { onConflict: 'nssa_nsca_number' }
    )
    .select('shooter_id')
    .single();
  if (shooterError) throw shooterError;
  const shooterId = shooter.shooter_id as string;

  await supabase.from('classifications').delete().eq('shooter_id', shooterId).eq('discipline', 'skeet');
  if (history.classifications.length > 0) {
    const { error } = await supabase.from('classifications').insert(
      history.classifications.map((c) => ({
        shooter_id: shooterId,
        discipline: 'skeet',
        gauge: c.gauge,
        class: c.klass,
        effective_date: new Date().toISOString().slice(0, 10),
        five_event_average: c.average,
      }))
    );
    if (error) throw error;
  }

  let resultsImported = 0;
  const eventIds = new Set<string>();

  for (const row of history.rows) {
    const header = await fetchShootHeader(row.shootId);
    const clubId = await findOrCreateClub(supabase, header.clubNumber, header.clubName);
    const eventId = await findOrCreateEvent(supabase, row.shootId, header, clubId);
    eventIds.add(eventId);

    for (const [gauge, { score, possible }] of Object.entries(row.scores)) {
      const roundId = await findOrCreateRound(supabase, eventId, gauge, possible);

      const { data: existingResult } = await supabase
        .from('results')
        .select('result_id')
        .eq('shooter_id', shooterId)
        .eq('round_id', roundId)
        .maybeSingle();
      if (existingResult) continue;

      const leaderboard = gauge === 'doubles' ? [] : await fetchRoundLeaderboard(row.shootId, gauge);
      const ourEntry = leaderboard.find((e) => e.name === history.fullName.toUpperCase());
      const awardCode = ourEntry?.awardCode ?? null;

      const { error } = await supabase.from('results').insert({
        shooter_id: shooterId,
        round_id: roundId,
        score,
        possible,
        award_code: awardCode,
        placement_plain_english: describeAwardCode(awardCode),
      });
      if (error) throw error;
      resultsImported += 1;

      if (awardCode) {
        await recordTeamResultIfApplicable(supabase, {
          eventId,
          eventName: header.name,
          eventDate: header.endDate ?? header.beginDate,
          shooterId,
          shooterFullName: history.fullName,
          leaderboard,
          score,
          possible,
        });
      }
    }
  }

  await recalculateHandicaps(shooterId);

  return {
    shooterId,
    fullName: history.fullName,
    eventsImported: eventIds.size,
    resultsImported,
  };
}
