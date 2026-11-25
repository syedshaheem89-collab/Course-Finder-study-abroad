import { normalizeCountryName, STUDY_ABROAD_COUNTRIES } from '@/lib/countries';
import { expandSearchTerms } from '@/lib/search-synonyms';

export const GLOBAL_DISCOVERY_COUNTRY_ORDER: string[] = [
  'United Kingdom',
  'Germany',
  'Canada',
  'Ireland',
  'Australia',
  'Netherlands',
  'Sweden',
  'France',
  'Poland',
  'USA',
  'Italy',
  'Spain',
  'Denmark',
  'Finland',
  'Switzerland',
  'New Zealand',
  'Austria',
  'Belgium',
  'Norway',
  'Singapore',
  'United Arab Emirates',
  'Malta',
  'Czech Republic',
  'Hungary',
  'Portugal',
  'Bulgaria',
  'Georgia',
  'Albania',
  'Latvia',
  'Lithuania',
  'Estonia',
  'Cyprus',
  'Luxembourg',
  'Japan',
  'South Korea',
];

const COUNTRY_ORDER_INDEX = new Map<string, number>(
  GLOBAL_DISCOVERY_COUNTRY_ORDER.map((c, idx) => [c.toLowerCase(), idx])
);

const INVALID_UNIVERSITY_NAMES = new Set([
  '',
  'unknown',
  'unknown university',
  'n/a',
  'na',
  'none',
]);

const COUNTRY_ALIAS_RULES: Array<[RegExp, string]> = [
  [/(?:^|\W)(?:u\.k\.|uk|britain|british|england|scotland|wales)(?=$|\W)/i, 'United Kingdom'],
  [/(?:^|\W)(?:u\.s\.a\.|usa|united states)(?=$|\W)/i, 'USA'],
  [/(?:^|\W)(?:u\.a\.e\.|uae|dubai|abu dhabi)(?=$|\W)/i, 'United Arab Emirates'],
  [/\b(?:german|deutschland)\b/i, 'Germany'],
  [/\bswedish\b/i, 'Sweden'],
  [/\b(?:dutch|holland)\b/i, 'Netherlands'],
  [/\bfrench\b/i, 'France'],
  [/\bitalian\b/i, 'Italy'],
  [/\bspanish\b/i, 'Spain'],
  [/\bpolish\b/i, 'Poland'],
  [/\birish\b/i, 'Ireland'],
  [/\bcanadian\b/i, 'Canada'],
  [/\baustralian\b/i, 'Australia'],
  [/\bbulgarian\b/i, 'Bulgaria'],
  [/\bgeorgian\b/i, 'Georgia'],
  [/\balbanian\b/i, 'Albania'],
  [/\blatvian\b/i, 'Latvia'],
  [/\blithuanian\b/i, 'Lithuania'],
  [/\bestonian\b/i, 'Estonia'],
  [/\bfinnish\b/i, 'Finland'],
  [/\bdanish\b/i, 'Denmark'],
  [/\bnorwegian\b/i, 'Norway'],
  [/\bswiss\b/i, 'Switzerland'],
  [/\baustrian\b/i, 'Austria'],
  [/\bbelgian\b/i, 'Belgium'],
  [/\bportuguese\b/i, 'Portugal'],
  [/\bhungarian\b/i, 'Hungary'],
  [/\b(?:czech|czechia)\b/i, 'Czech Republic'],
  [/\bmaltese\b/i, 'Malta'],
  [/\bcypriot\b/i, 'Cyprus'],
  [/\bjapanese\b/i, 'Japan'],
  [/\bkorean\b/i, 'South Korea'],
  [/\bsingaporean\b/i, 'Singapore'],
];

const SORTED_COUNTRY_NAMES = [...STUDY_ABROAD_COUNTRIES].sort((a, b) => b.length - a.length);

