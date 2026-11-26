import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { STUDY_ABROAD_COUNTRIES, normalizeCountryName } from '@/lib/countries';
import { getCountryVisaIntel } from '@/lib/country-visa-intel';
import { getLivingCostGuide, isGenericUniversityUrl } from '@/lib/student-guides';
import {
  getLivePolicyStore,
  invalidateLivePolicyCache,
  sanitizeCountryOverride,
  saveLivePolicyStore,
} from '@/lib/live-policy-store';
import { LivePolicyUpdateItem } from '@/lib/live-policy-types';
import { searchTavilyOfficialPolicy, verifyCourseLive } from '@/lib/live-course-verifier';

export const maxDuration = 60;

interface RssHeadline {
  title: string;
  link: string;
  pubDate: string;
}

async function fetchCountryHeadlines(country: string): Promise<RssHeadline[]> {
  try {
    const query = `"${country}" ("post-study" OR "stay back" OR "student visa" OR "tuition fee") when:60d`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    return blocks.slice(0, 5).map((b) => ({
      title: (b.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim(),
      pubDate: (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim(),
    })).filter((h) => h.title);
  } catch {
    return [];
  }
}

async function runGeminiGroundedJson(prompt: string, apiKey: string): Promise<{
  parsed: any;
  sources: { title: string; uri: string }[];
} | null> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.15 },
          }),
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]);
      const chunks = json?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: { title: string; uri: string }[] = chunks
        .map((c: any) => c.web)
        .filter((w: any) => w?.uri && !String(w.uri).includes('google.com/search'))
        .slice(0, 4);
      return { parsed, sources };
    } catch {
      // Try fallback model
    }
  }
  return null;
}

