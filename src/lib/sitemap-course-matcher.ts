import { sanitizeHttpUrl } from '@/lib/security/validation';
import { isGenericUniversityUrl } from '@/lib/student-guides';
import { correctSearchTypos, getPhraseSynonyms } from '@/lib/search-synonyms';

const STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'into',
  'program',
  'programme',
  'programmes',
  'programs',
  'degree',
  'course',
  'courses',
  'hons',
  'honours',
  'english',
  'track',
  'studies',
  'study',
  'science',
]);

const DEGREE_PREFIX_WORDS = new Set([
  'bsc',
  'msc',
  'ba',
  'ma',
  'beng',
  'meng',
  'bba',
  'mph',
  'md',
  'phd',
  'bachelor',
  'master',
  'integrated',
  'general',
]);

const SLUG_CONNECTOR_WORDS = new Set(['and', 'of', 'in', 'the', 'for', 'with', 'english', 'track']);

const NON_COURSE_PATH_RE =
  /\/(news|blog|blogs|event|events|staff|people|faculty|alumni|press|media|tag|category|categories|author|wp-content|uploads|cookie|privacy|terms)\b|\.pdf($|\?)|\.(jpg|jpeg|png|webp|svg|doc|docx|xls|xlsx)($|\?)/i;

interface CachedSitemapEntry {
  urls: string[];
  fetchedAt: number;
}

const globalForSitemap = globalThis as unknown as {
  __orbisSitemapCache?: Map<string, CachedSitemapEntry>;
};

function getSitemapCache(): Map<string, CachedSitemapEntry> {
  if (!globalForSitemap.__orbisSitemapCache) {
    globalForSitemap.__orbisSitemapCache = new Map();
  }
  return globalForSitemap.__orbisSitemapCache;
}

function extractLocUrls(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const safe = sanitizeHttpUrl(raw);
    if (safe) out.push(safe);
    if (out.length >= 4000) break;
  }
  return out;
}

async function fetchXmlText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Orbis/2026' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const txt = await res.text();
    return txt.includes('<loc>') ? txt : null;
  } catch {
    return null;
  }
}

async function fetchRobotsSitemapUrls(cleanDomain: string): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();
  const robotsCandidates = [
    `https://www.${cleanDomain}/robots.txt`,
    `https://${cleanDomain}/robots.txt`,
  ];
  for (const rUrl of robotsCandidates) {
    try {
      const res = await fetch(rUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'Orbis/2026' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const txt = await res.text();
      const matches = txt.matchAll(/^Sitemap:\s*(https?:\/\/\S+)/gim);
      for (const m of matches) {
        const safe = sanitizeHttpUrl(m[1].trim());
        if (safe && !seen.has(safe)) {
          seen.add(safe);
          urls.push(safe);
        }
      }
      if (urls.length > 0) break;
    } catch {
      // Non-fatal
    }
  }
  return urls;
}

export async function getDomainSitemapUrls(domain: string): Promise<string[]> {
  const cleanDomain = String(domain || '').replace(/^www\./i, '').trim().toLowerCase();
  if (!cleanDomain) return [];

  const cache = getSitemapCache();
  const cached = cache.get(cleanDomain);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 24 * 3600_000) {
    return cached.urls;
  }

  const rootCandidates = [
    `https://www.${cleanDomain}/sitemap.xml`,
    `https://${cleanDomain}/sitemap.xml`,
    `https://www.${cleanDomain}/sitemap_index.xml`,
  ];

  let rootXml: string | null = null;
  for (const cand of rootCandidates) {
    rootXml = await fetchXmlText(cand);
    if (rootXml) break;
  }

  if (!rootXml) {
    const robotsSitemaps = await fetchRobotsSitemapUrls(cleanDomain);
    for (const rSitemap of robotsSitemaps.slice(0, 4)) {
      rootXml = await fetchXmlText(rSitemap);
      if (rootXml) break;
    }
  }

  if (!rootXml) {
    cache.set(cleanDomain, { urls: [], fetchedAt: now });
    return [];
  }

  let collected: string[] = [];
  if (/<sitemapindex/i.test(rootXml)) {
    const subSitemaps = extractLocUrls(rootXml);
    const prioritized = subSitemaps
      .filter((u) => /course|program|study|studies|postgrad|undergrad|degree|english|\/en\b/i.test(u))
      .slice(0, 3);
    const toFetch = prioritized.length > 0 ? prioritized : subSitemaps.slice(0, 2);
    const subTexts = await Promise.all(toFetch.map((u) => fetchXmlText(u)));
    const seen = new Set<string>();
    for (const xml of subTexts) {
      if (!xml) continue;
      for (const loc of extractLocUrls(xml)) {
        if (!seen.has(loc)) {
          seen.add(loc);
          collected.push(loc);
          if (collected.length >= 4000) break;
        }
      }
      if (collected.length >= 4000) break;
    }
  } else {
    collected = extractLocUrls(rootXml);
  }

  cache.set(cleanDomain, { urls: collected, fetchedAt: now });
  return collected;
}

