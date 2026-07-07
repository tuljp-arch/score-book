// Shared parsing rules for NSSA award codes (e.g. "C1,SSCH"), used by both
// the profile page (to derive medals) and the import pipeline (to write a
// mechanical placement_plain_english). Confirmed against real shoot-detail
// pages at mynssa.nssa-nsca.org/Lookups/NSSA_Shoot_Details.php — the
// concurrent-class list and abbreviations below are the ones actually shown
// in a shoot's class breakdown table, not guesses.
//
// "SU" was left unresolved in the original seed data notes and still is —
// unmapped prefixes fall back to showing the raw code rather than asserting
// a label we're not sure of.

export const CONCURRENT_CLASS_LABELS: Record<string, string> = {
  L: 'Lady',
  SJ: 'Sub Junior',
  J: 'Junior',
  TS: 'Triple Sub',
  SSS: 'Sub Sub Senior',
  SS: 'Sub Senior',
  SR: 'Senior',
  VT: 'Veteran',
  SV: 'Senior Veteran',
  RM: 'Retired Military',
};

export const MAIN_CLASS_LETTERS = ['AA', 'A', 'B', 'C', 'D', 'E', 'M'];

export const TEAM_NUMBER_WORDS: Record<number, string> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
};

export interface AwardToken {
  raw: string;
  kind: 'main-class-win' | 'concurrent-champion' | 'team-champion' | 'hoa-champion' | 'hoa-runner-up' | 'other';
  label: string;
}

export function parseAwardToken(token: string): AwardToken {
  const t = token.trim();

  if (t === 'CH') return { raw: t, kind: 'hoa-champion', label: 'HOA Champion' };
  if (t === 'RU') return { raw: t, kind: 'hoa-runner-up', label: 'HOA Runner-up' };

  const teamMatch = /^(\d+)M(CH|RU)$/.exec(t);
  if (teamMatch) {
    const n = Number(teamMatch[1]);
    const word = TEAM_NUMBER_WORDS[n] ?? `${n}`;
    const isChamp = teamMatch[2] === 'CH';
    return {
      raw: t,
      kind: isChamp ? 'team-champion' : 'other',
      label: `${word}-Man Championship${isChamp ? '' : ' Runner-up'}`,
    };
  }

  const classMatch = /^(AA|A|B|C|D|E|M)1$/.exec(t);
  if (classMatch) {
    return { raw: t, kind: 'main-class-win', label: `Class ${classMatch[1]} Champion` };
  }

  const chMatch = /^([A-Z]+)CH$/.exec(t);
  if (chMatch) {
    const label = CONCURRENT_CLASS_LABELS[chMatch[1]] ?? chMatch[1];
    return { raw: t, kind: 'concurrent-champion', label: `${label} Champion` };
  }

  const ruMatch = /^([A-Z]+)RU$/.exec(t);
  if (ruMatch) {
    const label = CONCURRENT_CLASS_LABELS[ruMatch[1]] ?? ruMatch[1];
    return { raw: t, kind: 'other', label: `${label} Runner-up` };
  }

  const placeMatch = /^([A-Z]+)(\d)$/.exec(t);
  if (placeMatch) {
    const isMainClass = MAIN_CLASS_LETTERS.includes(placeMatch[1]);
    const label = isMainClass ? placeMatch[1] : CONCURRENT_CLASS_LABELS[placeMatch[1]] ?? placeMatch[1];
    return { raw: t, kind: 'other', label: `${ordinal(Number(placeMatch[2]))} ${isMainClass ? 'Class ' : ''}${label}` };
  }

  return { raw: t, kind: 'other', label: t };
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// Mechanical, no-narrative summary of an award_code string, e.g.
// "C1,SSCH" -> "1st Class C; Sub Senior Champion". This is what the import
// pipeline writes — any richer narrative (e.g. "outscored so-and-so") is
// something a person adds by hand, since it isn't present in NSSA's data.
export function describeAwardCode(awardCode: string | null): string {
  if (!awardCode) return '';
  return awardCode
    .split(',')
    .map((t) => parseAwardToken(t).label)
    .join('; ');
}
