import { sanitizeHttpUrl } from '@/lib/security/validation';
import { isGenericUniversityUrl } from '@/lib/student-guides';
import {
  callGeminiOnlyJson,
  callGroqFreeJson,
  callGroqOnlyJson,
  callOpenAiOnlyJson,
} from '@/lib/groq-client';
import { convertCurrencyToEur, normalizeCurrencyCode } from '@/lib/live-fx';
import {
  getCachedCourseVerification,
  makeCourseVerifyKey,
  saveCourseVerificationSnapshot,
  VerificationConsensusStatus,
  VerifiedCourseSnapshot,
} from '@/lib/course-verification-cache';

export const THIRD_PARTY_EXCLUDED_DOMAINS = [
  'shiksha.com',
  'collegedunia.com',
  'yocket.com',
  'leverageedu.com',
  'idp.com',
  'mastersportal.com',
  'bachelorsportal.com',
  'educations.com',
  'topuniversities.com',
  'timeshighereducation.com',
  'hotcoursesabroad.com',
  'edurank.org',
  'wikipedia.org',
  'reddit.com',
  'quora.com',
  'facebook.com',
  'linkedin.com',
  'youtube.com',
  'instagram.com',
  'studee.com',
  'applyboard.com',
];

export interface SearchCandidatePage {
  url: string;
  title: string;
  snippet: string;
  rawContent?: string;
  score: number;
}

export function extractDomainHost(rawUrl?: string | null): string {
  const raw = String(rawUrl || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (
      host.includes('google.') ||
      host.includes('study-abroad.edu') ||
      host.includes('vertexaisearch')
    ) {
      return '';
    }
    return host;
  } catch {
    return '';
  }
}

export function numberAppearsInPageText(amount: number, pageText: string): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false;
  const cleanText = String(pageText || '');
  if (!cleanText) return false;

  const rounded = Math.round(amount);
  if (rounded === 0) {
    return /no\s*tuition|tuition[- ]?free|free\s+of\s+charge|no\s+programme\s+fees|(?:^|[^0-9.,])(?:€\s*0|0\s*eur)(?:[^0-9]|$)/i.test(
      cleanText
    );
  }

  const rawStr = String(rounded);
  const commaStr = rawStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dotStr = rawStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const spaceStr = rawStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const variants = Array.from(new Set([rawStr, commaStr, dotStr, spaceStr])).map((v) =>
    v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const re = new RegExp(`(?:^|[^0-9])(?:${variants.join('|')})(?:[^0-9]|$)`);
  return re.test(cleanText);
}

async function runTavilySearch(params: {
  query: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
  includeRawContent?: boolean;
}): Promise<any[]> {
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (!tavilyKey) return [];

  try {
    const body: Record<string, any> = {
      api_key: tavilyKey,
      query: params.query,
      topic: 'general',
      search_depth: 'advanced',
      max_results: params.maxResults ?? 4,
      include_answer: false,
      include_raw_content: params.includeRawContent ? 'markdown' : false,
    };
    if (params.includeDomains && params.includeDomains.length > 0) {
      body.include_domains = params.includeDomains;
    }
    if (params.excludeDomains && params.excludeDomains.length > 0) {
      body.exclude_domains = params.excludeDomains;
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.results) ? json.results : [];
  } catch {
    return [];
  }
}

export async function searchTavilyOfficialPolicy(
  country: string
): Promise<{ title: string; url: string; content: string }[]> {
  const results = await runTavilySearch({
    query: `"${country}" official government immigration post-study work stay-back student visa financial proof 2026`,
    excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
    maxResults: 4,
    includeRawContent: false,
  });
  return results
    .map((r: any) => ({
      title: String(r?.title || '').trim(),
      url: sanitizeHttpUrl(String(r?.url || '')) || '',
      content: String(r?.content || '').trim().slice(0, 700),
    }))
    .filter((r) => Boolean(r.url && r.content));
}