const UNIVERSITY_QUERY_STOP_WORDS = new Set([
  'university',
  'universitat',
  'universitaet',
  'hochschule',
  'college',
  'institute',
  'school',
  'academy',
  'polytechnic',
  'applied',
  'sciences',
  'science',
  'technology',
  'business',
  'engineering',
  'management',
  'international',
  'national',
  'state',
  'public',
  'private',
  'studies',
  'global',
  'european',
  'higher',
  'education',
  'of',
  'in',
  'the',
  'and',
  'for',
  'at',
  'de',
  'la',
  'van',
  'von',
  'und',
  'master',
  'bachelor',
  'mba',
  'msc',
  'bsc',
  'ba',
  'ma',
  'phd',
  'diploma',
  'certificate',
]);

export interface DiversifiableCourse {
  id?: string;
  program_name: string;
  degree_level?: string;
  category?: string | null;
  tuition_fees_eur?: number | null;
  average_graduate_salary?: number | null;
  is_ai_discovered?: boolean;
  is_priority_university?: boolean;
  priority_rank?: number | null;
  university?: {
    id?: string;
    name?: string;
    country?: string;
  } | null;
}

export interface DiversifiableRecommendation {
  course_id?: string;
  program_name: string;
  university_name: string;
  country: string;
  is_priority_university?: boolean;
  priority_rank?: number | null;
  match_score?: number;
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function termMatchesText(haystack: string, term: string): boolean {
  const clean = term.trim().toLowerCase();
  if (!clean) return false;
  if (clean.length <= 2) {
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
  }
  return haystack.includes(clean);
}

export function isInvalidUniversityName(name?: string): boolean {
  const normalized = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return INVALID_UNIVERSITY_NAMES.has(normalized);
}

export function normalizeUniversityKey(universityName: string, country?: string): string {
  const cleanedName = stripDiacritics(String(universityName || ''))
    .toLowerCase()
    .replace(/\([^)]{1,6}\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawCountry = String(country || '').trim();
  const normCountry = (normalizeCountryName(rawCountry) || rawCountry).toLowerCase();
  return `${normCountry}::${cleanedName}`;
}

export function extractExplicitCountryFromQuery(rawQuery: string): string | null {
  const q = String(rawQuery || '').trim();
  if (!q) return null;

  for (const country of SORTED_COUNTRY_NAMES) {
    const escaped = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(q)) {
      return country;
    }
  }

  for (const [pattern, country] of COUNTRY_ALIAS_RULES) {
    if (pattern.test(q)) {
      return country;
    }
  }

  return null;
}

export function isExplicitUniversityQuery<T extends DiversifiableCourse>(
  rawQuery: string,
  candidates: T[]
): boolean {
  const q = String(rawQuery || '').trim();
  if (!q || candidates.length === 0) return false;

  const qLower = stripDiacritics(q).toLowerCase();
  const qWords = qLower.split(/\s+/).filter(Boolean);
  const expanded = expandSearchTerms(qLower);

  // If the query matches programme titles/categories/levels across 3+ countries, treat as a course search.
  const programMatchCountries = new Set<string>();
  for (const c of candidates) {
    const normCountry = normalizeCountryName(c.university?.country || '');
    if (!normCountry) continue;
    const progHaystack = stripDiacritics(
      `${c.program_name || ''} ${c.category || ''} ${c.degree_level || ''}`
    ).toLowerCase();

    const matchedProgram =
      qWords.length <= 1
        ? expanded.some((term) => termMatchesText(progHaystack, term))
        : termMatchesText(progHaystack, qLower) ||
          qWords
            .filter((w) => w.length >= 2)
            .every((w) =>
              Array.from(new Set([w, ...expandSearchTerms(w)])).some((t) =>
                termMatchesText(progHaystack, t)
              )
            );

    if (matchedProgram) {
      programMatchCountries.add(normCountry);
      if (programMatchCountries.size >= 3) {
        return false;
      }
    }
  }

  const distinctiveTokens = qLower
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 2 && !UNIVERSITY_QUERY_STOP_WORDS.has(tok));

