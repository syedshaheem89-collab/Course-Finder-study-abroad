import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/security/session';
import { normalizeCountryName } from '@/lib/countries';
import { getCachedUniversities } from '@/lib/universities-cache';
import { listCuratedUniversities } from '@/lib/country-curated-fallback';
import { callGroqFreeJson } from '@/lib/groq-client';
import {
  classifyUniversityType,
  matchesPrivateUniversityPattern,
  UniversitySector,
} from '@/lib/university-classification';

export interface UniversitySuggestionItem {
  id: string;
  name: string;
  country: string;
  source: 'db' | 'catalogue' | 'global';
  sector: UniversitySector;
  sectorSource: 'catalogue' | 'rules' | 'ai' | 'default';
}

const COUNTRY_TO_ISO2: Record<string, string> = {
  Albania: 'AL',
  Australia: 'AU',
  Austria: 'AT',
  Belgium: 'BE',
  Bulgaria: 'BG',
  Canada: 'CA',
  Cyprus: 'CY',
  'Czech Republic': 'CZ',
  Denmark: 'DK',
  Estonia: 'EE',
  Finland: 'FI',
  France: 'FR',
  Georgia: 'GE',
  Germany: 'DE',
  Hungary: 'HU',
  Ireland: 'IE',
  Italy: 'IT',
  Japan: 'JP',
  Latvia: 'LV',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Malta: 'MT',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Norway: 'NO',
  Poland: 'PL',
  Portugal: 'PT',
  Singapore: 'SG',
  'South Korea': 'KR',
  Spain: 'ES',
  Sweden: 'SE',
  Switzerland: 'CH',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  USA: 'US',
};

const OPENALEX_TTL_MS = 30 * 60_000;

const globalForUniSuggest = globalThis as unknown as {
  __orbisOpenAlexCache?: Map<string, { items: { id: string; name: string }[]; expiresAt: number }>;
  __orbisUniSectorCache?: Map<string, UniversitySector>;
};

function getOpenAlexCache() {
  if (!globalForUniSuggest.__orbisOpenAlexCache) {
    globalForUniSuggest.__orbisOpenAlexCache = new Map();
  }
  return globalForUniSuggest.__orbisOpenAlexCache;
}

function getUniSectorCache() {
  if (!globalForUniSuggest.__orbisUniSectorCache) {
    globalForUniSuggest.__orbisUniSectorCache = new Map();
  }
  return globalForUniSuggest.__orbisUniSectorCache;
}

function sectorCacheKey(country: string, name: string): string {
  return `${country.trim().toLowerCase()}::${name.trim().toLowerCase()}`;
}

