import { sanitizeHttpUrl } from '@/lib/security/validation';
import {
  extractLanguageProficiency,
  normalizeTeachingLanguage,
} from '@/lib/teaching-language';
import { getCountryBillingCurrency, isGenericUniversityUrl } from '@/lib/student-guides';
import {
  callGeminiOnlyJson,
  callGroqFreeJson,
  callGroqOnlyJson,
  callOpenAiOnlyJson,
} from '@/lib/groq-client';
import { convertCurrencyToEur, normalizeCurrencyCode } from '@/lib/live-fx';
import {
  AUTO_TAVILY_MONTHLY_LIMIT,
  CRON_POLICY_TAVILY_MONTHLY_LIMIT,
  CURRENT_EXTRACTOR_VERSION,
  DEFAULT_VERIFY_CACHE_DAYS,
  getCachedCourseVerification,
  getMonthlyTavilyUsage,
  HARD_TAVILY_MONTHLY_LIMIT,
  hasBlockedSummaryText,
  incrementTavilyUsage,
  makeCourseVerifyKey,
  saveCourseVerificationSnapshot,
  VerificationConsensusStatus,
  VerifiedCourseSnapshot,
} from '@/lib/course-verification-cache';
import { findCourseUrlInSitemap } from '@/lib/sitemap-course-matcher';

export function isBlockedOrChallengePage(text: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return false;
  const challengeRe =
    /attention required!\s*\|\s*cloudflare|sorry,\s*you have been blocked|enable javascript and cookies to continue|verify you are human|please complete the captcha|cf-error-details|just a moment\.\.\.|checking your browser before accessing|why have i been blocked\?/i;
  if (clean.length < 2500 && challengeRe.test(clean)) {
    return true;
  }
  const head = clean.slice(0, 1500);
  if (
    challengeRe.test(head) &&
    !/\b(?:tuition|entry requirements|ielts|modules|course overview)\b/i.test(head)
  ) {
    return true;
  }
  return false;
}

export function extractCleanTitleFromPageHeading(
  rawTitle: string,
  universityName: string
): string | null {
  const clean = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const parts = clean
    .split(/\s*[|–—]\s*|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const uniLower = String(universityName || '').toLowerCase();
  const uniWords = uniLower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && w !== 'university' && w !== 'college');

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (uniWords.length > 0 && uniWords.some((w) => lower.includes(w))) continue;
    if (/^(?:study|courses|postgraduate|undergraduate|admissions|fees|overview)$/i.test(part)) {
      continue;
    }
    const stripped = part
      .replace(/\b20\d{2}\s*[\/-]\s*(?:20)?\d{2}\b/g, '')
      .replace(/\b20\d{2}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      stripped.length >= 6 &&
      stripped.length <= 120 &&
      (/(?:\b(?:msc|bsc|ma|ba|mba|beng|meng|mph|llm|phd|btech|mtech|diploma|certificate|bachelor|master)\b)/i.test(
        stripped
      ) ||
        stripped.split(/\s+/).length >= 2)
    ) {
      return stripped;
    }
  }
  return null;
}

function candidateMatchesProgramOrFees(
  candUrl: string,
  candTitle: string,
  programName: string
): boolean {
  const hay = `${candUrl} ${candTitle}`.toLowerCase();
  if (/tuition|fee|fees|funding|international-fees|cost/.test(candUrl.toLowerCase())) {
    return true;
  }
  const tokens = programName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !['msc', 'bsc', 'ma', 'ba', 'mba', 'phd', 'and', 'the', 'for', 'with', 'in', 'of'].includes(t)
    );
  if (tokens.length === 0) return true;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits / tokens.length >= 0.5;
}

