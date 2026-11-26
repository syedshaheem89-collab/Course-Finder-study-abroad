import { sanitizeHttpUrl } from '@/lib/security/validation';
import { isGenericUniversityUrl } from '@/lib/student-guides';

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
    cache.set(cleanDomain, { urls: [], fetchedAt: now });
    return [];
  }

  let collected: string[] = [];
  if (/<sitemapindex/i.test(rootXml)) {
    const subSitemaps = extractLocUrls(rootXml);
    const prioritized = subSitemaps
      .filter((u) => /course|program|study|postgrad|undergrad|degree|english|\/en\b/i.test(u))
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
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    )
  );
}

export function scoreSitemapCourseUrl(
  url: string,
  programName: string,
  degreeLevel?: string
): { score: number; overlapRatio: number; matchedCount: number } {
  if (!url || isGenericUniversityUrl(url).isGeneric || NON_COURSE_PATH_RE.test(url)) {
    return { score: -1, overlapRatio: 0, matchedCount: 0 };
  }

  let pathLower = url.toLowerCase();
  try {
    pathLower = new URL(url).pathname.toLowerCase();
  } catch {
    return { score: -1, overlapRatio: 0, matchedCount: 0 };
  }

  const tokens = getProgramKeywords(programName);
  if (tokens.length === 0) return { score: 0, overlapRatio: 0, matchedCount: 0 };

  let matchedCount = 0;
  for (const tok of tokens) {
    if (pathLower.includes(tok)) matchedCount += 1;
  }

  const overlapRatio = matchedCount / tokens.length;
  let score = overlapRatio * 100 + matchedCount * 10;

  if (/\/(course|courses|program|programme|programmes|programs|study|postgraduate|undergraduate|master|bachelor|degrees)\b/.test(pathLower)) {
    score += 15;
  }

  const degLower = `${degreeLevel || ''} ${programName}`.toLowerCase();
  if (degLower.includes('mba') && pathLower.includes('mba')) score += 20;
  else if (
    (degLower.includes('master') || degLower.includes('msc')) &&
    /(master|postgrad|msc|ma\b)/.test(pathLower)
  ) {
    score += 10;
  } else if (
    (degLower.includes('bachelor') || degLower.includes('bsc')) &&
    /(bachelor|undergrad|bsc|ba\b)/.test(pathLower)
  ) {
    score += 10;
  }

  return { score, overlapRatio, matchedCount };
}

export async function findCourseUrlInSitemap(
  domain: string,
  programName: string,
  degreeLevel?: string
): Promise<string | undefined> {
  const urls = await getDomainSitemapUrls(domain);
  if (urls.length === 0) return undefined;

  const isMba = /\bmba\b/i.test(programName);
  const scored = urls
    .map((url) => ({
      url,
      ...scoreSitemapCourseUrl(url, programName, degreeLevel),
    }))
    .filter((item) => {
      if (item.score <= 0) return false;
      if (isMba && item.url.toLowerCase().includes('mba') && item.matchedCount >= 1) return true;
      return item.overlapRatio >= 0.6 && item.matchedCount >= 2;
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