async function fetchOpenAlexUniversities(
  iso2: string,
  query: string
): Promise<{ id: string; name: string }[]> {
  const cleanQ = query.trim();
  const key = `${iso2}::${cleanQ.toLowerCase()}`;
  const cache = getOpenAlexCache();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.items;
  }

  try {
    const params = new URLSearchParams({
      filter: `country_code:${iso2},type:education`,
      'per-page': '15',
      select: 'id,display_name',
    });
    if (cleanQ.length >= 2) {
      params.set('search', cleanQ);
    } else {
      params.set('sort', 'works_count:desc');
    }

    const res = await fetch(`https://api.openalex.org/institutions?${params.toString()}`, {
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(3500),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rawResults = Array.isArray(json?.results) ? json.results : [];
    const items = rawResults
      .map((r: any) => ({
        id: `oa-${String(r?.id || '').split('/').pop() || Math.random().toString(36).slice(2, 8)}`,
        name: String(r?.display_name || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((r: { id: string; name: string }) => r.name.length >= 2);

    if (cache.size > 400) cache.clear();
    cache.set(key, { items, expiresAt: Date.now() + OPENALEX_TTL_MS });
    return items;
  } catch {
    return [];
  }
}

async function detectSectorsWithAi(
  country: string,
  names: string[]
): Promise<Map<string, UniversitySector>> {
  const result = new Map<string, UniversitySector>();
  const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n.length >= 3))).slice(0, 8);
  if (uniqueNames.length === 0) return result;

  const prompt = `Classify each university or higher-education institution in "${country || 'the listed country'}" strictly as "Public" (state-funded / public university) or "Private" (private university, private medical school, for-profit or independent private college).
Universities:
${uniqueNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY valid JSON:
{
  "sectors": {
    "Exact University Name": "Public" | "Private"
  }
}`;

  try {
    const raw = await callGroqFreeJson(prompt);
    if (!raw) return result;
    const parsed = JSON.parse(raw);
    const mapObj = parsed?.sectors && typeof parsed.sectors === 'object' ? parsed.sectors : {};
    const cache = getUniSectorCache();
    if (cache.size > 1500) cache.clear();

    for (const originalName of uniqueNames) {
      const exactVal = mapObj[originalName];
      const fallbackEntry = Object.entries(mapObj).find(
        ([k]) => k.trim().toLowerCase() === originalName.toLowerCase()
      );
      const valStr = String(exactVal ?? fallbackEntry?.[1] ?? '').trim().toLowerCase();
      if (valStr === 'public' || valStr === 'private') {
        const sector: UniversitySector = valStr === 'private' ? 'Private' : 'Public';
        result.set(originalName.toLowerCase(), sector);
        cache.set(sectorCacheKey(country, originalName), sector);
      }
    }
  } catch {
    // Non-fatal: deterministic rules fallback will still classify cleanly
  }

  return result;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawCountry = String(searchParams.get('country') || '').trim();
    const country = normalizeCountryName(rawCountry) || rawCountry || 'United Kingdom';
    const q = String(searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const qLower = q.toLowerCase();
    const shouldDetect = searchParams.get('detect') === '1' || searchParams.get('detect') === 'true';

    const countryLower = country.toLowerCase();
    const iso2 = COUNTRY_TO_ISO2[country] || '';

    // Layers 1 & 2: Supabase DB + Built-in 35-Country Curated Catalogue
    const [dbUnis, curatedUnis] = await Promise.all([
      getCachedUniversities(false),
      Promise.resolve(listCuratedUniversities(country)),
    ]);

    const dbInCountry = dbUnis.filter(
      (u) => (normalizeCountryName(u.country) || u.country || '').toLowerCase() === countryLower
    );

    const byLowerName = new Map<string, UniversitySuggestionItem>();

    const matchesQuery = (name: string) =>
      !qLower || name.toLowerCase().includes(qLower);

    for (const u of dbInCountry) {
      if (!matchesQuery(u.name)) continue;
      const k = u.name.trim().toLowerCase();
      if (byLowerName.has(k)) continue;
      const isRulePrivate = matchesPrivateUniversityPattern(u.name, country);
      byLowerName.set(k, {
        id: u.id,
        name: u.name.trim(),
        country,
        source: 'db',
        sector: isRulePrivate ? 'Private' : classifyUniversityType(u.name, country),
        sectorSource: isRulePrivate ? 'rules' : 'default',
      });
    }

    for (const u of curatedUnis) {
      if (!matchesQuery(u.name)) continue;
      const k = u.name.trim().toLowerCase();
      const existing = byLowerName.get(k);
      if (existing) {
        // Enrich DB row with curated sector knowledge if DB row was defaulted
        if (existing.sectorSource === 'default') {
          existing.sector = u.sector;
          existing.sectorSource = 'catalogue';
        }
        continue;
      }
      byLowerName.set(k, {
        id: u.id,
        name: u.name.trim(),
        country,
        source: 'catalogue',
        sector: u.sector,
        sectorSource: 'catalogue',
      });
    }

    const totalLocal = dbInCountry.length + curatedUnis.length;

    // Layer 3: Free OpenAlex Global Institutions API (always covers all 35 countries cleanly)
    if (iso2 && (q.length >= 2 || totalLocal < 10)) {
      const globalHits = await fetchOpenAlexUniversities(iso2, q);
      for (const g of globalHits) {
        if (!matchesQuery(g.name)) continue;
        const k = g.name.trim().toLowerCase();
        if (byLowerName.has(k)) continue;
        const isRulePrivate = matchesPrivateUniversityPattern(g.name, country);
        byLowerName.set(k, {
          id: g.id,
          name: g.name,
          country,
          source: 'global',
          sector: isRulePrivate ? 'Private' : classifyUniversityType(g.name, country),
          sectorSource: isRulePrivate ? 'rules' : 'default',
        });
      }
    }

    const sourceOrder = { db: 0, catalogue: 1, global: 2 };
    const sorted = Array.from(byLowerName.values())
      .sort((a, b) => {
        if (qLower) {
          const aExact = a.name.toLowerCase() === qLower ? 0 : 1;
          const bExact = b.name.toLowerCase() === qLower ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          const aPref = a.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          const bPref = b.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          if (aPref !== bPref) return aPref - bPref;
        }
        const sDiff = sourceOrder[a.source] - sourceOrder[b.source];
        if (sDiff !== 0) return sDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 20);

    // Layer 4: Instant cache + batched free AI detection for unknown Public/Private institutions
    const sectorCache = getUniSectorCache();
    const unknownForAi: string[] = [];

    for (const item of sorted) {
      if (item.sectorSource === 'catalogue' || item.sectorSource === 'rules') continue;
      const cached = sectorCache.get(sectorCacheKey(country, item.name));
      if (cached) {
        item.sector = cached;
        item.sectorSource = 'ai';
      } else {
        unknownForAi.push(item.name);
      }
    }

    let typedMatch = qLower
      ? sorted.find((s) => s.name.toLowerCase() === qLower) ||
        sorted.find((s) => s.name.toLowerCase().startsWith(qLower))
      : undefined;

    let detected: { sector: UniversitySector; source: 'catalogue' | 'rules' | 'ai' | 'default' } | null = null;

    if (shouldDetect && q.length >= 3) {
      if (typedMatch && (typedMatch.sectorSource === 'catalogue' || typedMatch.sectorSource === 'rules' || typedMatch.sectorSource === 'ai')) {
        detected = { sector: typedMatch.sector, source: typedMatch.sectorSource };
      } else if (matchesPrivateUniversityPattern(q, country)) {
        detected = { sector: 'Private', source: 'rules' };
      } else {
        const cachedTyped = sectorCache.get(sectorCacheKey(country, q));
        if (cachedTyped) {
          detected = { sector: cachedTyped, source: 'ai' };
        } else if (q.length >= 4) {
          unknownForAi.unshift(q);
        }
      }
    }

    if (shouldDetect && unknownForAi.length > 0) {
      const aiMap = await detectSectorsWithAi(country, unknownForAi);
      for (const item of sorted) {
        const hit = aiMap.get(item.name.toLowerCase());
        if (hit) {
          item.sector = hit;
          item.sectorSource = 'ai';
        }
      }
      if (!detected && q.length >= 3) {
        const typedAi = aiMap.get(qLower) || (typedMatch ? aiMap.get(typedMatch.name.toLowerCase()) : undefined);
        if (typedAi) {
          detected = { sector: typedAi, source: 'ai' };
        }
      }
    }

    if (shouldDetect && q.length >= 3 && !detected) {
      typedMatch = sorted.find((s) => s.name.toLowerCase() === qLower) || typedMatch;
      if (typedMatch) {
        detected = { sector: typedMatch.sector, source: typedMatch.sectorSource };
      } else {
        detected = { sector: classifyUniversityType(q, country), source: 'default' };
      }
    }

    return NextResponse.json({
      success: true,
      country,
      totalLocal,
      suggestions: sorted,
      detected,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to suggest universities' },
      { status: 500 }
    );
  }
}