export function trimToCleanSentence(text: string, maxLen = 300): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastPeriod >= Math.floor(maxLen * 0.45)) {
    return slice.slice(0, lastPeriod + 1).trim();
  }
  const lastEnd = slice.search(/[.!?][^.!?]*$/);
  if (lastEnd >= Math.floor(maxLen * 0.5)) {
    return slice.slice(0, lastEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  const wordSafe = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return `${wordSafe.replace(/[,;:\-]+$/, '').trim()}…`;
}

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
  const cleanText = String(pageText || '').replace(/[\u00A0\u202F]/g, ' ');
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

const FEE_SECTION_RE =
  /\b(?:tuition|fees?|funding|cost|price|annual|per\s+year|semester\s+(?:fee|contribution)|international\s+(?:students?|fees?|tuition)|non[-\s]?eu|non[-\s]?eea|overseas|foreign\s+students?|out[-\s]?of[-\s]?state|study\s+fees?)\b|[£€$¥₩]|(?:\b(?:GBP|EUR|USD|CAD|AUD|NZD|CHF|SEK|DKK|NOK|PLN|CZK|HUF|AED|GEL|ALL|BGN|SGD|JPY|KRW)\b)/gi;

const REQ_SECTION_RE =
  /\b(?:entry\s+requirements?|admission\s+requirements?|academic\s+requirements?|ielts|toefl|english\s+language|medium\s+of\s+instruction|language\s+of\s+instruction|taught\s+in|teaching\s+language|german\s+[abc][12]|italian\s+[abc][12]|polish\s+[abc][12]|french\s+[abc][12]|spanish\s+[abc][12]|dsh|testdaf|goethe|cils|celi|delf|dalf|dele|jlpt|topik|\bmoi\b|intakes?|start\s+dates?|application\s+deadlines?)\b/gi;

function collectMergedIntervals(
  text: string,
  regex: RegExp,
  beforePad: number,
  afterPad: number,
  mergeGap: number
): Array<{ start: number; end: number; text: string }> {
  const intervals: Array<[number, number]> = [];
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = Math.max(0, match.index - beforePad);
    const end = Math.min(text.length, match.index + afterPad);
    const prev = intervals[intervals.length - 1];
    if (prev && start <= prev[1] + mergeGap) {
      prev[1] = Math.max(prev[1], end);
    } else {
      intervals.push([start, end]);
    }
    if (intervals.length >= 45 && intervals[intervals.length - 1][1] === end && end - start > 3000) {
      // Prevent pathological huge single interval from blocking later sections
      regex.lastIndex = end;
    }
  }
  return intervals.map(([start, end]) => ({
    start,
    end,
    text: text.slice(start, end).trim(),
  }));
}

/**
 * Extracts header + International Tuition/Fee sections + Entry/Intake sections
 * from arbitrarily long university web pages so bottom-of-page fee tables
 * across all 35 countries are never silently truncated.
 */
export function extractRelevantPageSections(rawText: string, maxChars = 9000): string {
  const clean = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean || clean.length <= maxChars) return clean;

  const headLen = Math.min(2000, Math.floor(maxChars * 0.25));
  const head = clean.slice(0, headLen).trim();
  const rest = clean.slice(headLen);
  if (!rest) return head;

  const feeBudget = Math.floor((maxChars - headLen) * 0.72);
  const feeIntervals = collectMergedIntervals(rest, FEE_SECTION_RE, 220, 480, 180);

  const scoredFees = feeIntervals.map((item) => {
    let score = 0;
    const t = item.text;
    const hasNum = /\d{3,6}|\b0\b/.test(t);
    const hasCurr =
      /[£€$¥₩]|\b(?:GBP|EUR|USD|CAD|AUD|NZD|CHF|SEK|DKK|NOK|PLN|CZK|HUF|AED|GEL|ALL|BGN|SGD|JPY|KRW)\b/i.test(
        t
      );
    const hasTuition = /\b(?:tuition|fees?|funding|cost|semester\s+(?:fee|contribution)|per\s+year|annual)\b/i.test(
      t
    );
    const hasIntl = /\b(?:international|non[-\s]?eu|non[-\s]?eea|overseas|foreign|out[-\s]?of[-\s]?state)\b/i.test(
      t
    );
    const hasYear = /\b202[567]\b/.test(t);
    if (hasTuition && hasCurr) score += 40;
    else if (hasTuition && hasNum) score += 28;
    else if (hasCurr && hasNum) score += 22;
    else if (hasTuition) score += 10;
    if (hasIntl) score += 20;
    if (hasYear) score += 10;
    return { ...item, score };
  });

  scoredFees.sort((a, b) => b.score - a.score || a.start - b.start);

  const chosenFeeSpans: Array<{ start: number; end: number; text: string }> = [];
  let usedFeeChars = 0;
  for (const item of scoredFees) {
    if (item.score <= 0 && usedFeeChars > 0) continue;
    const piece = item.text.length > 1600 ? item.text.slice(0, 1600) : item.text;
    if (usedFeeChars + piece.length + 5 > feeBudget) {
      if (usedFeeChars === 0 && feeBudget > 300) {
        chosenFeeSpans.push({ start: item.start, end: item.end, text: piece.slice(0, feeBudget - 10) });
        usedFeeChars += feeBudget - 10;
      }
      continue;
    }
    chosenFeeSpans.push({ start: item.start, end: item.end, text: piece });
    usedFeeChars += piece.length + 5;
  }

  chosenFeeSpans.sort((a, b) => a.start - b.start);

  const reqBudget = Math.max(0, maxChars - headLen - usedFeeChars - 16);
  const reqIntervals = collectMergedIntervals(rest, REQ_SECTION_RE, 140, 360, 150);
  const chosenReqSpans: Array<{ start: number; end: number; text: string }> = [];
  let usedReqChars = 0;
  for (const item of reqIntervals) {
    const overlapsFee = chosenFeeSpans.some(
      (f) => item.start >= f.start - 50 && item.end <= f.end + 50
    );
    if (overlapsFee) continue;
    const piece = item.text.length > 1100 ? item.text.slice(0, 1100) : item.text;
    if (usedReqChars + piece.length + 5 > reqBudget) continue;
    chosenReqSpans.push({ start: item.start, end: item.end, text: piece });
    usedReqChars += piece.length + 5;
  }

  const allTail = [...chosenFeeSpans, ...chosenReqSpans].sort((a, b) => a.start - b.start);
  const parts = [head, ...allTail.map((s) => s.text)].filter(Boolean);
  return parts.join('\n...\n').slice(0, maxChars);
}