async function checkReachableDirectUrl(rawUrl?: string): Promise<string | undefined> {
  const safe = rawUrl ? sanitizeHttpUrl(rawUrl) : null;
  if (!safe) return undefined;
  if (isGenericUniversityUrl(safe).isGeneric) return undefined;
  try {
    let res = await fetch(safe, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Orbis/2026' },
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(safe, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Orbis/2026' },
      });
    }
    if (res.status < 400) {
      const finalUrl = sanitizeHttpUrl(res.url || safe);
      if (finalUrl && !isGenericUniversityUrl(finalUrl).isGeneric) {
        return finalUrl;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function executeAutoUpdate(options: {
  countries?: string[];
  syncFees?: boolean;
  maxCourses?: number;
  triggeredBy: string;
}) {
  const store = await getLivePolicyStore(true);
  const nextOverrides = { ...store.countryOverrides };
  let nextUpdates = [...store.policyUpdates];

  const requestedCountries = (options.countries || [])
    .map((c) => normalizeCountryName(c) || c.trim())
    .filter(Boolean)
    .slice(0, 6);

  const offset = store.lastBatchOffset || 0;
  const batchCountries =
    requestedCountries.length > 0
      ? requestedCountries
      : Array.from({ length: 5 }, (_, i) => STUDY_ABROAD_COUNTRIES[(offset + i) % STUDY_ABROAD_COUNTRIES.length]);

  const nextOffset =
    requestedCountries.length > 0
      ? offset
      : (offset + batchCountries.length) % STUDY_ABROAD_COUNTRIES.length;

  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const policyUpdatedCountries: string[] = [];
  const checkedCountries: string[] = [];
  let newsAddedCount = 0;

  // STEP A: Country Stay-Back / Visa / Show-Money Scan (Tavily Official Sources + Google News + Gemini Search Grounding)
  for (const country of batchCountries) {
    checkedCountries.push(country);
    const [headlines, tavilyOfficial] = await Promise.all([
      fetchCountryHeadlines(country),
      searchTavilyOfficialPolicy(country),
    ]);
    const baseMaster = getCountryVisaIntel(country, 'Master');
    const baseBachelor = getCountryVisaIntel(country, 'Bachelor');
    const basePhd = getCountryVisaIntel(country, 'PhD');
    const baseLiving = getLivingCostGuide(country);

    if (!apiKey) {
      if (headlines[0]) {
        const cleanNewsUrl = sanitizeHttpUrl(headlines[0].link) || undefined;
        const item: LivePolicyUpdateItem = {
          country,
          title: headlines[0].title.slice(0, 140),
          summary: `Latest international student briefing in ${country}. Verify current rules before visa filing.`,
          tag: 'Visa & Stay-Back',
          publishedAt: headlines[0].pubDate || new Date().toISOString(),
          sourceUrl: cleanNewsUrl,
          sourceName: 'Live Education Feed',
        };
        const exists = nextUpdates.some(
          (u) => u.country.toLowerCase() === country.toLowerCase() && u.title.toLowerCase() === item.title.toLowerCase()
        );
        if (!exists) {
          nextUpdates = [item, ...nextUpdates].slice(0, 30);
          newsAddedCount += 1;
        }
      }
      continue;
    }

    const prompt = `Verify the latest official 2026 international student post-study stay-back work visa rules and visa living funds proof for ${country}.
Current baseline in our directory:
- Master stayBackYears: ${baseMaster.stayBackYears}
- Bachelor stayBackYears: ${baseBachelor.stayBackYears ?? baseMaster.stayBackYears}
- PhD stayBackYears: ${basePhd.phdStayBackYears ?? baseMaster.stayBackYears}
- Living Funds Proof (EUR/yr): ${baseLiving.amountEur} (${baseLiving.note})
Recent headlines:
${headlines.map((h) => `- ${h.title}`).join('\n') || '- None returned'}
Official web snippets (consultancy blogs filtered out):
${tavilyOfficial.map((t) => `- [${t.url}] ${t.title}: ${t.content}`).join('\n') || '- None returned'}

Use official government/immigration portals ONLY (ignore generic consultancy blogs). Only set "policyChanged": true and "confidence": "high" if official law/government sources prove post-study work duration or official financial proof materially differs from our current baseline.
Return ONLY valid JSON:
{
  "policyChanged": boolean,
  "confidence": "high" | "medium" | "low",
  "stayBackYears": number,
  "bachelorStayBackYears": number,
  "phdStayBackYears": number,
  "visaSummary": string,
  "showMoneyEur": number,
  "showMoneyNote": string,
  "officialSourceUrl": string,
  "newsUpdate": {
    "title": string,
    "summary": string,
    "tag": "Visa & Stay-Back" | "Tuition & Fees" | "Eligibility" | "Scholarships"
  } | null
}`;

    const grounded = await runGeminiGroundedJson(prompt, apiKey);
    if (!grounded?.parsed) continue;

    const { parsed, sources } = grounded;
    const groundedUri =
      sources.find((s) => !String(s.uri).includes('vertexaisearch'))?.uri ||
      sanitizeHttpUrl(String(parsed.officialSourceUrl || '')) ||
      sources[0]?.uri;

    if (parsed.policyChanged === true && parsed.confidence === 'high' && groundedUri) {
      const candidate = sanitizeCountryOverride({
        country,
        stayBackYears: parsed.stayBackYears,
        bachelorStayBackYears: parsed.bachelorStayBackYears,
        phdStayBackYears: parsed.phdStayBackYears,
        visaSummary: parsed.visaSummary,
        showMoneyEur: parsed.showMoneyEur,
        showMoneyNote: parsed.showMoneyNote,
        sourceUrl: groundedUri,
        sourceTitle: sources[0]?.title || 'Official Immigration Update',
        lastVerifiedAt: new Date().toISOString(),
        autoUpdated: true,
      });

      if (candidate) {
        nextOverrides[country] = candidate;
        policyUpdatedCountries.push(country);
      }
    } else if (nextOverrides[country]) {
      nextOverrides[country] = {
        ...nextOverrides[country],
        lastVerifiedAt: new Date().toISOString(),
      };
    }

    if (parsed.newsUpdate && parsed.newsUpdate.title && parsed.newsUpdate.summary) {
      const allowedTags = new Set(['Visa & Stay-Back', 'Tuition & Fees', 'Eligibility', 'Scholarships']);
      const newsItem: LivePolicyUpdateItem = {
        country,
        title: String(parsed.newsUpdate.title).trim().slice(0, 140),
        summary: String(parsed.newsUpdate.summary).trim().slice(0, 320),
        tag: allowedTags.has(parsed.newsUpdate.tag) ? parsed.newsUpdate.tag : 'Visa & Stay-Back',
        publishedAt: new Date().toISOString(),
        sourceUrl: groundedUri || undefined,
        sourceName: sources[0]?.title || 'Verified Policy Monitor',
      };
      const exists = nextUpdates.some(
        (u) => u.country.toLowerCase() === country.toLowerCase() && u.title.toLowerCase() === newsItem.title.toLowerCase()
      );
      if (!exists) {
        nextUpdates = [newsItem, ...nextUpdates].slice(0, 30);
        newsAddedCount += 1;
      }
    }
  }

  // STEP B: Non-destructive DAAD & Live Course Fee + Direct URL Refresh
  let daadUpdatedCount = 0;
  let courseLinksUpdatedCount = 0;

  if (options.syncFees !== false) {
    try {
      const supabase = createServerSupabaseClient();

      // B1. Refresh up to 30 existing Germany courses against live DAAD API
      try {
        const daadRes = await fetch(
          'https://www2.daad.de/deutschland/studienangebote/international-programmes/api/solr/en/search.json?degree%5B%5D=1&degree%5B%5D=2&lang%5B%5D=2&limit=30&offset=0&display=list',
          { headers: { 'User-Agent': 'Orbis/2026' }, signal: AbortSignal.timeout(7000), cache: 'no-store' }
        );
        if (daadRes.ok) {
          const daadJson = await daadRes.json();
          const daadItems: any[] = daadJson?.courses || [];
          if (daadItems.length > 0) {
            const { data: germanUnis } = await supabase
              .from('universities')
              .select('id, name')
              .ilike('country', 'Germany');
            const uniByName = new Map<string, string>();
            (germanUnis || []).forEach((u: any) => uniByName.set(u.name.trim().toLowerCase(), u.id));

            const uniIds = Array.from(uniByName.values());
            if (uniIds.length > 0) {
              const { data: existingGerman } = await supabase
                .from('courses')
                .select('id, university_id, program_name, tuition_fees_eur, course_url')
                .in('university_id', uniIds)
                .limit(500);
              const existingMap = new Map<string, any>();
              (existingGerman || []).forEach((c: any) => {
                existingMap.set(`${c.university_id}::${c.program_name.trim().toLowerCase()}`, c);
              });

              for (const item of daadItems) {
                const uniId = uniByName.get(String(item.academy || '').trim().toLowerCase());
                const progName = String(item.courseName || item.courseNameShort || '').trim();
                if (!uniId || !progName) continue;
                const match = existingMap.get(`${uniId}::${progName.toLowerCase()}`);
                if (!match) continue;

                let tuitionEur = 0;
                const feeText = String(item.tuitionFees || '');
                if (!feeText.toLowerCase().includes('no tuition')) {
                  const numMatch = feeText.replace(/,/g, '').match(/\d+/);
                  if (numMatch) tuitionEur = Number(numMatch[0]);
                }
                const officialUrl = item.link
                  ? `https://www2.daad.de${item.link}`
                  : undefined;

                const patch: Record<string, any> = {};
                if (Number.isFinite(tuitionEur) && tuitionEur !== Number(match.tuition_fees_eur)) {
                  patch.tuition_fees_eur = tuitionEur;
                }
                if (officialUrl && (!match.course_url || !String(match.course_url).includes('daad.de'))) {
                  patch.course_url = officialUrl;
                }
                if (Object.keys(patch).length > 0) {
                  const { error } = await supabase.from('courses').update(patch).eq('id', match.id);
                  if (!error) daadUpdatedCount += 1;
                }
              }
            }
          }
        }
      } catch {
        // Non-fatal
      }

      // B2. Refresh generic/unverified DB course URLs & tuition fees via Tavily + Jina + Multi-AI Consensus
      if (apiKey || process.env.TAVILY_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim()) {
        const maxCourses = Math.min(5, Math.max(1, Number(options.maxCourses || 3)));
        const { data: candidateRows } = await supabase
          .from('courses')
          .select('id, program_name, degree_level, tuition_fees_eur, intake_months, course_url, raw_excel_data, university:universities(name, country)')
          .order('created_at', { ascending: false })
          .limit(35);

        const needingFix = (candidateRows || [])
          .filter((c: any) => {
            const rawVerified = c.raw_excel_data && typeof c.raw_excel_data === 'object'
              ? c.raw_excel_data['Last Live Verified']
              : null;
            return isGenericUniversityUrl(c.course_url).isGeneric || !rawVerified;
          })
          .slice(0, maxCourses);

        for (const course of needingFix) {
          const uniRel = Array.isArray(course.university) ? course.university[0] : course.university;
          const uniName = uniRel?.name || '';
          const country = uniRel?.country || '';
          if (!uniName || !country) continue;

          const { snapshot } = await verifyCourseLive({
            courseId: course.id,
            programName: course.program_name,
            universityName: uniName,
            country,
            degreeLevel: course.degree_level,
            courseUrl: course.course_url,
            forceRefresh: true,
          });

          const patch: Record<string, any> = {
            raw_excel_data: {
              ...(course.raw_excel_data && typeof course.raw_excel_data === 'object' ? course.raw_excel_data : {}),
              'Last Live Verified': snapshot.verifiedAt,
              'Verification Consensus': snapshot.consensusStatus,
              ...(snapshot.verifiedDomain ? { 'Verified Source': snapshot.verifiedDomain } : {}),
              ...(snapshot.tuitionQuote ? { 'Verified Fee Quote': snapshot.tuitionQuote } : {}),
            },
          };
          let changed = false;
          if (snapshot.officialUrl && snapshot.officialUrl !== course.course_url) {
            patch.course_url = snapshot.officialUrl;
            changed = true;
          }
          if (
            snapshot.tuitionFeesEur !== null &&
            snapshot.tuitionFeesEur !== undefined &&
            snapshot.tuitionFeesEur >= 0 &&
            snapshot.tuitionFeesEur <= 120000 &&
            snapshot.tuitionFeesEur !== Number(course.tuition_fees_eur)
          ) {
            patch.tuition_fees_eur = Math.round(snapshot.tuitionFeesEur);
            changed = true;
          }
          if (Array.isArray(snapshot.intakes) && snapshot.intakes.length > 0) {
            patch.intake_months = snapshot.intakes.slice(0, 4);
          }

          const { error } = await supabase.from('courses').update(patch).eq('id', course.id);
          if (!error && changed) courseLinksUpdatedCount += 1;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const nowIso = new Date().toISOString();
  const summary = `Checked ${checkedCountries.length} countries (${policyUpdatedCountries.length} policy shifts, ${newsAddedCount} news updates, ${daadUpdatedCount} DAAD + ${courseLinksUpdatedCount} course URL/fee refreshes).`;

  await saveLivePolicyStore(
    {
      countryOverrides: nextOverrides,
      policyUpdates: nextUpdates,
      lastAutoSyncAt: nowIso,
      lastFeeSyncAt: options.syncFees !== false ? nowIso : store.lastFeeSyncAt,
      lastSyncSummary: summary,
      lastBatchOffset: nextOffset,
    },
    options.triggeredBy
  );

  invalidateLivePolicyCache();

  return {
    success: true,
    syncedAt: nowIso,
    summary,
    checkedCountries,
    policyUpdatedCountries,
    newsAddedCount,
    daadUpdatedCount,
    courseLinksUpdatedCount,
    nextBatchOffset: nextOffset,
  };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get('authorization') || '';
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  let authorized = false;
  if (cronSecret) {
    authorized = authHeader === `Bearer ${cronSecret}`;
  } else if (isVercelCron) {
    authorized = true;
  }

  if (!authorized) {
    const adminAuth = await requireAdminSession(req);
    if (!adminAuth.ok) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized cron trigger' },
        { status: 401 }
      );
    }
  }

  const result = await executeAutoUpdate({
    syncFees: true,
    triggeredBy: 'vercel-cron',
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = await executeAutoUpdate({
    countries: Array.isArray(body.countries) ? body.countries : undefined,
    syncFees: body.syncFees !== false,
    maxCourses: body.maxCourses ? Number(body.maxCourses) : 3,
    triggeredBy: auth.session.email,
  });
  return NextResponse.json(result);
}