function getProgramKeywords(programName: string): string[] {
  return Array.from(
    new Set(
      String(programName || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t) && !DEGREE_PREFIX_WORDS.has(t))
    )
  );
}

function getSlugKeywords(rawUrl: string): string[] {
  try {
    const segments = new URL(rawUrl).pathname
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) return [];
    let slug = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const cleanedSeg = segments[i].replace(/\.(html?|aspx?|php)$/i, '');
      if (!cleanedSeg || /^(20\d{2}(-\d{2,4})?|apply|fees|overview|details|en|index)$/i.test(cleanedSeg)) {
        continue;
      }
      slug = cleanedSeg.replace(/-\d+$/, '');
      break;
    }
    if (!slug) return [];
    return slug
      .toLowerCase()
      .split(/[-_]+/)
      .filter((t) => t.length >= 3 && !SLUG_CONNECTOR_WORDS.has(t) && !/^\d+$/.test(t));
  } catch {
    return [];
  }
}

export function scoreSitemapCourseUrl(
  url: string,
  programName: string,
  degreeLevel?: string
): {
  score: number;
  overlapRatio: number;
  matchedCount: number;
  slugOverlapRatio: number;
  isCoursePath: boolean;
} {
  if (!url || isGenericUniversityUrl(url).isGeneric || NON_COURSE_PATH_RE.test(url)) {
    return { score: -1, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath: false };
  }

  let pathLower = url.toLowerCase();
  try {
    pathLower = new URL(url).pathname.toLowerCase();
  } catch {
    return { score: -1, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath: false };
  }

  const isCoursePath =
    /\/(course|courses|program|programme|programmes|programs|study|studies|postgraduate|undergraduate|master|master-studies|bachelor|bachelor-studies|integrated-studies|degrees)\b/.test(
      pathLower
    );

  const tokens = getProgramKeywords(programName);
  if (tokens.length === 0) {
    return { score: 0, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath };
  }

  let matchedCount = 0;
  for (const tok of tokens) {
    if (pathLower.includes(tok)) matchedCount += 1;
  }

  const overlapRatio = matchedCount / tokens.length;

  const progLower = String(programName || '').toLowerCase();
  const slugTokens = getSlugKeywords(url);
  let slugMatched = 0;
  for (const st of slugTokens) {
    if (progLower.includes(st)) slugMatched += 1;
  }
  const slugOverlapRatio = slugTokens.length > 0 ? slugMatched / slugTokens.length : 0;

  let score = overlapRatio * 100 + matchedCount * 10;
  if (isCoursePath) {
    score += 15 + slugOverlapRatio * 40;
  }
  if (/\/en(?:\/|$)/.test(pathLower)) {
    score += 15;
  }

  const degLower = `${degreeLevel || ''} ${programName}`.toLowerCase();
  const wantsMba = /\bmba\b/.test(degLower);
  const wantsMaster = /\b(?:master|masters|msc|ma|mba|meng|llm|mph|postgraduate|pg)\b/.test(degLower);
  const wantsBachelor = /\b(?:bachelor|bachelors|bsc|ba|beng|bba|llb|undergraduate|ug)\b/.test(degLower);
  const hasMasterPath = /\/(?:master-studies|masters?|postgraduate|msc|m-[a-z])/i.test(pathLower);
  const hasBachelorPath = /\/(?:bachelor-studies|bachelors?|undergraduate|bsc|b-[a-z]|[^/]*-bsc-)/i.test(pathLower);
  const hasMbaSlug = /master-of-business-administration|\/mba\b/i.test(pathLower);

  if (wantsBachelor && !wantsMaster && hasMasterPath && !hasBachelorPath) {
    return { score: -1, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath };
  }
  if (wantsMaster && !wantsBachelor && hasBachelorPath && !hasMasterPath) {
    return { score: -1, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath };
  }
  if (!wantsMba && hasMbaSlug) {
    return { score: -1, overlapRatio: 0, matchedCount: 0, slugOverlapRatio: 0, isCoursePath };
  }

  if (wantsMba && pathLower.includes('mba')) {
    score += 20;
  } else if (wantsMaster && !wantsBachelor && hasMasterPath) {
    score += 20;
  } else if (wantsBachelor && !wantsMaster && hasBachelorPath) {
    score += 20;
  }

  return { score, overlapRatio, matchedCount, slugOverlapRatio, isCoursePath };
}