  if (distinctiveTokens.length === 0) return false;

  let uniNameMatchCount = 0;
  const distinctUniKeys = new Set<string>();

  for (const c of candidates) {
    const uniName = String(c.university?.name || '');
    const uniLower = stripDiacritics(uniName).toLowerCase();
    distinctUniKeys.add(normalizeUniversityKey(uniName, c.university?.country));

    if (distinctiveTokens.some((tok) => termMatchesText(uniLower, tok))) {
      uniNameMatchCount++;
    }
  }

  if (uniNameMatchCount / candidates.length >= 0.7) {
    return true;
  }

  return distinctUniKeys.size <= 2 && uniNameMatchCount > 0;
}

function computeQueryRelevanceScore(item: DiversifiableCourse, rawQuery: string): number {
  const cleanQ = rawQuery.trim().toLowerCase();
  if (!cleanQ) return 0;

  const progLower = `${item.program_name || ''}`.toLowerCase();
  const catLower = `${item.category || ''} ${item.degree_level || ''}`.toLowerCase();

  if (termMatchesText(progLower, cleanQ)) return 3;

  const words = cleanQ.split(/\s+/).filter((w) => w.length >= 2);
  if (
    words.length > 0 &&
    words.every((w) =>
      Array.from(new Set([w, ...expandSearchTerms(w)])).some((t) => termMatchesText(progLower, t))
    )
  ) {
    return 2;
  }

  const expanded = expandSearchTerms(cleanQ);
  if (expanded.some((t) => termMatchesText(progLower, t))) return 2;
  if (
    termMatchesText(catLower, cleanQ) ||
    expanded.some((t) => termMatchesText(catLower, t)) ||
    words.some((w) => termMatchesText(catLower, w))
  ) {
    return 1;
  }

  return 0;
}

function getCountryOrderRank(country: string): number {
  const idx = COUNTRY_ORDER_INDEX.get(country.toLowerCase());
  return idx !== undefined ? idx : 999;
}