function scoreCandidatePage(
  url: string,
  title: string,
  knownHost: string,
  programName: string
): number {
  let score = 0;
  const host = extractDomainHost(url);
  if (!host) return -100;
  if (THIRD_PARTY_EXCLUDED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return -100;
  }

  if (knownHost && (host === knownHost || host.endsWith(`.${knownHost}`))) {
    score += 55;
  }
  if (/\.(edu|ac\.[a-z]{2}|uni-[a-z-]+|edu\.[a-z]{2})$/i.test(host) || host.includes('university') || host.includes('daad.de')) {
    score += 25;
  }
  if (!isGenericUniversityUrl(url).isGeneric) {
    score += 25;
  }

  const hay = `${url} ${title}`.toLowerCase();
  const progTokens = programName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !['msc', 'bsc', 'and', 'the', 'for', 'with'].includes(t));
  for (const tok of progTokens.slice(0, 5)) {
    if (hay.includes(tok)) score += 8;
  }
  if (/tuition|fee|international|admission|program|course|master|bachelor/.test(hay)) {
    score += 10;
  }
  return score;
}

async function fetchJinaReaderText(targetUrl: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: { Accept: 'text/plain', 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const txt = await res.text();
    return txt.trim().slice(0, 8000);
  } catch {
    return '';
  }
}

async function fetchDirectHtmlText(targetUrl: string): Promise<string> {
  try {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(4500),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const html = await res.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, 8000);
  } catch {
    return '';
  }
}

async function verifyUrlReachable(
  rawUrl?: string | null
): Promise<{ reachable: boolean; finalUrl?: string; wasDirect: boolean }> {
  const safe = rawUrl ? sanitizeHttpUrl(rawUrl) : null;
  if (!safe) return { reachable: false, wasDirect: false };
  try {
    let res = await fetch(safe, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'Orbis/2026' },
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(safe, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'Orbis/2026' },
      });
    }
    const finalUrl = sanitizeHttpUrl(res.url || safe) || safe;
    const isDirect = !isGenericUniversityUrl(finalUrl).isGeneric;
    return {
      reachable: res.status < 400 || res.status === 403,
      finalUrl,
      wasDirect: isDirect,
    };
  } catch {
    return { reachable: false, wasDirect: false };
  }
}

interface ParsedExtraction {
  provider: string;
  model: string;
  tuitionAmount: number | null;
  tuitionCurrency: string;
  tuitionEur: number | null;
  tuitionQuote: string | null;
  academicYear: string | null;
  min12thPercent: number | null;
  minDegreePercent: number | null;
  minIelts: number | null;
  englishPolicy: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED';
  intakes: string[];
  subjectRequirements: string;
  summary: string;
}

async function parseSingleExtraction(
  raw: { provider: string; model: string; content: string } | null,
  pageText: string
): Promise<ParsedExtraction | null> {
  if (!raw?.content) return null;
  try {
    const match = raw.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw.content);

    let rawAmount: number | null =
      parsed.tuitionAmount !== null && parsed.tuitionAmount !== undefined && parsed.tuitionAmount !== ''
        ? Number(String(parsed.tuitionAmount).replace(/,/g, ''))
        : null;
    if (rawAmount !== null && (!Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > 250000)) {
      rawAmount = null;
    }

    // Programmatic grounding check: only accept fee if it is genuinely printed in the fetched page text
    if (rawAmount !== null && !numberAppearsInPageText(rawAmount, pageText)) {
      rawAmount = null;
    }

    const currency = normalizeCurrencyCode(parsed.tuitionCurrency);
    let tuitionEur: number | null = null;
    if (rawAmount !== null) {
      const fx = await convertCurrencyToEur(rawAmount, currency);
      tuitionEur = fx.eur;
    }

    const min12th =
      parsed.min12thPercent !== null && Number.isFinite(Number(parsed.min12thPercent))
        ? Math.min(100, Math.max(35, Number(parsed.min12thPercent)))
        : null;
    const minDeg =
      parsed.minDegreePercent !== null && Number.isFinite(Number(parsed.minDegreePercent))
        ? Math.min(100, Math.max(35, Number(parsed.minDegreePercent)))
        : null;
    const minIelts =
      parsed.minIelts !== null && Number.isFinite(Number(parsed.minIelts))
        ? Math.min(9, Math.max(4, Number(parsed.minIelts)))
        : null;

    const engRaw = String(parsed.englishPolicy || 'IELTS_TOEFL').toUpperCase();
    const englishPolicy: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' =
      engRaw === 'MOI_ACCEPTED' || engRaw === 'WAIVED' ? engRaw : 'IELTS_TOEFL';

    return {
      provider: raw.provider,
      model: raw.model,
      tuitionAmount: rawAmount !== null ? Math.round(rawAmount) : null,
      tuitionCurrency: currency,
      tuitionEur,
      tuitionQuote: parsed.tuitionQuote ? String(parsed.tuitionQuote).trim().slice(0, 240) : null,
      academicYear: parsed.academicYear ? String(parsed.academicYear).trim().slice(0, 20) : null,
      min12thPercent: min12th,
      minDegreePercent: minDeg,
      minIelts,
      englishPolicy,
      intakes: Array.isArray(parsed.intakes)
        ? parsed.intakes.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4)
        : [],
      subjectRequirements: String(parsed.subjectRequirements || '').trim().slice(0, 240),
      summary: String(parsed.summary || '').trim().slice(0, 320),
    };
  } catch {
    return null;
  }
}

