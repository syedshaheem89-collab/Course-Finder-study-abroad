import { sanitizeHttpUrl } from '@/lib/security/validation';

export interface ExternalSearchResult {
  url: string;
  title: string;
  content: string;
  provider: 'serper' | 'brave';
}

const DEFAULT_EXCLUDED_DOMAINS = [
  'shiksha.com',
  'mastersportal.com',
  'bachelorsportal.com',
  'collegedunia.com',
  'idp.com',
  'wikipedia.org',
];

function buildSearchQuery(query: string, siteDomain?: string, excludeDomains?: string[]): string {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return '';
  if (siteDomain) {
    const cleanHost = String(siteDomain || '').replace(/^www\./i, '').trim().toLowerCase();
    if (cleanHost) return `site:${cleanHost} ${cleanQuery}`;
  }
  const exclusions = (excludeDomains && excludeDomains.length > 0 ? excludeDomains : DEFAULT_EXCLUDED_DOMAINS)
    .slice(0, 6)
    .map((d) => `-site:${d}`)
    .join(' ');
  return exclusions ? `${cleanQuery} ${exclusions}` : cleanQuery;
}

export async function runSerperGoogleSearch(params: {
  query: string;
  siteDomain?: string;
  excludeDomains?: string[];
  maxResults?: number;
}): Promise<ExternalSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return [];

  const q = buildSearchQuery(params.query, params.siteDomain, params.excludeDomains);
  if (!q) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        q,
        num: Math.min(10, Math.max(1, params.maxResults ?? 5)),
      }),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const organic: any[] = Array.isArray(json?.organic) ? json.organic : [];
    const out: ExternalSearchResult[] = [];
    for (const item of organic) {
      const url = sanitizeHttpUrl(String(item?.link || ''));
      if (!url) continue;
      out.push({
        url,
        title: String(item?.title || '').trim(),
        content: String(item?.snippet || '').trim(),
        provider: 'serper',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function runBraveWebSearch(params: {
  query: string;
  siteDomain?: string;
  excludeDomains?: string[];
  maxResults?: number;
}): Promise<ExternalSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) return [];

  const q = buildSearchQuery(params.query, params.siteDomain, params.excludeDomains);
  if (!q) return [];

  try {
    const qs = new URLSearchParams({
      q,
      count: String(Math.min(10, Math.max(1, params.maxResults ?? 5))),
    });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${qs.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const results: any[] = Array.isArray(json?.web?.results) ? json.web.results : [];
    const out: ExternalSearchResult[] = [];
    for (const item of results) {
      const url = sanitizeHttpUrl(String(item?.url || ''));
      if (!url) continue;
      out.push({
        url,
        title: String(item?.title || '').trim(),
        content: String(item?.description || '').trim(),
        provider: 'brave',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export interface StudyinfoFinlandHit {
  programName: string;
  universityName: string;
  degreeLevel: 'Bachelor' | 'Master';
  courseUrl: string;
  teachingLanguage: string;
}

export async function fetchStudyinfoFinlandCourses(
  query: string,
  degreeTypes?: string[],
  limit = 4
): Promise<StudyinfoFinlandHit[]> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  const wantUgOnly =
    Array.isArray(degreeTypes) &&
    degreeTypes.length === 1 &&
    (degreeTypes[0] === 'Undergraduate' || degreeTypes[0] === 'UG Diploma');
  const wantPgOnly =
    Array.isArray(degreeTypes) &&
    degreeTypes.length === 1 &&
    (degreeTypes[0] === 'Masters' || degreeTypes[0] === 'PG Diploma');

  try {
    const qs = new URLSearchParams({
      searchTerm: cleanQuery,
      lang: 'en',
      size: String(Math.max(4, Math.min(12, limit * 2))),
    });
    const res = await fetch(
      `https://opintopolku.fi/konfo-backend/external/search/koulutukset?${qs.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Orbis/2026',
        },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const hits: any[] = Array.isArray(json?.hits)
      ? json.hits
      : Array.isArray(json?.results)
      ? json.results
      : Array.isArray(json?.content)
      ? json.content
      : [];

    const out: StudyinfoFinlandHit[] = [];
    const seen = new Set<string>();
    for (const item of hits) {
      const nameObj = item?.nimi || item?.name;
      const programName = String(
        (typeof nameObj === 'string' ? nameObj : nameObj?.en || nameObj?.fi) || ''
      ).trim();
      const orgList = Array.isArray(item?.tarjoajat)
        ? item.tarjoajat
        : Array.isArray(item?.providers)
        ? item.providers
        : [];
      const firstOrg = orgList[0];
      const orgNameObj = firstOrg?.nimi || firstOrg?.name || item?.organisaatioNimi;
      const universityName = String(
        (typeof orgNameObj === 'string' ? orgNameObj : orgNameObj?.en || orgNameObj?.fi) || ''
      ).trim();
      const oid = String(item?.oid || item?.id || '').trim();
      if (!programName || !universityName || !oid) continue;

      const fullLower = `${programName} ${JSON.stringify(item?.koulutustyyppi || item?.educationType || '')}`.toLowerCase();
      const degreeLevel: 'Bachelor' | 'Master' =
        /\b(?:bachelor|amk|ammattikorkeakoulututkinto|kandidaat|undergraduate)\b/.test(fullLower) &&
        !/\b(?:master|yamk|maisteri)\b/.test(fullLower)
          ? 'Bachelor'
          : 'Master';

      if (wantUgOnly && degreeLevel !== 'Bachelor') continue;
      if (wantPgOnly && degreeLevel !== 'Master') continue;

      const courseUrl = sanitizeHttpUrl(`https://opintopolku.fi/konfo/en/koulutus/${encodeURIComponent(oid)}`);
      if (!courseUrl || seen.has(courseUrl)) continue;
      seen.add(courseUrl);

      const langsRaw = Array.isArray(item?.opetuskielet)
        ? item.opetuskielet.join(' ')
        : Array.isArray(item?.teachingLanguages)
        ? item.teachingLanguages.join(' ')
        : 'en';
      const teachingLanguage = /\bfi|finnish\b/i.test(langsRaw) && !/\ben|english\b/i.test(langsRaw)
        ? 'Finnish'
        : 'English';

      out.push({
        programName,
        universityName,
        degreeLevel,
        courseUrl,
        teachingLanguage,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function getActiveSearchAgentsSummary(): {
  tavilyConfigured: boolean;
  serperConfigured: boolean;
  braveConfigured: boolean;
  geminiConfigured: boolean;
} {
  return {
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY?.trim()),
    serperConfigured: Boolean(process.env.SERPER_API_KEY?.trim()),
    braveConfigured: Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim()),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
}