export function diversifyGlobalCourses<T extends DiversifiableCourse>(
  items: T[],
  options?: {
    maxPerUniversity?: number;
    maxPerCountry?: number;
    sort?: string;
    q?: string;
    subject?: string;
  }
): { items: T[]; countryCount: number } {
  const maxPerUniversity = Math.max(1, options?.maxPerUniversity ?? 1);
  const maxPerCountry = Math.max(1, options?.maxPerCountry ?? 2);
  const sort = options?.sort || 'match';
  const q = String(options?.q || '').trim();
  const subject = String(options?.subject || '').trim();

  // Step A: Drop invalid Global/Unknown rows and deduplicate (country, uniKey, program_name)
  const dedupedByKey = new Map<string, { item: T; originalIdx: number; country: string; relScore: number }>();

  items.forEach((item, originalIdx) => {
    const rawCountry = String(item?.university?.country || '').trim();
    const canonicalCountry = normalizeCountryName(rawCountry);
    if (!canonicalCountry) return;

    const uniName = String(item?.university?.name || '').trim();
    if (isInvalidUniversityName(uniName)) return;

    const uniKey = normalizeUniversityKey(uniName, canonicalCountry);
    const progKey = String(item.program_name || '').trim().toLowerCase();
    if (!progKey) return;

    const dedupKey = `${uniKey}::${progKey}`;
    const existing = dedupedByKey.get(dedupKey);
    const relScore = q ? computeQueryRelevanceScore(item, q) : 0;

    if (!existing) {
      dedupedByKey.set(dedupKey, { item, originalIdx, country: canonicalCountry, relScore });
      return;
    }

    // Prefer verified DB rows (!is_ai_discovered) over curated rows
    if (existing.item.is_ai_discovered && !item.is_ai_discovered) {
      dedupedByKey.set(dedupKey, { item, originalIdx, country: canonicalCountry, relScore });
    }
  });

  // Step B: Group into country buckets and sort within each country deterministically
  type CandidateEntry = { item: T; originalIdx: number; country: string; relScore: number };
  const countryBuckets = new Map<string, CandidateEntry[]>();

  for (const entry of dedupedByKey.values()) {
    const bucket = countryBuckets.get(entry.country);
    if (bucket) {
      bucket.push(entry);
    } else {
      countryBuckets.set(entry.country, [entry]);
    }
  }

  const comparePriority = (a: T, b: T): number => {
    const pDiff = (a.is_priority_university ? 0 : 1) - (b.is_priority_university ? 0 : 1);
    if (pDiff !== 0) return pDiff;
    if (a.is_priority_university && b.is_priority_university) {
      return (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999);
    }
    return 0;
  };

  for (const bucket of countryBuckets.values()) {
    bucket.sort((a, b) => {
      if (sort === 'tuition_asc') {
        const tDiff = (Number(a.item.tuition_fees_eur) || 0) - (Number(b.item.tuition_fees_eur) || 0);
        if (tDiff !== 0) return tDiff;
        const pDiff = comparePriority(a.item, b.item);
        if (pDiff !== 0) return pDiff;
        const sDiff = (Number(b.item.average_graduate_salary) || 0) - (Number(a.item.average_graduate_salary) || 0);
        if (sDiff !== 0) return sDiff;
        const srcDiff = (a.item.is_ai_discovered ? 1 : 0) - (b.item.is_ai_discovered ? 1 : 0);
        if (srcDiff !== 0) return srcDiff;
        return String(a.item.program_name || '').localeCompare(String(b.item.program_name || ''));
      }

      if (sort === 'salary_desc') {
        const sDiff = (Number(b.item.average_graduate_salary) || 0) - (Number(a.item.average_graduate_salary) || 0);
        if (sDiff !== 0) return sDiff;
        const pDiff = comparePriority(a.item, b.item);
        if (pDiff !== 0) return pDiff;
        const tDiff = (Number(a.item.tuition_fees_eur) || 0) - (Number(b.item.tuition_fees_eur) || 0);
        if (tDiff !== 0) return tDiff;
        const srcDiff = (a.item.is_ai_discovered ? 1 : 0) - (b.item.is_ai_discovered ? 1 : 0);
        if (srcDiff !== 0) return srcDiff;
        return String(a.item.program_name || '').localeCompare(String(b.item.program_name || ''));
      }

      const pDiff = comparePriority(a.item, b.item);
      if (pDiff !== 0) return pDiff;
      if (q && b.relScore !== a.relScore) {
        return b.relScore - a.relScore;
      }
      return a.originalIdx - b.originalIdx;
    });
  }

  // Step C: Pick up to maxPerCountry (2) items per country, enforcing maxPerUniversity (1)
  const usedUniCounts = new Map<string, number>();
  const selectedByCountry = new Map<string, CandidateEntry[]>();

  const orderedCountryKeys = Array.from(countryBuckets.keys()).sort((a, b) => {
    const rankDiff = getCountryOrderRank(a) - getCountryOrderRank(b);
    return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
  });

  for (const country of orderedCountryKeys) {
    const bucket = countryBuckets.get(country) || [];
    const picks: CandidateEntry[] = [];

    for (let slot = 0; slot < maxPerCountry; slot++) {
      const eligible = bucket.filter((entry) => {
        if (picks.includes(entry)) return false;
        const uKey = normalizeUniversityKey(entry.item.university?.name || '', country);
        return (usedUniCounts.get(uKey) || 0) < maxPerUniversity;
      });

      if (eligible.length === 0) break;

      let chosen = eligible[0];
      if (
        slot === 1 &&
        (sort === 'match' || sort === 'newest') &&
        !q &&
        !subject &&
        !chosen.item.is_priority_university
      ) {
        const slot1Category = String(picks[0].item.category || '').trim().toLowerCase();
        const diverseCatMatch = eligible.find(
          (entry) => String(entry.item.category || '').trim().toLowerCase() !== slot1Category
        );
        if (diverseCatMatch) {
          chosen = diverseCatMatch;
        }
      }

      picks.push(chosen);
      const chosenUniKey = normalizeUniversityKey(chosen.item.university?.name || '', country);
      usedUniCounts.set(chosenUniKey, (usedUniCounts.get(chosenUniKey) || 0) + 1);
    }

    if (picks.length > 0) {
      selectedByCountry.set(country, picks);
    }
  }

  // Step D: Combine picks across countries
  let finalItems: T[] = [];

  if (sort === 'tuition_asc' || sort === 'salary_desc') {
    const flat: { entry: CandidateEntry; slotIdx: number; countryOrderIdx: number }[] = [];
    for (const [country, picks] of selectedByCountry.entries()) {
      const countryOrderIdx = getCountryOrderRank(country);
      picks.forEach((entry, slotIdx) => {
        flat.push({ entry, slotIdx, countryOrderIdx });
      });
    }

    flat.sort((a, b) => {
      if (sort === 'tuition_asc') {
        const tDiff =
          (Number(a.entry.item.tuition_fees_eur) || 0) -
          (Number(b.entry.item.tuition_fees_eur) || 0);
        if (tDiff !== 0) return tDiff;
      } else {
        const sDiff =
          (Number(b.entry.item.average_graduate_salary) || 0) -
          (Number(a.entry.item.average_graduate_salary) || 0);
        if (sDiff !== 0) return sDiff;
      }
      if (a.slotIdx !== b.slotIdx) return a.slotIdx - b.slotIdx;
      if (a.countryOrderIdx !== b.countryOrderIdx) return a.countryOrderIdx - b.countryOrderIdx;
      return a.entry.country.localeCompare(b.entry.country);
    });

    finalItems = flat.map((f) => f.entry.item);
  } else {
    const priorityHead: T[] = [];
    const priorityCountByCountry = new Map<string, number>();
    const nonPriorityByCountry = new Map<string, CandidateEntry[]>();

    for (const [country, picks] of selectedByCountry.entries()) {
      for (const entry of picks) {
        if (entry.item.is_priority_university) {
          priorityHead.push(entry.item);
          priorityCountByCountry.set(country, (priorityCountByCountry.get(country) || 0) + 1);
        } else {
          const list = nonPriorityByCountry.get(country);
          if (list) list.push(entry);
          else nonPriorityByCountry.set(country, [entry]);
        }
      }
    }

    priorityHead.sort((a, b) => (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999));

    const roundRobinCountries = Array.from(nonPriorityByCountry.keys()).sort((a, b) => {
      if (q) {
        const relA = nonPriorityByCountry.get(a)?.[0]?.relScore ?? 0;
        const relB = nonPriorityByCountry.get(b)?.[0]?.relScore ?? 0;
        if (relB !== relA) return relB - relA;
      }
      const rankDiff = getCountryOrderRank(a) - getCountryOrderRank(b);
      return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
    });

    const interleaved: T[] = [];
    for (let round = 0; round < maxPerCountry; round++) {
      for (const country of roundRobinCountries) {
        const prioOffset = priorityCountByCountry.get(country) || 0;
        const idx = round - prioOffset;
        const picks = nonPriorityByCountry.get(country);
        if (idx >= 0 && picks && picks[idx]) {
          interleaved.push(picks[idx].item);
        }
      }
    }

    finalItems = [...priorityHead, ...interleaved];
  }

  const participatingCountries = new Set<string>();
  for (const item of finalItems) {
    const norm = normalizeCountryName(item.university?.country || '');
    if (norm) participatingCountries.add(norm);
  }

  return {
    items: finalItems,
    countryCount: participatingCountries.size,
  };
}