export async function findCourseUrlInSitemap(
  domain: string,
  programName: string,
  degreeLevel?: string
): Promise<string | undefined> {
  const urls = await getDomainSitemapUrls(domain);
  if (urls.length === 0) return undefined;

  const tokens = getProgramKeywords(programName);
  const isMba = /\bmba\b/i.test(programName);
  const scored = urls
    .map((url) => ({
      url,
      ...scoreSitemapCourseUrl(url, programName, degreeLevel),
    }))
    .filter((item) => {
      if (item.score <= 0) return false;
      if (isMba && item.url.toLowerCase().includes('mba') && item.matchedCount >= 1) return true;
      if (item.overlapRatio >= 0.6 && item.matchedCount >= 2) return true;
      if (tokens.length === 1 && item.matchedCount === 1 && item.isCoursePath && item.slugOverlapRatio >= 0.5) {
        return true;
      }
      return item.isCoursePath && item.slugOverlapRatio >= 0.85 && item.matchedCount >= 1;
    })
    .sort((a, b) => b.score - a.score);

  for (const cand of scored.slice(0, 3)) {
    try {
      let res = await fetch(cand.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Orbis/2026' },
      });
      if (res.status === 405 || res.status === 403) {
        res = await fetch(cand.url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'Orbis/2026' },
        });
      }
      if (res.status < 400) {
        const finalUrl = sanitizeHttpUrl(res.url || cand.url);
        if (finalUrl && !isGenericUniversityUrl(finalUrl).isGeneric) {
          return finalUrl;
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return undefined;
}

const UPPER_ACADEMIC_TOKENS: Record<string, string> = {
  msc: 'MSc',
  bsc: 'BSc',
  mba: 'MBA',
  mph: 'MPH',
  ma: 'MA',
  ba: 'BA',
  beng: 'BEng',
  meng: 'MEng',
  llm: 'LLM',
  llb: 'LLB',
  phd: 'PhD',
  bba: 'BBA',
  bca: 'BCA',
  mca: 'MCA',
  ai: 'AI',
  it: 'IT',
  hr: 'HR',
  ux: 'UX',
  ui: 'UI',
};

const LOWER_CONNECTOR_TOKENS = new Set(['and', 'of', 'in', 'for', 'with', 'on', 'to', 'the']);

export function titleizeCourseSlug(
  rawUrl: string
): { title: string; degreeLevel: 'Bachelor' | 'Master' | 'PhD' } | null {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) return null;

    let slug = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const cleanedSeg = segments[i].replace(/\.(html?|aspx?|php)$/i, '');
      if (!cleanedSeg || /^(20\d{2}(-\d{2,4})?|apply|fees|overview|details|en|index)$/i.test(cleanedSeg)) {
        continue;
      }
      slug = cleanedSeg.replace(/-\d+$/, '');
      break;
    }
    if (!slug || slug.length < 4) return null;

    const words = slug
      .split(/[-_]+/)
      .map((w) => w.trim())
      .filter(Boolean)
      .filter((w) => !/^20\d{2}$/.test(w));
    const hasClearCourseSection = /\/(bachelor|master|integrated|undergraduate|postgraduate|studies|courses|programmes?)\b/i.test(
      parsed.pathname
    );
    if (words.length === 0 || (words.length < 2 && !hasClearCourseSection)) return null;

    const formatted = words
      .map((w, idx) => {
        const lower = w.toLowerCase();
        if (UPPER_ACADEMIC_TOKENS[lower]) return UPPER_ACADEMIC_TOKENS[lower];
        if (idx > 0 && LOWER_CONNECTOR_TOKENS.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');

    const fullLower = `${parsed.pathname} ${formatted}`.toLowerCase();
    const degreeLevel: 'Bachelor' | 'Master' | 'PhD' =
      /\b(?:phd|doctorate|doctoral)\b/.test(fullLower)
        ? 'PhD'
        : /\b(?:bsc|bachelor|beng|bba|ba|llb|undergrad|undergraduate|honours|hons)\b/.test(fullLower)
        ? 'Bachelor'
        : 'Master';

    return { title: formatted, degreeLevel };
  } catch {
    return null;
  }
}

const DOMAIN_TTL_MS = 24 * 3600_000;
const globalForUniDomain = globalThis as unknown as {
  __orbisUniDomainCache?: Map<string, { domain: string; expiresAt: number }>;
};

export async function resolveUniversityDomainFree(
  universityName: string,
  country?: string
): Promise<string> {
  const cleanUni = String(universityName || '').trim();
  if (!cleanUni) return '';

  const key = `${(country || '').trim().toLowerCase()}::${cleanUni.toLowerCase()}`;
  if (!globalForUniDomain.__orbisUniDomainCache) {
    globalForUniDomain.__orbisUniDomainCache = new Map();
  }
  const hit = globalForUniDomain.__orbisUniDomainCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.domain;
  }

  try {
    const params = new URLSearchParams({
      search: cleanUni,
      'per-page': '3',
      select: 'display_name,homepage_url,country_code',
    });
    const res = await fetch(`https://api.openalex.org/institutions?${params.toString()}`, {
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const json = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];
    const uniTokens = cleanUni
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && t !== 'university' && t !== 'college');

    for (const r of results) {
      const home = String(r?.homepage_url || '').trim();
      const disp = String(r?.display_name || '').toLowerCase();
      if (!home || !/^https?:\/\//i.test(home)) continue;
      if (uniTokens.length > 0 && !uniTokens.some((t) => disp.includes(t))) continue;
      const host = new URL(home).hostname.replace(/^www\./i, '').toLowerCase();
      if (host) {
        if (globalForUniDomain.__orbisUniDomainCache.size > 500) {
          globalForUniDomain.__orbisUniDomainCache.clear();
        }
        globalForUniDomain.__orbisUniDomainCache.set(key, {
          domain: host,
          expiresAt: Date.now() + DOMAIN_TTL_MS,
        });
        return host;
      }
    }
  } catch {
    // Non-fatal
  }
  return '';
}

export async function searchDomainSitemapCourses(
  domain: string,
  query: string,
  degreeTypes?: string[],
  limit = 2
): Promise<
  Array<{ url: string; title: string; degreeLevel: 'Bachelor' | 'Master' | 'PhD'; score: number }>
> {
  const urls = await getDomainSitemapUrls(domain);
  if (urls.length === 0) return [];

  const corrected = correctSearchTypos(query);
  const phraseSyns = getPhraseSynonyms(corrected);
  const tokens = getProgramKeywords(corrected);
  if (tokens.length === 0 && phraseSyns.length === 0) return [];

  const wantUgOnly =
    Array.isArray(degreeTypes) &&
    degreeTypes.length === 1 &&
    (degreeTypes[0] === 'Undergraduate' || degreeTypes[0] === 'UG Diploma');
  const wantPgOnly =
    Array.isArray(degreeTypes) &&
    degreeTypes.length === 1 &&
    (degreeTypes[0] === 'Masters' || degreeTypes[0] === 'PG Diploma');

  const matches: Array<{
    url: string;
    title: string;
    degreeLevel: 'Bachelor' | 'Master' | 'PhD';
    score: number;
  }> = [];

  for (const url of urls) {
    if (isGenericUniversityUrl(url).isGeneric || NON_COURSE_PATH_RE.test(url)) continue;

    let pathLower = '';
    try {
      pathLower = new URL(url).pathname.toLowerCase();
    } catch {
      continue;
    }

    const looksLikeCoursePath =
      /\/(course|courses|program|programme|programmes|programs|study|postgraduate|undergraduate|degrees)\b/.test(
        pathLower
      ) || /\/(?:msc|bsc|mba|mph|ma|ba|meng|beng|llm|llb|phd)-/.test(pathLower);
    if (!looksLikeCoursePath) continue;

    const slugClean = pathLower.replace(/[-_/]+/g, ' ');
    const allTokensHit =
      tokens.length > 0 && tokens.every((tok) => slugClean.includes(tok));
    const synPhraseHit = phraseSyns.some((syn) => {
      const cleanSyn = syn.trim().toLowerCase();
      if (cleanSyn.length <= 3) {
        return new RegExp(`\\b${cleanSyn}\\b`).test(slugClean);
      }
      return slugClean.includes(cleanSyn);
    });

    if (!allTokensHit && !synPhraseHit) continue;

    const parsed = titleizeCourseSlug(url);
    if (!parsed) continue;
    if (wantUgOnly && parsed.degreeLevel !== 'Bachelor') continue;
    if (wantPgOnly && parsed.degreeLevel !== 'Master') continue;

    let score = allTokensHit ? 100 : 82;
    if (/\/(course|courses|programme|programmes|program|programs)\//.test(pathLower)) score += 15;
    if (parsed.title.toLowerCase().includes(corrected)) score += 20;

    matches.push({
      url,
      title: parsed.title,
      degreeLevel: parsed.degreeLevel,
      score,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.title.length - b.title.length);
  return matches.slice(0, limit);
}