export async function verifyCourseLive(params: {
  courseId?: string;
  programName: string;
  universityName: string;
  country: string;
  degreeLevel?: string;
  courseUrl?: string;
  forceRefresh?: boolean;
}): Promise<{ snapshot: VerifiedCourseSnapshot; fromCache: boolean }> {
  const {
    courseId,
    programName,
    universityName,
    country,
    degreeLevel,
    courseUrl,
    forceRefresh = false,
  } = params;

  const verifyKey = makeCourseVerifyKey(country, universityName, programName);
  if (!forceRefresh) {
    const cached = await getCachedCourseVerification(country, universityName, programName, 60);
    if (cached) {
      return { snapshot: cached, fromCache: true };
    }
  }

  const isUg =
    (degreeLevel || '').toLowerCase().includes('bachelor') ||
    (degreeLevel || '').toLowerCase().includes('undergraduate') ||
    (degreeLevel || '').toLowerCase().includes('ug');

  const knownHost = extractDomainHost(courseUrl);
  let searchProvider: 'tavily' | 'gemini-grounding' | 'fallback' = 'fallback';
  const candidates: SearchCandidatePage[] = [];

  // STEP 1: Official Domain-Locked Web Discovery (Tavily primary, Gemini Grounding fallback)
  if (process.env.TAVILY_API_KEY?.trim()) {
    const seenUrls = new Set<string>();
    const pushResults = (rows: any[]) => {
      for (const r of rows) {
        const cleanUrl = sanitizeHttpUrl(String(r?.url || ''));
        if (!cleanUrl || seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);
        const title = String(r?.title || '').trim();
        const snippet = String(r?.content || '').trim();
        const rawContent = typeof r?.raw_content === 'string' ? r.raw_content.trim() : undefined;
        const score = scoreCandidatePage(cleanUrl, title, knownHost, programName);
        if (score >= 0) {
          candidates.push({ url: cleanUrl, title, snippet, rawContent, score });
        }
      }
    };

    if (knownHost) {
      const domainRows = await runTavilySearch({
        query: `"${programName}" international tuition fees entry requirements ${country}`,
        includeDomains: [knownHost],
        maxResults: 4,
        includeRawContent: true,
      });
      pushResults(domainRows);
    }

    const hasDirectCandidate = candidates.some((c) => !isGenericUniversityUrl(c.url).isGeneric);
    if (!knownHost || !hasDirectCandidate) {
      const openRows = await runTavilySearch({
        query: `"${universityName}" "${programName}" ${country} official international tuition fees`,
        excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
        maxResults: 5,
        includeRawContent: true,
      });
      pushResults(openRows);
    }

    if (candidates.length > 0) {
      searchProvider = 'tavily';
    }
  }

  // Fallback URL discovery via Gemini Google Search Grounding if Tavily unavailable or returned 0
  if (candidates.length === 0 && process.env.GEMINI_API_KEY?.trim()) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
            process.env.GEMINI_API_KEY.trim()
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(9000),
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Find the exact official university course URL for: ${universityName} (${country}) — ${programName} (${degreeLevel || 'Degree'}). Return JSON {"officialUrl": string | null}.`,
                    },
                  ],
                },
              ],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.1 },
            }),
          }
        );
        if (!gRes.ok) continue;
        const gJson = await gRes.json();
        const chunks = gJson?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const ch of chunks) {
          const uri = sanitizeHttpUrl(String(ch?.web?.uri || ''));
          if (uri && !uri.includes('vertexaisearch') && !uri.includes('google.com')) {
            const title = String(ch?.web?.title || '').trim();
            const score = scoreCandidatePage(uri, title, knownHost, programName);
            if (score >= 0) {
              candidates.push({ url: uri, title, snippet: '', score });
            }
          }
        }
        const rawTxt: string = gJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const m = rawTxt.match(/\{[\s\S]*\}/);
        if (m) {
          const p = JSON.parse(m[0]);
          const u = p?.officialUrl ? sanitizeHttpUrl(String(p.officialUrl)) : null;
          if (u && !u.includes('google.com')) {
            const score = scoreCandidatePage(u, programName, knownHost, programName);
            if (score >= 0) {
              candidates.push({ url: u, title: programName, snippet: '', score });
            }
          }
        }
        if (candidates.length > 0) {
          searchProvider = 'gemini-grounding';
          break;
        }
      } catch {
        // Try next model
      }
    }
  }

  // Include direct known URL as candidate too if already non-generic
  if (courseUrl && !isGenericUniversityUrl(courseUrl).isGeneric) {
    candidates.push({
      url: courseUrl,
      title: programName,
      snippet: '',
      score: 60,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // STEP 2: Verify HTTP Reachability & Fetch Full Official Page Content
  let verifiedDirectUrl: string | undefined;
  const pageChunks: string[] = [];
  const verifiedSources: { title: string; uri: string }[] = [];

  for (const cand of candidates.slice(0, 3)) {
    const check = await verifyUrlReachable(cand.url);
    const targetUrl = check.finalUrl || cand.url;
    let bodyText = cand.rawContent && cand.rawContent.length >= 600 ? cand.rawContent : '';
    if (!bodyText && (check.reachable || cand.score >= 40)) {
      bodyText = (await fetchJinaReaderText(targetUrl)) || (await fetchDirectHtmlText(targetUrl));
    }
    if (!bodyText && cand.snippet) {
      bodyText = cand.snippet;
    }

    if (!verifiedDirectUrl && (check.reachable || bodyText.length >= 400) && !isGenericUniversityUrl(targetUrl).isGeneric) {
      verifiedDirectUrl = targetUrl;
    }

    if (bodyText.length >= 120) {
      pageChunks.push(`SOURCE URL: ${targetUrl}\nTITLE: ${cand.title}\nCONTENT:\n${bodyText.slice(0, 5500)}`);
      verifiedSources.push({ title: cand.title || extractDomainHost(targetUrl) || 'Official Page', uri: targetUrl });
    }
    if (pageChunks.length >= 2) break;
  }

  const combinedPageText = pageChunks.join('\n\n---\n\n').slice(0, 12000);

  // STEP 3: Multi-AI Strict Extract-Only Consensus (Groq + Gemini + OpenAI Judge)
  if (combinedPageText.length >= 200) {
    const extractPrompt = `You are a strict university admissions data extractor.
Extract information ONLY from the official university page text provided below for:
University: ${universityName} (${country})
Programme: ${programName} (${degreeLevel || 'Degree'})

STRICT ACCURACY RULES:
1. Extract ONLY the **annual NON-EU / International student tuition fee** explicitly printed in the text. NEVER use domestic/EU fees unless the university explicitly states 0 tuition for non-EU international students too.
2. If the annual international tuition fee is NOT clearly printed in the text below, set "tuitionAmount": null (DO NOT GUESS OR INVENT NUMBERS).
3. Copy a short exact verbatim phrase from the text containing the fee into "tuitionQuote".
4. Convert per-semester fees to annual only if clearly stated (x2 semesters); prefer explicit per-year/annual tuition.

Return strictly valid JSON:
{
  "tuitionAmount": number | null,
  "tuitionCurrency": "EUR" | "GBP" | "USD" | "AUD" | "CAD" | "SEK" | "PLN" | "CHF" | "DKK" | "NOK" | "GEL" | "ALL" | null,
  "tuitionQuote": string | null,
  "academicYear": string | null,
  "min12thPercent": number | null,
  "minDegreePercent": number | null,
  "minIelts": number | null,
  "englishPolicy": "IELTS_TOEFL" | "MOI_ACCEPTED" | "WAIVED",
  "intakes": string[],
  "subjectRequirements": string,
  "summary": string
}

OFFICIAL UNIVERSITY TEXT:
${combinedPageText}`;

    // Run independent AI extractors in parallel (Groq + Gemini; or OpenAI if either missing)
    const [groqRes, geminiRes] = await Promise.all([
      callGroqOnlyJson(extractPrompt),
      callGeminiOnlyJson(extractPrompt),
    ]);

    let extraThirdRes: { provider: 'openai'; model: string; content: string } | null = null;
    if (!groqRes || !geminiRes) {
      extraThirdRes = await callOpenAiOnlyJson(extractPrompt);
    }

    const parsedCandidates = (
      await Promise.all([
        parseSingleExtraction(groqRes, combinedPageText),
        parseSingleExtraction(geminiRes, combinedPageText),
        parseSingleExtraction(extraThirdRes, combinedPageText),
      ])
    ).filter((p): p is ParsedExtraction => Boolean(p));

    if (parsedCandidates.length > 0) {
      const a = parsedCandidates[0];
      const b = parsedCandidates[1];
      let chosen = a;
      let consensusStatus: VerificationConsensusStatus = 'single-page-verified';
      const providersUsed = parsedCandidates.map((p) => p.provider);

      if (a && b) {
        const bothNull = a.tuitionEur === null && b.tuitionEur === null;
        const bothZero = a.tuitionEur === 0 && b.tuitionEur === 0;
        const closeMatch =
          a.tuitionEur !== null &&
          b.tuitionEur !== null &&
          Math.max(a.tuitionEur, b.tuitionEur) > 0 &&
          Math.abs(a.tuitionEur - b.tuitionEur) / Math.max(a.tuitionEur, b.tuitionEur) <= 0.05;

        if (bothNull || bothZero || closeMatch) {
          consensusStatus = 'consensus-2ai';
          // Prefer whichever has a richer quote / summary or average if slightly within 5%
          chosen = a.tuitionQuote ? a : b;
        } else {
          // Disagreement: run OpenAI Judge (or fallback unused provider) to break the tie strictly from page text
          const judgePrompt = `Two extractors disagreed on the official international annual tuition fee for ${universityName} — ${programName}.
Extractor A (${a.provider}): amount=${a.tuitionAmount} ${a.tuitionCurrency} (EUR ~${a.tuitionEur}), quote="${a.tuitionQuote || 'none'}"
Extractor B (${b.provider}): amount=${b.tuitionAmount} ${b.tuitionCurrency} (EUR ~${b.tuitionEur}), quote="${b.tuitionQuote || 'none'}"

Read ONLY the official page text below and pick the truly accurate NON-EU / international annual fee (or null if neither is explicitly printed as international annual tuition).
Return strictly valid JSON:
{
  "tuitionAmount": number | null,
  "tuitionCurrency": string | null,
  "tuitionQuote": string | null,
  "academicYear": string | null,
  "min12thPercent": number | null,
  "minDegreePercent": number | null,
  "minIelts": number | null,
  "englishPolicy": "IELTS_TOEFL" | "MOI_ACCEPTED" | "WAIVED",
  "intakes": string[],
  "subjectRequirements": string,
  "summary": string
}

TEXT:
${combinedPageText.slice(0, 8000)}`;

          const judgeRaw =
            (await callOpenAiOnlyJson(judgePrompt)) ||
            (!providersUsed.includes('gemini') ? await callGeminiOnlyJson(judgePrompt) : null);
          const judged = await parseSingleExtraction(judgeRaw, combinedPageText);
          if (judged) {
            chosen = judged;
            if (!providersUsed.includes(judged.provider)) {
              providersUsed.push(judged.provider);
            }
            consensusStatus = 'judge-resolved';
          } else {
            // Pick whichever had an explicit verbatim fee quote in page text
            chosen = a.tuitionQuote && !b.tuitionQuote ? a : b.tuitionQuote && !a.tuitionQuote ? b : a;
            consensusStatus = 'single-page-verified';
          }
        }
      }

      const finalDomain =
        extractDomainHost(verifiedDirectUrl) || extractDomainHost(verifiedSources[0]?.uri) || knownHost;

      const snapshot: VerifiedCourseSnapshot = {
        courseKey: verifyKey,
        courseId,
        officialUrl: verifiedDirectUrl || verifiedSources[0]?.uri,
        verifiedDomain: finalDomain || undefined,
        tuitionFeesEur: chosen.tuitionEur,
        originalTuitionAmount: chosen.tuitionAmount,
        originalTuitionCurrency: chosen.tuitionAmount !== null ? chosen.tuitionCurrency : null,
        tuitionQuote: chosen.tuitionQuote || undefined,
        academicYear: chosen.academicYear || undefined,
        min12thPercent: chosen.min12thPercent ?? (isUg ? 60 : 55),
        minDegreePercent: chosen.minDegreePercent ?? (isUg ? chosen.min12thPercent ?? 60 : 60),
        minIelts: chosen.minIelts ?? 6.0,
        englishPolicy: chosen.englishPolicy,
        intakes: chosen.intakes.length > 0 ? chosen.intakes : ['September'],
        subjectRequirements: chosen.subjectRequirements || 'Verify exact prerequisites on official programme page.',
        summary:
          chosen.summary ||
          `Extracted directly from official university page (${finalDomain || universityName}).`,
        consensusStatus,
        providersUsed,
        searchProvider,
        verifiedAt: new Date().toISOString(),
        sources: verifiedSources,
      };

      await saveCourseVerificationSnapshot(snapshot);
      return { snapshot, fromCache: false };
    }
  }

  // Fallback if live page could not be scraped/parsed cleanly: single AI summary without claiming consensus-2ai
  const fallbackAiRaw = await callGroqFreeJson(
    `Provide current 2026 international admission requirements for ${universityName} (${country}) — ${programName} (${degreeLevel || 'Degree'}).
Return JSON: {"min12thPercent": number, "minDegreePercent": number, "minIelts": number, "englishPolicy": "IELTS_TOEFL"|"MOI_ACCEPTED"|"WAIVED", "intakes": string[], "subjectRequirements": string, "summary": string}.`
  );
  if (fallbackAiRaw) {
    try {
      const p = JSON.parse(fallbackAiRaw);
      const snap: VerifiedCourseSnapshot = {
        courseKey: verifyKey,
        courseId,
        officialUrl: verifiedDirectUrl,
        verifiedDomain: extractDomainHost(verifiedDirectUrl || courseUrl) || undefined,
        tuitionFeesEur: null,
        min12thPercent: Number(p.min12thPercent) || (isUg ? 60 : 55),
        minDegreePercent: Number(p.minDegreePercent) || (isUg ? 60 : 55),
        minIelts: Number(p.minIelts) || 6.0,
        englishPolicy: ['MOI_ACCEPTED', 'WAIVED'].includes(p.englishPolicy) ? p.englishPolicy : 'IELTS_TOEFL',
        intakes: Array.isArray(p.intakes) && p.intakes.length > 0 ? p.intakes.slice(0, 4) : ['September'],
        subjectRequirements: String(p.subjectRequirements || ''),
        summary: String(p.summary || 'Verify live fee details directly on the official university portal.'),
        consensusStatus: 'ai-search',
        providersUsed: ['ai-fallback'],
        searchProvider,
        verifiedAt: new Date().toISOString(),
        sources: verifiedSources,
      };
      await saveCourseVerificationSnapshot(snap);
      return { snapshot: snap, fromCache: false };
    } catch {
      // Fall through to baseline
    }
  }

  const lowerCtry = country.toLowerCase();
  const baseline: VerifiedCourseSnapshot = {
    courseKey: verifyKey,
    courseId,
    officialUrl: verifiedDirectUrl,
    verifiedDomain: extractDomainHost(verifiedDirectUrl || courseUrl) || undefined,
    tuitionFeesEur: null,
    min12thPercent: lowerCtry === 'germany' ? 70 : 55,
    minDegreePercent: lowerCtry === 'germany' ? 65 : 55,
    minIelts: lowerCtry === 'germany' ? 6.5 : 6.0,
    englishPolicy: lowerCtry === 'latvia' || lowerCtry === 'malta' ? 'MOI_ACCEPTED' : 'IELTS_TOEFL',
    intakes: ['September', 'February'],
    subjectRequirements: 'Standard academic transcripts & SOP/LOR required.',
    summary: `Baseline rules applied for ${universityName}. Open the official university portal to confirm live 2026 fees.`,
    consensusStatus: 'baseline',
    providersUsed: [],
    searchProvider: 'fallback',
    verifiedAt: new Date().toISOString(),
    sources: verifiedSources,
  };
  return { snapshot: baseline, fromCache: false };
}