export function diversifyGlobalRecommendations<T extends DiversifiableRecommendation>(
  items: T[],
  options?: {
    maxPerUniversity?: number;
    maxPerCountry?: number;
    maxTotal?: number;
  }
): T[] {
  const maxPerUniversity = Math.max(1, options?.maxPerUniversity ?? 1);
  const maxPerCountry = Math.max(1, options?.maxPerCountry ?? 2);
  const maxTotal = Math.max(1, options?.maxTotal ?? 12);

  const deduped = new Map<string, { item: T; country: string; originalIdx: number }>();

  items.forEach((item, originalIdx) => {
    const canonicalCountry = normalizeCountryName(String(item.country || '').trim());
    if (!canonicalCountry) return;

    const uniName = String(item.university_name || '').trim();
    if (isInvalidUniversityName(uniName)) return;

    const progKey = String(item.program_name || '').trim().toLowerCase();
    if (!progKey) return;

    const uniKey = normalizeUniversityKey(uniName, canonicalCountry);
    const dedupKey = `${uniKey}::${progKey}`;
    if (!deduped.has(dedupKey)) {
      deduped.set(dedupKey, { item: { ...item, country: canonicalCountry }, country: canonicalCountry, originalIdx });
    }
  });

  const sortedAll = Array.from(deduped.values()).sort((a, b) => {
    const pDiff = (a.item.is_priority_university ? 0 : 1) - (b.item.is_priority_university ? 0 : 1);
    if (pDiff !== 0) return pDiff;
    if (a.item.is_priority_university && b.item.is_priority_university) {
      const rDiff = (a.item.priority_rank ?? 9999) - (b.item.priority_rank ?? 9999);
      if (rDiff !== 0) return rDiff;
    }
    const mDiff = (b.item.match_score || 0) - (a.item.match_score || 0);
    if (mDiff !== 0) return mDiff;
    return a.originalIdx - b.originalIdx;
  });

  const byCountry = new Map<string, T[]>();
  const usedUniCounts = new Map<string, number>();

  for (const { item, country } of sortedAll) {
    const countryPicks = byCountry.get(country) || [];
    if (countryPicks.length >= maxPerCountry) continue;

    const uniKey = normalizeUniversityKey(item.university_name, country);
    const uCount = usedUniCounts.get(uniKey) || 0;
    if (uCount >= maxPerUniversity) continue;

    countryPicks.push(item);
    byCountry.set(country, countryPicks);
    usedUniCounts.set(uniKey, uCount + 1);
  }

  const priorityHead: T[] = [];
  const nonPriorityByCountry = new Map<string, T[]>();

  for (const [country, picks] of byCountry.entries()) {
    for (const item of picks) {
      if (item.is_priority_university) {
        priorityHead.push(item);
      } else {
        const list = nonPriorityByCountry.get(country);
        if (list) list.push(item);
        else nonPriorityByCountry.set(country, [item]);
      }
    }
  }

  priorityHead.sort((a, b) => {
    const rDiff = (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999);
    if (rDiff !== 0) return rDiff;
    return (b.match_score || 0) - (a.match_score || 0);
  });

  const orderedCountries = Array.from(nonPriorityByCountry.keys()).sort((a, b) => {
    const topA = nonPriorityByCountry.get(a)?.[0]?.match_score ?? 0;
    const topB = nonPriorityByCountry.get(b)?.[0]?.match_score ?? 0;
    if (topB !== topA) return topB - topA;
    const rankDiff = getCountryOrderRank(a) - getCountryOrderRank(b);
    return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
  });

  const interleaved: T[] = [];
  for (let round = 0; round < maxPerCountry; round++) {
    for (const country of orderedCountries) {
      const list = nonPriorityByCountry.get(country);
      if (list && list[round]) {
        interleaved.push(list[round]);
      }
    }
  }

  return [...priorityHead, ...interleaved].slice(0, maxTotal);
}