async function runTavilySearch(params: {
  query: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}): Promise<any[]> {
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (!tavilyKey) return [];

  try {
    const body: Record<string, any> = {
      api_key: tavilyKey,
      query: params.query,
      topic: 'general',
      search_depth: params.searchDepth || 'basic',
      max_results: params.maxResults ?? 4,
      include_answer: false,
      include_raw_content: false,
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
  if (!process.env.TAVILY_API_KEY?.trim()) return [];
  const usage = await getMonthlyTavilyUsage();
  if (usage.tavilyCreditsUsed >= CRON_POLICY_TAVILY_MONTHLY_LIMIT) {
    return [];
  }

  const results = await runTavilySearch({
    query: `"${country}" official government immigration post-study work stay-back student visa financial proof 2026`,
    excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
    maxResults: 4,
    searchDepth: 'basic',
  });
  await incrementTavilyUsage(1);
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
      signal: AbortSignal.timeout(8500),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const txt = await res.text();
    return txt.trim().slice(0, 45000);
  } catch {
    return '';
  }
}

async function fetchDirectHtmlText(targetUrl: string): Promise<string> {
  try {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(5500),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const html = await res.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|table)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned.slice(0, 45000);
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
  officialProgramName: string | null;
  tuitionAmount: number | null;
  tuitionCurrency: string;
  tuitionEur: number | null;
  tuitionQuote: string | null;
  academicYear: string | null;
  min12thPercent: number | null;
  minDegreePercent: number | null;
  minIelts: number | null;
  englishPolicy: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED';
  teachingLanguage: string | null;
  languageProficiency: string | null;
  intakes: string[];
  subjectRequirements: string;
  summary: string;
}

async function parseSingleExtraction(
  raw: { provider: string; model: string; content: string } | null,
  pageText: string,
  countryExpectedCurrency = 'EUR'
): Promise<ParsedExtraction | null> {
  if (!raw?.content) return null;
  try {
    const match = raw.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw.content);

    let rawAmount: number | null =
      parsed.tuitionAmount !== null && parsed.tuitionAmount !== undefined && parsed.tuitionAmount !== ''
        ? Number(String(parsed.tuitionAmount).replace(/,/g, ''))
        : null;
    if (rawAmount !== null && (!Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > 50_000_000)) {
      rawAmount = null;
    }

    // Programmatic grounding check: only accept fee if it is genuinely printed in the fetched page text
    if (rawAmount !== null && !numberAppearsInPageText(rawAmount, pageText)) {
      rawAmount = null;
    }

    const rawCurrTrimmed = String(parsed.tuitionCurrency || '').trim();
    const currency =
      rawCurrTrimmed === '$' || rawCurrTrimmed === ''
        ? ['USD', 'CAD', 'AUD', 'NZD', 'SGD'].includes(countryExpectedCurrency)
          ? countryExpectedCurrency
          : normalizeCurrencyCode(rawCurrTrimmed || countryExpectedCurrency)
        : normalizeCurrencyCode(rawCurrTrimmed);

    let tuitionEur: number | null = null;
    if (rawAmount !== null) {
      const fx = await convertCurrencyToEur(rawAmount, currency);
      if (fx.eur < 0 || fx.eur > 180_000) {
        rawAmount = null;
        tuitionEur = null;
      } else {
        tuitionEur = fx.eur;
      }
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

    const rawProgTitle =
      typeof parsed.officialProgramName === 'string'
        ? parsed.officialProgramName.replace(/\s+/g, ' ').trim().slice(0, 140)
        : '';
    const normTeachLang = normalizeTeachingLanguage(parsed.teachingLanguage);
    const rawLangProf =
      typeof parsed.languageProficiency === 'string' && parsed.languageProficiency.trim()
        ? parsed.languageProficiency.replace(/\s+/g, ' ').trim().slice(0, 80)
        : extractLanguageProficiency(parsed.teachingLanguage) ||
          extractLanguageProficiency(parsed.subjectRequirements) ||
          null;

    return {
      provider: raw.provider,
      model: raw.model,
      officialProgramName: rawProgTitle.length >= 4 ? rawProgTitle : null,
      tuitionAmount: rawAmount !== null ? Math.round(rawAmount) : null,
      tuitionCurrency: currency,
      tuitionEur,
      tuitionQuote: parsed.tuitionQuote
        ? trimToCleanSentence(String(parsed.tuitionQuote), 240)
        : null,
      academicYear: parsed.academicYear ? String(parsed.academicYear).trim().slice(0, 20) : null,
      min12thPercent: min12th,
      minDegreePercent: minDeg,
      minIelts,
      englishPolicy,
      teachingLanguage: normTeachLang || null,
      languageProficiency: normTeachLang && normTeachLang !== 'English' ? rawLangProf : null,
      intakes: Array.isArray(parsed.intakes)
        ? parsed.intakes.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4)
        : [],
      subjectRequirements: trimToCleanSentence(String(parsed.subjectRequirements || ''), 240),
      summary: trimToCleanSentence(String(parsed.summary || ''), 320),
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
  autoTrigger?: boolean;
}): Promise<{ snapshot: VerifiedCourseSnapshot; fromCache: boolean }> {
  const {
    courseId,
    programName,
    universityName,
    country,
    degreeLevel,
    courseUrl,
    forceRefresh = false,
    autoTrigger = false,
  } = params;

  const verifyKey = makeCourseVerifyKey(country, universityName, programName);
  if (!forceRefresh) {
    const cached = await getCachedCourseVerification(
      country,
      universityName,
      programName,
      DEFAULT_VERIFY_CACHE_DAYS
    );
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
  let usedTavily = false;
  const candidates: SearchCandidatePage[] = [];
  const seenUrls = new Set<string>();
  const pushCandidate = (url: string, title: string, snippet: string, score: number) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    candidates.push({ url, title, snippet, score });
  };

  // STEP 0: 0-Credit Free sitemap.xml Discovery (also heals moved/broken links across the university)
  let sitemapHasReadablePage = false;
  if (knownHost) {
    const sitemapUrl = await findCourseUrlInSitemap(knownHost, programName, degreeLevel);
    if (sitemapUrl) {
      const sitemapText = await fetchJinaReaderText(sitemapUrl);
      if (sitemapText.length >= 400) {
        sitemapHasReadablePage = true;
        pushCandidate(sitemapUrl, programName, '', 95);
        candidates[0].rawContent = sitemapText;
      } else {
        pushCandidate(sitemapUrl, programName, '', 75);
      }
    }
  }

  // Include direct known URL as candidate if non-generic
  if (courseUrl && !isGenericUniversityUrl(courseUrl).isGeneric) {
    pushCandidate(courseUrl, programName, '', 60);
  }

  // STEP 1: Official Domain-Locked Web Discovery (1-credit Tavily basic, quota-guarded, Gemini fallback)
  if (!sitemapHasReadablePage && process.env.TAVILY_API_KEY?.trim()) {
    const usage = await getMonthlyTavilyUsage();
    const limitForCaller = autoTrigger ? AUTO_TAVILY_MONTHLY_LIMIT : HARD_TAVILY_MONTHLY_LIMIT;

    if (usage.tavilyCreditsUsed < limitForCaller) {
      usedTavily = true;
      const tavilyRows = knownHost
        ? await runTavilySearch({
            query: `"${programName}" international tuition fees entry requirements ${country}`,
            includeDomains: [knownHost],
            maxResults: 4,
            searchDepth: 'basic',
          })
        : await runTavilySearch({
            query: `"${universityName}" "${programName}" ${country} official international tuition fees`,
            excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
            maxResults: 4,
            searchDepth: 'basic',
          });
      await incrementTavilyUsage(1);

      for (const r of tavilyRows) {
        const cleanUrl = sanitizeHttpUrl(String(r?.url || ''));
        if (!cleanUrl) continue;
        const title = String(r?.title || '').trim();
        const snippet = String(r?.content || '').trim();
        const score = scoreCandidatePage(cleanUrl, title, knownHost, programName);
        if (score >= 0) {
          pushCandidate(cleanUrl, title, snippet, score);
        }
      }
      if (tavilyRows.length > 0) {
        searchProvider = 'tavily';
      }
    }
  }

  // Fallback URL discovery via Gemini Google Search Grounding if neither sitemap nor Tavily found a direct candidate
  if (!candidates.some((c) => !isGenericUniversityUrl(c.url).isGeneric) && process.env.GEMINI_API_KEY?.trim()) {
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

  candidates.sort((a, b) => b.score - a.score);

  // STEP 2: Verify HTTP Reachability & Fetch Full Official Page Content
  let verifiedDirectUrl: string | undefined;
  let bestDiscoveredTitle: string | null = null;
  const pageChunks: string[] = [];
  const verifiedSources: { title: string; uri: string }[] = [];

  for (const cand of candidates.slice(0, 3)) {
    // Prevent unrelated brochures from contaminating the primary course extraction
    if (pageChunks.length >= 1 && !candidateMatchesProgramOrFees(cand.url, cand.title, programName)) {
      continue;
    }

    const check = await verifyUrlReachable(cand.url);
    const targetUrl = check.finalUrl || cand.url;
    let bodyText = cand.rawContent && cand.rawContent.length >= 600 ? cand.rawContent : '';
    if (!bodyText && (check.reachable || cand.score >= 40)) {
      bodyText = (await fetchJinaReaderText(targetUrl)) || (await fetchDirectHtmlText(targetUrl));
    }
    if (bodyText && isBlockedOrChallengePage(bodyText)) {
      // Never try to bypass CAPTCHAs or Cloudflare; discard challenge HTML and rely cleanly on indexed snippets
      bodyText = '';
    }
    if (!bodyText && cand.snippet) {
      bodyText = cand.snippet;
    }

    if (!verifiedDirectUrl && (check.reachable || bodyText.length >= 400) && !isGenericUniversityUrl(targetUrl).isGeneric) {
      verifiedDirectUrl = targetUrl;
    }

    if (!bestDiscoveredTitle && cand.title) {
      bestDiscoveredTitle = extractCleanTitleFromPageHeading(cand.title, universityName);
    }

    if (bodyText.length >= 100) {
      const focused = extractRelevantPageSections(bodyText, 8500);
      const cleanSnippet = cand.snippet ? String(cand.snippet).trim() : '';
      const snippetHasFeeCue = cleanSnippet && /\d{3,6}|[£€$]/.test(cleanSnippet) && !focused.includes(cleanSnippet.slice(0, 40));
      const contentWithSnippet = snippetHasFeeCue ? `${focused}\n\nINDEXED SNIPPET:\n${cleanSnippet}` : focused;
      pageChunks.push(`SOURCE URL: ${targetUrl}\nTITLE: ${cand.title}\nCONTENT:\n${contentWithSnippet}`);
      verifiedSources.push({ title: cand.title || extractDomainHost(targetUrl) || 'Official Page', uri: targetUrl });
    }
    if (pageChunks.length >= 2) break;
  }

  let combinedPageText = pageChunks.join('\n\n---\n\n').slice(0, 13000);
  const expectedBilling = getCountryBillingCurrency(country).code;

  const runExtractionConsensus = async (
    textToAnalyze: string
  ): Promise<{
    chosen: ParsedExtraction;
    consensusStatus: VerificationConsensusStatus;
    providersUsed: string[];
  } | null> => {
    const extractPrompt = `You are a strict university admissions data extractor.
Extract information ONLY from the official university page text provided below for:
University: ${universityName} (${country})
Programme requested: ${programName} (${degreeLevel || 'Degree'})
${bestDiscoveredTitle ? `Detected official candidate title: ${bestDiscoveredTitle}\n` : ''}Typical billing currency in ${country}: ${expectedBilling} (always report the exact currency symbol/code printed on the official page).

STRICT ACCURACY RULES (ALL COUNTRIES):
1. Extract ONLY the **annual INTERNATIONAL / NON-EU / NON-EEA / OVERSEAS / OUT-OF-STATE / FOREIGN student tuition fee** explicitly printed in the text:
   - UK: International / Overseas tuition fee (NEVER Home / UK fee).
   - EU/EEA countries (Germany, Sweden, Finland, Denmark, Netherlands, Ireland, France, Spain, Italy, Austria, Poland, Belgium, etc.): Non-EU / Non-EEA international tuition fee (NEVER EU/EEA domestic fee unless the university explicitly states 0 tuition for Non-EU international students too).
   - USA, Canada, Australia, New Zealand: International / Out-of-State tuition fee (NEVER Domestic / In-State fee).
   - Georgia, Albania, UAE, Singapore, Japan, South Korea, etc.: International / Foreign student tuition fee.
2. **Nearest Official Programme Title**: If the official university page is for a closely related / slightly renamed official title of "${programName}" at ${universityName} (for example, "MSc Global Public Health" when "MSc Public Health" was requested), accept it as the nearest official programme, put that exact official course title in "officialProgramName", and extract its real 2026 international tuition fee and entry requirements. Only set tuitionAmount to null if the fee is missing or the page is for a completely unrelated discipline.
3. Prefer the 2026/27 or 2026-2027 academic year fee when multiple years are listed.
4. If multiple tracks appear (e.g., standard programme vs optional placement/PDP/extended track), match the track named in "${programName}", or choose the standard full-time annual fee if no placement/extended track is specified.
5. If the annual international tuition fee is NOT clearly printed in the text below, set "tuitionAmount": null (DO NOT GUESS OR INVENT NUMBERS).
6. Copy a short exact verbatim phrase from the text containing the fee into "tuitionQuote".
7. Convert per-semester fees to annual only if clearly stated as per-semester (x2 semesters); prefer explicit per-year/annual tuition.
8. Extract the official medium of instruction ("teachingLanguage": "English" | "Italian" | "German" | "Polish" | "French" | "Spanish" | "Dutch" | "Swedish" | "Japanese" | "Korean" | "Bilingual") and any required local language proficiency level ("languageProficiency", e.g. "German B2", "Italian B2", "TestDaF 4 / DSH-2", or null if English-only).
9. In "summary", write 1-2 clean student-facing sentences describing the programme; NEVER mention CAPTCHA, scraping errors, or missing text.

Return strictly valid JSON:
{
  "officialProgramName": string | null,
  "tuitionAmount": number | null,
  "tuitionCurrency": "EUR" | "GBP" | "USD" | "CAD" | "AUD" | "NZD" | "CHF" | "SEK" | "DKK" | "NOK" | "PLN" | "CZK" | "HUF" | "AED" | "GEL" | "ALL" | "BGN" | "SGD" | "JPY" | "KRW" | null,
  "tuitionQuote": string | null,
  "academicYear": string | null,
  "min12thPercent": number | null,
  "minDegreePercent": number | null,
  "minIelts": number | null,
  "englishPolicy": "IELTS_TOEFL" | "MOI_ACCEPTED" | "WAIVED",
  "teachingLanguage": "English" | "Italian" | "German" | "Polish" | "French" | "Spanish" | "Dutch" | "Swedish" | "Japanese" | "Korean" | "Bilingual" | null,
  "languageProficiency": string | null,
  "intakes": string[],
  "subjectRequirements": string,
  "summary": string
}

OFFICIAL UNIVERSITY TEXT:
${textToAnalyze}`;

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
        parseSingleExtraction(groqRes, textToAnalyze, expectedBilling),
        parseSingleExtraction(geminiRes, textToAnalyze, expectedBilling),
        parseSingleExtraction(extraThirdRes, textToAnalyze, expectedBilling),
      ])
    ).filter((p): p is ParsedExtraction => Boolean(p));

    if (parsedCandidates.length === 0) return null;

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
        // Prefer whichever has a richer quote / summary
        chosen = a.tuitionQuote ? a : b;
      } else {
        // Disagreement: run OpenAI Judge (or fallback unused provider) to break the tie strictly from page text
        const judgePrompt = `Two extractors disagreed on the official international annual tuition fee for ${universityName} (${country}) — ${programName}.
Extractor A (${a.provider}): amount=${a.tuitionAmount} ${a.tuitionCurrency} (EUR ~${a.tuitionEur}), quote="${a.tuitionQuote || 'none'}"
Extractor B (${b.provider}): amount=${b.tuitionAmount} ${b.tuitionCurrency} (EUR ~${b.tuitionEur}), quote="${b.tuitionQuote || 'none'}"

Read ONLY the official page text below and pick the truly accurate NON-EU / International / Overseas annual fee for "${programName}" or its nearest official programme title at ${universityName} (NEVER domestic/Home/EU fee; or null if neither is explicitly printed as international annual tuition).
Return strictly valid JSON:
{
  "officialProgramName": string | null,
  "tuitionAmount": number | null,
  "tuitionCurrency": string | null,
  "tuitionQuote": string | null,
  "academicYear": string | null,
  "min12thPercent": number | null,
  "minDegreePercent": number | null,
  "minIelts": number | null,
  "englishPolicy": "IELTS_TOEFL" | "MOI_ACCEPTED" | "WAIVED",
  "teachingLanguage": string | null,
  "languageProficiency": string | null,
  "intakes": string[],
  "subjectRequirements": string,
  "summary": string
}

TEXT:
${textToAnalyze.slice(0, 11000)}`;

        const judgeRaw =
          (await callOpenAiOnlyJson(judgePrompt)) ||
          (!providersUsed.includes('gemini') ? await callGeminiOnlyJson(judgePrompt) : null);
        const judged = await parseSingleExtraction(judgeRaw, textToAnalyze, expectedBilling);
        if (judged) {
          chosen = judged;
          if (!providersUsed.includes(judged.provider)) {
            providersUsed.push(judged.provider);
          }
          consensusStatus = 'judge-resolved';
        } else {
          // Prefer whichever had a grounded non-null tuition + explicit verbatim quote
          chosen =
            a.tuitionEur !== null && b.tuitionEur === null
              ? a
              : b.tuitionEur !== null && a.tuitionEur === null
              ? b
              : a.tuitionQuote && !b.tuitionQuote
              ? a
              : b.tuitionQuote && !a.tuitionQuote
              ? b
              : a;
          consensusStatus = 'single-page-verified';
        }
      }
    }

    return { chosen, consensusStatus, providersUsed };
  };

  // STEP 3: Multi-AI Strict Extract-Only Consensus (Groq + Gemini + OpenAI Judge)
  if (combinedPageText.length >= 120) {
    let extraction = await runExtractionConsensus(combinedPageText);

    // STEP 3b: Dedicated Fee-Snippet Fallback (max 1 Tavily basic credit when no international fee was extracted yet)
    let usedFeeFallback = false;
    if (
      (!extraction || extraction.chosen.tuitionEur === null) &&
      !usedFeeFallback &&
      process.env.TAVILY_API_KEY?.trim()
    ) {
      usedFeeFallback = true;
      const usage = await getMonthlyTavilyUsage();
      const limitForCaller = autoTrigger ? AUTO_TAVILY_MONTHLY_LIMIT : HARD_TAVILY_MONTHLY_LIMIT;
      if (usage.tavilyCreditsUsed < limitForCaller) {
        usedTavily = true;
        const targetTitleQuery = bestDiscoveredTitle || programName;
        const feeRows = knownHost
          ? await runTavilySearch({
              query: `"${targetTitleQuery}" "${universityName}" international tuition fees ${country} 2026 2027`,
              includeDomains: [knownHost],
              maxResults: 4,
              searchDepth: 'basic',
            })
          : await runTavilySearch({
              query: `"${universityName}" "${targetTitleQuery}" international tuition fees ${country} 2026 2027`,
              excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
              maxResults: 4,
              searchDepth: 'basic',
            });
        await incrementTavilyUsage(1);

        const existingUris = new Set(verifiedSources.map((s) => s.uri));
        const feeCandidates = feeRows
          .map((r: any) => {
            const u = sanitizeHttpUrl(String(r?.url || ''));
            if (!u) return null;
            const title = String(r?.title || '').trim();
            const snippet = String(r?.content || '').trim();
            const score = scoreCandidatePage(u, title, knownHost, targetTitleQuery);
            return score >= 0 ? { url: u, title, snippet, score } : null;
          })
          .filter((x): x is SearchCandidatePage => Boolean(x))
          .filter((x) => candidateMatchesProgramOrFees(x.url, x.title, targetTitleQuery))
          .sort((a, b) => b.score - a.score);

        const extraChunks: string[] = [];
        const topFeeCand = feeCandidates.find((c) => !existingUris.has(c.url)) || feeCandidates[0];
        if (topFeeCand) {
          let feeRawText =
            (await fetchJinaReaderText(topFeeCand.url)) ||
            (await fetchDirectHtmlText(topFeeCand.url));
          if (feeRawText && isBlockedOrChallengePage(feeRawText)) {
            feeRawText = '';
          }
          const focused = feeRawText ? extractRelevantPageSections(feeRawText, 6500) : '';
          if (focused.length >= 200) {
            extraChunks.push(`SOURCE URL: ${topFeeCand.url}\nTITLE: ${topFeeCand.title}\nCONTENT:\n${focused}`);
          } else if (topFeeCand.snippet.length >= 60) {
            extraChunks.push(`SOURCE URL: ${topFeeCand.url}\nTITLE: ${topFeeCand.title}\nINDEXED SNIPPET:\n${topFeeCand.snippet}`);
          }
          if (!existingUris.has(topFeeCand.url)) {
            verifiedSources.push({
              title: topFeeCand.title || extractDomainHost(topFeeCand.url) || 'International Fees Page',
              uri: topFeeCand.url,
            });
          }
        }

        // Also include any clean Tavily indexed snippets containing fee amounts
        const cleanFeeSnippets = feeRows
          .map((r: any) => `${String(r?.title || '')}: ${String(r?.content || '').trim()}`)
          .filter((s) => s.length >= 40 && /\d{3,6}|[£€$]/.test(s))
          .slice(0, 3);
        if (cleanFeeSnippets.length > 0) {
          extraChunks.push(`SEARCH ENGINE INDEXED FEE SNIPPETS:\n${cleanFeeSnippets.join('\n')}`);
        }

        if (extraChunks.length > 0) {
          searchProvider = 'tavily';
          combinedPageText = `${combinedPageText}\n\n---\n\n${extraChunks.join('\n\n')}`.slice(0, 14000);
          const feeExtraction = await runExtractionConsensus(combinedPageText);
          if (feeExtraction && feeExtraction.chosen.tuitionEur !== null) {
            extraction = feeExtraction;
          }
        }
      }
    }

    if (extraction) {
      const { chosen, consensusStatus, providersUsed } = extraction;
      const finalDomain =
        extractDomainHost(verifiedDirectUrl) || extractDomainHost(verifiedSources[0]?.uri) || knownHost;
      const feeVerified = chosen.tuitionEur !== null && chosen.tuitionEur !== undefined;

      const candidateMatchedTitle = chosen.officialProgramName || bestDiscoveredTitle;
      const reqTokens = programName
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !['msc', 'bsc', 'mba', 'phd', 'and', 'the', 'for', 'with'].includes(t));
      const matchedDiffers =
        candidateMatchedTitle &&
        candidateMatchedTitle.trim().toLowerCase() !== programName.trim().toLowerCase() &&
        (reqTokens.length === 0 || reqTokens.some((t) => candidateMatchedTitle.toLowerCase().includes(t)));
      const matchedProgramName = matchedDiffers ? candidateMatchedTitle.trim() : undefined;

      const cleanSummary =
        chosen.summary && !hasBlockedSummaryText(chosen.summary)
          ? chosen.summary
          : `Verified official programme details from ${finalDomain || universityName}${
              matchedProgramName ? ` (listed officially as ${matchedProgramName})` : ''
            }. Open the official university link for full modules and entry guidance.`;

      const snapshot: VerifiedCourseSnapshot = {
        courseKey: verifyKey,
        courseId,
        officialUrl: verifiedDirectUrl || verifiedSources[0]?.uri,
        verifiedDomain: finalDomain || undefined,
        tuitionFeesEur: chosen.tuitionEur,
        originalTuitionAmount: chosen.tuitionAmount,
        originalTuitionCurrency: chosen.tuitionAmount !== null ? chosen.tuitionCurrency : null,
        tuitionQuote: chosen.tuitionQuote ? trimToCleanSentence(chosen.tuitionQuote, 240) : undefined,
        academicYear: chosen.academicYear || undefined,
        matchedProgramName,
        teachingLanguage: chosen.teachingLanguage || undefined,
        languageProficiency: chosen.languageProficiency || undefined,
        feeVerified,
        extractorVersion: CURRENT_EXTRACTOR_VERSION,
        min12thPercent: chosen.min12thPercent ?? (isUg ? 60 : 55),
        minDegreePercent: chosen.minDegreePercent ?? (isUg ? chosen.min12thPercent ?? 60 : 60),
        minIelts: chosen.minIelts ?? 6.0,
        englishPolicy: chosen.englishPolicy,
        intakes: chosen.intakes.length > 0 ? chosen.intakes : ['September'],
        subjectRequirements: trimToCleanSentence(
          hasBlockedSummaryText(chosen.subjectRequirements) || !chosen.subjectRequirements
            ? 'Verify exact prerequisites on the official programme page.'
            : chosen.subjectRequirements,
          240
        ),
        summary: trimToCleanSentence(cleanSummary, 300),
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
        feeVerified: false,
        extractorVersion: CURRENT_EXTRACTOR_VERSION,
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
    feeVerified: false,
    extractorVersion: CURRENT_EXTRACTOR_VERSION,
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
