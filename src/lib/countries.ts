export const STUDY_ABROAD_COUNTRIES: string[] = [
  'Australia',
  'Austria',
  'Belgium',
  'Canada',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Hungary',
  'Ireland',
  'Italy',
  'Japan',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Poland',
  'Portugal',
  'Singapore',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'USA',
];

export const COUNTRY_DIAL_CODES: string[] = [
  '+91',
  '+971',
  '+44',
  '+1',
  '+61',
  '+49',
  '+48',
  '+353',
  '+356',
  '+371',
  '+65',
  '+33',
  '+31',
  '+46',
];

const INVALID_COUNTRY_TOKENS = new Set([
  '',
  'global',
  'all',
  'unknown',
  'other',
  'n/a',
  'na',
  'none',
  'any',
]);

export function normalizeCountryName(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  const lower = trimmed.toLowerCase();
  if (INVALID_COUNTRY_TOKENS.has(lower)) return null;
  if (lower === 'uk' || lower === 'u.k.') return 'United Kingdom';
  if (lower === 'us' || lower === 'u.s.' || lower === 'u.s.a.' || lower === 'united states' || lower === 'united states of america') {
    return 'USA';
  }
  if (lower === 'uae' || lower === 'u.a.e.') return 'United Arab Emirates';
  return trimmed;
}

export function mergeCountryLists(dbCountries: string[] = []): string[] {
  const seen = new Map<string, string>();

  const addCountry = (raw: string) => {
    const normalized = normalizeCountryName(raw);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  };

  STUDY_ABROAD_COUNTRIES.forEach(addCountry);
  dbCountries.forEach(addCountry);

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
