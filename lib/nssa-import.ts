import * as cheerio from 'cheerio';
import { createServerClient } from '@/lib/supabase-server';
import { describeAwardCode } from '@/lib/award-codes';

// Imports one shooter's history from NSSA's public /Lookups/ pages
// (mynssa.nssa-nsca.org) into our schema. These pages require no login —
// verified by fetching them with zero cookies — so this only ever needs a
// member number, not a password. See CLAUDE_CODE_PROJECT_BRIEF.md for why
// we still gate this behind a shooter typing in *their own* number rather
// than exposing an open lookup: NSSA doesn't enforce that boundary, we do.
//
// Known limitations (not built yet, deliberately out of scope for v1):
// - Only pulls the current/default shoot year; historical years are
//   reachable via the same page's `year` param but not looped over yet.
// - Doubles-gauge awards aren't fetched (no confirmed combobox label seen
//   yet for doubles entries).
// - team_results (e.g. "2MCH" two-man championships) aren't written —
//   the award_code is still captured on the result row, so the profile
//   page degrades gracefully (loses the teammate's name in the caption).

const BASE = 'https://mynssa.nssa-nsca.org';

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

function toIsoDate(mmddyyyy: string): string {
  const [mm, dd, yyyy] = mmddyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function titleCase(lastCommaFirst: string): string {
  const [last, first] = lastCommaFirst.split(',').map((s) => s.trim());
  const cap = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${cap(first)} ${cap(last)}`;
}

async function fetchMemberHistory(memberId: string, year?: string): Promise<MemberHistory> {
  const url = year
    ? `${BASE}/Lookups/NSSA_Member_History.php?id=${memberId}&y=${year}`
    : `${BASE}/Lookups/NSSA_Member_History.php?id=${memberId}`;
  const html = await fetchText(url);
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
    const gauge = gaugeLabel === 'Doubles' ? 'doubles' : `${gaugeLabel}ga`;
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

  return { fullName, classifications, rows };
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

  const optionEntries = $('select[name="ddlSingleEntries"] option')
    .map((_, o) => ({ text: $(o).text().trim(), value: $(o).attr('value') ?? '' }))
    .get();

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

async function fetchAwardCode(shootId: string, gauge: string, shooterFullName: string): Promise<string | null> {
  const options = await fetchGaugeOptions(shootId);
  const pattern = GAUGE_LABEL_PATTERNS[gauge];
  if (!pattern) return null;
  const option = options.find((o) => pattern.test(o.text));
  if (!option) return null;

  const body = new URLSearchParams();
  body.set('ddlSingleEntries', option.value);
  body.set('rbAwards', '0');
  body.set('rbSort', '0');
  body.set('sender', 'Show Results');

  const html = await fetchText(`${BASE}/Lookups/NSSA_Shoot_Details.php?sh=${shootId}`, body);
  const $ = cheerio.load(html);

  const targetName = shooterFullName.toUpperCase();
  let awardCode: string | null = null;
  $('table')
    .find('tr')
    .each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length !== 4) return;
      const cells = tds.map((__, td) => $(td).text().trim()).get();
      if (!/^\d+$/.test(cells[0]) || !/^\d+$/.test(cells[1])) return; // skip header/class-breakdown rows
      if (cells[2].toUpperCase() === targetName) awardCode = cells[3] || null;
    });

  return awardCode;
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

export async function importShooterFromNssa(memberId: string): Promise<ImportSummary> {
  const supabase = createServerClient();
  const history = await fetchMemberHistory(memberId);

  const { data: shooter, error: shooterError } = await supabase
    .from('shooters')
    .upsert(
      { nssa_nsca_number: memberId, full_name: history.fullName },
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

      const awardCode = gauge === 'doubles' ? null : await fetchAwardCode(row.shootId, gauge, history.fullName);
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
    }
  }

  return {
    shooterId,
    fullName: history.fullName,
    eventsImported: eventIds.size,
    resultsImported,
  };
}
