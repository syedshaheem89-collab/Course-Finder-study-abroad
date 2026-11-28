import { sanitizeHttpUrl } from '@/lib/security/validation';
import {
  extractLanguageProficiency,
  normalizeTeachingLanguage,
  resolveCourseTeachingLanguage,
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
  ACADEMIC_PORTAL_SUBDOMAINS,
  AUTO_TAVILY_MONTHLY_LIMIT,
  CRON_POLICY_TAVILY_MONTHLY_LIMIT,
  CURRENT_EXTRACTOR_VERSION,
  DEFAULT_VERIFY_CACHE_DAYS,
  getCachedCourseVerification,
  getMonthlyTavilyUsage,
  HARD_TAVILY_MONTHLY_LIMIT,
  hasBlockedSummaryText,
  hasIrrelevantSummaryText,
  incrementTavilyUsage,
  isDepartmentSubpageUrl,
  isNonCourseUrl,
  isNonPortalSubdomainUrl,
  isSubdomainHost,
  makeCourseVerifyKey,
  saveCourseVerificationSnapshot,
  VerificationConsensusStatus,
  VerifiedCourseSnapshot,
} from '@/lib/course-verification-cache';
import { findCourseUrlInSitemap } from '@/lib/sitemap-course-matcher';
import {
  buildExpertCounselorPromptDirectives,
  getStatutoryPublicTuition,
} from '@/lib/expert-country-rules';
import {
  runBraveWebSearch,
  runSerperGoogleSearch,
} from '@/lib/external-search-agents';
import { classifyUniversityType } from '@/lib/university-classification';

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

async function resolveCanonicalUniversityHost(rawUrl?: string | null): Promise<string> {
  const initialHost = extractDomainHost(rawUrl);
  if (!rawUrl || !initialHost || !isGenericUniversityUrl(rawUrl).isGeneric) {
    return initialHost;
  }
  const safe = sanitizeHttpUrl(rawUrl);
  if (!safe) return initialHost;
  try {
    let res = await fetch(safe, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(2500),
      headers: { 'User-Agent': 'Orbis/2026' },
      cache: 'no-store',
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(safe, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'Orbis/2026' },
        cache: 'no-store',
      });
    }
    const finalHost = extractDomainHost(res.url);
    if (
      finalHost &&
      !isNonCourseUrl(res.url) &&
      !THIRD_PARTY_EXCLUDED_DOMAINS.some((d) => finalHost === d || finalHost.endsWith(`.${d}`))
    ) {
      return finalHost;
    }
  } catch {
    // Non-fatal
  }
  return initialHost;
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

export function isAmountGroundedInText(
  amount: number,
  pageText: string,
  tuitionQuote?: string | null
): boolean {
  if (numberAppearsInPageText(amount, pageText)) return true;
  const quoteAndPage = `${tuitionQuote || ''} ${pageText}`;
  return (
    amount > 0 &&
    amount % 2 === 0 &&
    numberAppearsInPageText(amount / 2, pageText) &&
    /\b(?:per\s+semester|\/\s*sem(?:ester)?|each\s+semester|per\s+term)\b/i.test(quoteAndPage)
  );
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
      signal: AbortSignal.timeout(5000),
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

const SUBJECT_STOP_WORDS = new Set([
  'msc',
  'bsc',
  'ma',
  'ba',
  'mba',
  'phd',
  'beng',
  'meng',
  'bba',
  'mph',
  'llm',
  'llb',
  'md',
  'master',
  'masters',
  'bachelor',
  'bachelors',
  'degree',
  'program',
  'programs',
  'programme',
  'programmes',
  'course',
  'courses',
  'study',
  'studies',
  'international',
  'track',
  'hons',
  'honours',
  'university',
  'faculty',
  'school',
  'department',
  'types',
  'and',
  'the',
  'for',
  'with',
  'of',
  'in',
  'to',
  'en',
]);

const SHORT_SUBJECT_ACRONYMS = new Set(['ai', 'it', 'hr', 'ux', 'ui']);

function extractSubjectKeywords(text: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => (t.length >= 3 || SHORT_SUBJECT_ACRONYMS.has(t)) && !SUBJECT_STOP_WORDS.has(t))
    )
  );
}

function isFeeOverviewUrl(rawUrl: string): boolean {
  const lower = String(rawUrl || '').toLowerCase();
  return (
    /\/(?:tuition|fees|funding|cost|tuition-fees)(?:\/|$|\?|-)/.test(lower) &&
    !/\/(?:course|courses|programme|programmes|program|programs|degree-programs?|study-programmes?|bachelor-studies|master-studies)\//.test(
      lower
    )
  );
}

export function scoreCandidatePage(
  url: string,
  title: string,
  knownHost: string,
  programName: string,
  degreeLevel?: string
): number {
  let score = 0;
  const host = extractDomainHost(url);
  if (!host || isNonCourseUrl(url) || isDepartmentSubpageUrl(url)) return -100;
  if (THIRD_PARTY_EXCLUDED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return -100;
  }

  const urlLower = url.toLowerCase();
  const titleLower = String(title || '').toLowerCase();
  const degLower = `${degreeLevel || ''} ${programName}`.toLowerCase();
  const wantsMba = /\bmba\b/.test(degLower);
  const wantsMaster = /\b(?:master|masters|msc|ma|mba|meng|llm|mph|postgraduate|pg)\b/.test(degLower);
  const wantsBachelor = /\b(?:bachelor|bachelors|bsc|ba|beng|bba|llb|undergraduate|ug)\b/.test(degLower);
  const isFeePage = /tuition|fees|funding|cost/.test(urlLower);

  if (wantsBachelor && !wantsMaster) {
    const masterUrl = /\/(?:master-studies|masters?|postgraduate|msc-|master-of-|m-[a-z])/i.test(urlLower);
    const masterTitle = !isFeePage && /\b(?:master\s+of|msc\b|mba\b)\b/.test(titleLower) && !/\bbachelor|bsc\b/.test(titleLower);
    if (masterUrl || masterTitle) return -100;
  }
  if (wantsMaster && !wantsBachelor) {
    const bachelorUrl = /\/(?:bachelor-studies|bachelors?|undergraduate|bsc-|b-[a-z])|-\d+-bsc\b/i.test(urlLower);
    const bachelorTitle = !isFeePage && /\b(?:bachelor\s+of|bsc\b)\b/.test(titleLower) && !/\bmaster|msc\b/.test(titleLower);
    if (bachelorUrl || bachelorTitle) return -100;
  }
  if (!wantsMba && /master-of-business-administration|\/mba\b|\/mba-/i.test(urlLower)) {
    return -100;
  }

  // Layer 1: Canonical university root domain > dedicated study portal > department/institute subdomain
  const subLabel = host.split('.')[0] || '';
  if (knownHost) {
    if (host === knownHost) {
      score += 65;
    } else if (host.endsWith(`.${knownHost}`)) {
      score += ACADEMIC_PORTAL_SUBDOMAINS.has(subLabel) ? 55 : 25;
    }
  } else {
    if (!isSubdomainHost(host)) {
      score += 20;
    } else if (ACADEMIC_PORTAL_SUBDOMAINS.has(subLabel)) {
      score += 12;
    }
  }

  if (/\.(edu|ac\.[a-z]{2}|uni-[a-z-]+|edu\.[a-z]{2})$/i.test(host) || host.includes('university') || host.includes('daad.de')) {
    score += 20;
  }
  if (!isGenericUniversityUrl(url).isGeneric) {
    score += 25;
  }

  // Layer 2: Official degree-catalogue paths & English track vs general fee-overview pages
  if (
    /\/(?:degree-programs?|study-programmes?|study-programs?|masters-degree-programs?|bachelors-degree-programs?|programmes?|programs?|courses?|studies|bachelor-studies|master-studies|undergraduate|postgraduate|degrees)\b/i.test(
      urlLower
    )
  ) {
    score += 22;
  }
  if (/\/en(?:\/|$)/.test(urlLower)) {
    score += 10;
  }
  if (isFeeOverviewUrl(url)) {
    score -= 18;
  }

  // Layer 3: Google-style subject recall + precision + exact-match bonus
  const reqTokens = extractSubjectKeywords(programName);
  let lastSeg = '';
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean);
    lastSeg = (segs[segs.length - 1] || '').replace(/\.(html?|php|aspx?)$/i, '');
  } catch {
    lastSeg = '';
  }
  const cleanPageTitle = String(title || '').split(/\s*[|–—]\s*/)[0] || '';
  const candText = `${cleanPageTitle} ${lastSeg}`;
  const candTokens = extractSubjectKeywords(candText);
  const fullHay = `${urlLower} ${titleLower}`;

  if (reqTokens.length > 0) {
    const matchedReq = reqTokens.filter((t) =>
      new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`).test(fullHay)
    ).length;
    const matchedCand = candTokens.filter((t) => reqTokens.includes(t)).length;
    const recall = matchedReq / reqTokens.length;
    const precision = candTokens.length > 0 ? matchedCand / candTokens.length : 0;
    score += Math.round(recall * 30 + precision * 35);
    if (recall === 1 && precision >= 0.85) {
      score += 25;
    }
  }

  return score;
}

async function fetchJinaReaderText(targetUrl: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: { Accept: 'text/plain', 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(4500),
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const txt = await res.text();
    return txt.trim().slice(0, 45000);
  } catch {
    return '';
  }
}

async function fetchDirectHtmlWithMeta(
  targetUrl: string
): Promise<{ text: string; rawHtml: string }> {
  try {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Orbis/2026' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return { text: '', rawHtml: '' };
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
    return { text: cleaned.slice(0, 45000), rawHtml: html.slice(0, 120000) };
  } catch {
    return { text: '', rawHtml: '' };
  }
}

async function fetchDirectHtmlText(targetUrl: string): Promise<string> {
  const { text } = await fetchDirectHtmlWithMeta(targetUrl);
  return text;
}

const CANONICAL_CATALOGUE_LINK_RE =
  /\/(?:degree-programs?|types-of-degree-programs|bachelors-and-diploma-degree-programs|masters-degree-programs|study-programmes?|study-programs?|bachelor-studies|master-studies|courses?|programmes?|programs?|degrees?)\//i;

function getRegistrableRootDomain(host: string): string {
  const clean = String(host || '').replace(/^www\./i, '').toLowerCase().trim();
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return clean;
  if (parts.length >= 3 && ['ac', 'edu', 'co', 'org', 'gov', 'com', 'net'].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function extractCanonicalDegreeLinkFromHtml(
  html: string,
  baseUrl: string,
  programName: string,
  degreeLevel?: string
): string | null {
  if (!html || !baseUrl) return null;
  let baseHost = '';
  try {
    baseHost = new URL(baseUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
  const rootDomain = getRegistrableRootDomain(baseHost);
  if (!rootDomain) return null;

  const anchorRe = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let bestUrl: string | null = null;
  let bestScore = 0;
  let seen = 0;

  while ((match = anchorRe.exec(html)) !== null && seen < 250) {
    seen += 1;
    const rawHref = match[1].trim();
    if (!rawHref || /^(?:mailto:|tel:|javascript:)/i.test(rawHref)) continue;
    let absUrl: string;
    let linkHost: string;
    let linkPath: string;
    try {
      const resolved = new URL(rawHref, baseUrl);
      absUrl = sanitizeHttpUrl(resolved.toString()) || '';
      if (!absUrl) continue;
      linkHost = resolved.hostname.replace(/^www\./i, '').toLowerCase();
      linkPath = resolved.pathname;
    } catch {
      continue;
    }

    if (linkHost !== rootDomain && !linkHost.endsWith(`.${rootDomain}`)) continue;
    if (!CANONICAL_CATALOGUE_LINK_RE.test(linkPath)) continue;
    if (isDepartmentSubpageUrl(absUrl) || isNonCourseUrl(absUrl) || isGenericUniversityUrl(absUrl).isGeneric) {
      continue;
    }
    if (absUrl.replace(/\/$/, '') === baseUrl.replace(/\/$/, '')) continue;

    const anchorText = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const score = scoreCandidatePage(absUrl, anchorText, rootDomain, programName, degreeLevel);
    if (score >= 90 && score > bestScore) {
      bestScore = score;
      bestUrl = absUrl;
    }
  }

  return bestUrl;
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
      signal: AbortSignal.timeout(2500),
      headers: { 'User-Agent': 'Orbis/2026' },
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(safe, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(2500),
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
  isRelevantCoursePage: boolean;
  bestOfficialCourseUrl: string | null;
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

    // Programmatic grounding check: only accept fee if printed directly (or exact 2x annual conversion of per-semester fee)
    if (rawAmount !== null && !isAmountGroundedInText(rawAmount, pageText, parsed.tuitionQuote)) {
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
      isRelevantCoursePage: parsed.isRelevantCoursePage !== false,
      bestOfficialCourseUrl:
        typeof parsed.bestOfficialCourseUrl === 'string' && parsed.bestOfficialCourseUrl.trim()
          ? sanitizeHttpUrl(parsed.bestOfficialCourseUrl.trim()) || null
          : null,
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

  const knownHost = await resolveCanonicalUniversityHost(courseUrl);
  let searchProvider:
    | 'tavily'
    | 'serper'
    | 'brave'
    | 'sitemap'
    | 'gemini-grounding'
    | 'fallback' = 'fallback';
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
      let sitemapText = await fetchDirectHtmlText(sitemapUrl);
      if (isBlockedOrChallengePage(sitemapText)) sitemapText = '';
      if (sitemapText.length < 400) {
        const jinaText = await fetchJinaReaderText(sitemapUrl);
        if (jinaText && !isBlockedOrChallengePage(jinaText) && jinaText.length > sitemapText.length) {
          sitemapText = jinaText;
        }
      }
      if (sitemapText.length >= 400) {
        sitemapHasReadablePage = true;
        searchProvider = 'sitemap';
        pushCandidate(sitemapUrl, programName, '', 95);
        candidates[0].rawContent = sitemapText;
      } else {
        pushCandidate(sitemapUrl, programName, '', 75);
      }
    }
  }

  // Include direct known URL as candidate if non-generic
  if (courseUrl && !isGenericUniversityUrl(courseUrl).isGeneric) {
    pushCandidate(courseUrl, programName, '', isDepartmentSubpageUrl(courseUrl) ? 20 : 60);
  }

  const hasStrongDirectCandidate = () =>
    candidates.some((c) => c.score >= 70 && !isGenericUniversityUrl(c.url).isGeneric);

  const searchProgramClean =
    programName.replace(/^\s*(?:bsc|msc|ba|ma|beng|meng|bba|mph|md)\s+(?:in|of)\s+/i, '').trim() ||
    programName;

  // STEP 1A: Official Domain-Locked Web Discovery (1-credit Tavily basic, quota-guarded)
  if (!sitemapHasReadablePage && process.env.TAVILY_API_KEY?.trim()) {
    const usage = await getMonthlyTavilyUsage();
    const limitForCaller = autoTrigger ? AUTO_TAVILY_MONTHLY_LIMIT : HARD_TAVILY_MONTHLY_LIMIT;

    if (usage.tavilyCreditsUsed < limitForCaller) {
      usedTavily = true;
      const tavilyRows = knownHost
        ? await runTavilySearch({
            query: `${searchProgramClean} ${degreeLevel || ''} international tuition fees entry requirements ${country}`,
            includeDomains: [knownHost],
            maxResults: 4,
            searchDepth: 'basic',
          })
        : await runTavilySearch({
            query: `"${universityName}" ${searchProgramClean} ${country} official international tuition fees`,
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
        const score = scoreCandidatePage(cleanUrl, title, knownHost, programName, degreeLevel);
        if (score >= 0) {
          pushCandidate(cleanUrl, title, snippet, score);
        }
      }
      if (tavilyRows.length > 0 && candidates.length > 0) {
        searchProvider = 'tavily';
      }
    }
  }

  // STEP 1B: Optional Free Serper.dev Google Search Agent (when SERPER_API_KEY is set & prior steps lacked a strong match)
  if (!sitemapHasReadablePage && !hasStrongDirectCandidate() && process.env.SERPER_API_KEY?.trim()) {
    const serperQuery = knownHost
      ? `${searchProgramClean} ${degreeLevel || ''} degree program international tuition fees`
      : `"${universityName}" ${searchProgramClean} ${degreeLevel || ''} ${country} official degree program`;
    const serperRows = await runSerperGoogleSearch({
      query: serperQuery,
      siteDomain: knownHost || undefined,
      excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
      maxResults: 5,
    });
    let added = 0;
    for (const r of serperRows) {
      const score = scoreCandidatePage(r.url, r.title, knownHost, programName, degreeLevel);
      if (score >= 0) {
        pushCandidate(r.url, r.title, r.content, score);
        added += 1;
      }
    }
    if (added > 0 && searchProvider === 'fallback') {
      searchProvider = 'serper';
    }
  }

  // STEP 1C: Optional Free Brave Web Search Agent (when BRAVE_SEARCH_API_KEY is set & prior steps lacked a strong match)
  if (!sitemapHasReadablePage && !hasStrongDirectCandidate() && process.env.BRAVE_SEARCH_API_KEY?.trim()) {
    const braveQuery = knownHost
      ? `${searchProgramClean} ${degreeLevel || ''} degree program international tuition fees`
      : `"${universityName}" ${searchProgramClean} ${degreeLevel || ''} ${country} official degree program`;
    const braveRows = await runBraveWebSearch({
      query: braveQuery,
      siteDomain: knownHost || undefined,
      excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
      maxResults: 5,
    });
    let added = 0;
    for (const r of braveRows) {
      const score = scoreCandidatePage(r.url, r.title, knownHost, programName, degreeLevel);
      if (score >= 0) {
        pushCandidate(r.url, r.title, r.content, score);
        added += 1;
      }
    }
    if (added > 0 && searchProvider === 'fallback') {
      searchProvider = 'brave';
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
            signal: AbortSignal.timeout(5000),
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
            const score = scoreCandidatePage(uri, title, knownHost, programName, degreeLevel);
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
            const score = scoreCandidatePage(u, programName, knownHost, programName, degreeLevel);
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
  let verifiedCourseUrl: string | undefined;
  let verifiedFallbackUrl: string | undefined;
  let bestDiscoveredTitle: string | null = null;
  const pageChunks: string[] = [];
  const verifiedSources: { title: string; uri: string }[] = [];

  for (const cand of candidates.slice(0, 3)) {
    if (isNonCourseUrl(cand.url)) continue;
    // Prevent unrelated pages (conferences, news, events, brochures) from masquerading as programme pages
    if (
      cand.score < 85 &&
      cand.url !== courseUrl &&
      !candidateMatchesProgramOrFees(cand.url, cand.title, programName)
    ) {
      continue;
    }

    const check = await verifyUrlReachable(cand.url);
    let targetUrl = check.finalUrl || cand.url;
    if (isNonCourseUrl(targetUrl)) continue;
    let rawHtml = '';
    let bodyText = cand.rawContent && cand.rawContent.length >= 600 ? cand.rawContent : '';
    if (!bodyText && (check.reachable || cand.score >= 40)) {
      const [jinaRes, htmlMeta] = await Promise.all([
        fetchJinaReaderText(targetUrl),
        fetchDirectHtmlWithMeta(targetUrl),
      ]);
      rawHtml = htmlMeta.rawHtml;
      bodyText = jinaRes || htmlMeta.text;
    } else if (isDepartmentSubpageUrl(targetUrl) || isNonPortalSubdomainUrl(targetUrl)) {
      const htmlMeta = await fetchDirectHtmlWithMeta(targetUrl);
      rawHtml = htmlMeta.rawHtml;
    }

    // 0-Credit Canonical Degree-Link Follower: follow central /degree-programs/ link from institute/teaching sub-pages
    if (rawHtml && (isDepartmentSubpageUrl(targetUrl) || isNonPortalSubdomainUrl(targetUrl))) {
      const canonicalUrl = extractCanonicalDegreeLinkFromHtml(
        rawHtml,
        targetUrl,
        programName,
        degreeLevel
      );
      if (canonicalUrl && canonicalUrl !== targetUrl) {
        const canonHtmlMeta = await fetchDirectHtmlWithMeta(canonicalUrl);
        let canonBody =
          canonHtmlMeta.text.length >= 400
            ? canonHtmlMeta.text
            : (await fetchJinaReaderText(canonicalUrl)) || canonHtmlMeta.text;
        if (canonBody && !isBlockedOrChallengePage(canonBody) && canonBody.length >= 250) {
          targetUrl = canonicalUrl;
          bodyText = canonBody;
        }
      }
    }

    if (isDepartmentSubpageUrl(targetUrl)) {
      continue;
    }

    if (bodyText && isBlockedOrChallengePage(bodyText)) {
      // Never try to bypass CAPTCHAs or Cloudflare; discard challenge HTML and rely cleanly on indexed snippets
      bodyText = '';
    }
    if (!bodyText && cand.snippet) {
      bodyText = cand.snippet;
    }

    if ((check.reachable || bodyText.length >= 400) && !isGenericUniversityUrl(targetUrl).isGeneric) {
      if (!verifiedCourseUrl && !isFeeOverviewUrl(targetUrl)) {
        verifiedCourseUrl = targetUrl;
      } else if (!verifiedFallbackUrl) {
        verifiedFallbackUrl = targetUrl;
      }
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
  const resolvedSector = classifyUniversityType(universityName, country);
  const inferredLangInfo = resolveCourseTeachingLanguage({
    program_name: programName,
    course_url: verifiedCourseUrl || verifiedFallbackUrl || courseUrl,
    university: { name: universityName, country },
  });
  const expertDirectives = buildExpertCounselorPromptDirectives({
    country,
    degreeLevel,
    universityName,
    teachingLanguageHint: inferredLangInfo.language,
    proficiencyHint: inferredLangInfo.proficiencyRequired,
  });

  const runExtractionConsensus = async (
    textToAnalyze: string
  ): Promise<{
    chosen: ParsedExtraction;
    consensusStatus: VerificationConsensusStatus;
    providersUsed: string[];
  } | null> => {
    const extractPrompt = `You are a strict university admissions data extractor and 20-year study-abroad counselor.
Extract information ONLY from the official university page text provided below for:
University: ${universityName} (${country})
Programme requested: ${programName} (${degreeLevel || 'Degree'})
${bestDiscoveredTitle ? `Detected official candidate title: ${bestDiscoveredTitle}\n` : ''}Typical billing currency in ${country}: ${expectedBilling} (always report the exact currency symbol/code printed on the official page).

${expertDirectives ? `${expertDirectives}\n\n` : ''}STRICT ACCURACY RULES (ALL COUNTRIES):
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
9. Set "isRelevantCoursePage" to false if the provided text is for an unrelated page (such as a scientific conference, news article, event, staff page, or unrelated discipline) and does NOT describe this programme or its nearest official programme.
10. In "bestOfficialCourseUrl", copy the exact SOURCE URL from the provided sources that is the primary official university programme page for this degree (always prefer the main university degree-catalogue page over a research-institute sub-site or a general tuition-fee overview page).
11. In "summary", write 1-2 clean student-facing sentences describing the programme; NEVER mention CAPTCHA, scraping errors, or missing text.

Return strictly valid JSON:
{
  "isRelevantCoursePage": boolean,
  "bestOfficialCourseUrl": string | null,
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
  "isRelevantCoursePage": boolean,
  "bestOfficialCourseUrl": string | null,
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

  let verifiedDirectUrl: string | undefined = verifiedCourseUrl || verifiedFallbackUrl;

  // STEP 3: Multi-AI Strict Extract-Only Consensus (Groq + Gemini + OpenAI Judge)
  if (combinedPageText.length >= 120) {
    let extraction = await runExtractionConsensus(combinedPageText);

    // STEP 3b: Dedicated Fee-Snippet Fallback (Tavily quota-guarded OR free Serper/Brave fallback)
    if (!extraction || extraction.chosen.tuitionEur === null) {
      const targetTitleQuery = bestDiscoveredTitle || programName;
      let feeRows: Array<{ url?: string; title?: string; content?: string }> = [];
      let feeProviderUsed: 'tavily' | 'serper' | 'brave' | null = null;

      if (process.env.TAVILY_API_KEY?.trim()) {
        const usage = await getMonthlyTavilyUsage();
        const limitForCaller = autoTrigger ? AUTO_TAVILY_MONTHLY_LIMIT : HARD_TAVILY_MONTHLY_LIMIT;
        if (usage.tavilyCreditsUsed < limitForCaller) {
          usedTavily = true;
          feeRows = knownHost
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
          if (feeRows.length > 0) feeProviderUsed = 'tavily';
        }
      }

      if (feeRows.length === 0 && process.env.SERPER_API_KEY?.trim()) {
        const serperFeeRows = await runSerperGoogleSearch({
          query: `"${targetTitleQuery}" "${universityName}" international tuition fees ${country} 2026`,
          siteDomain: knownHost || undefined,
          excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
          maxResults: 4,
        });
        if (serperFeeRows.length > 0) {
          feeRows = serperFeeRows;
          feeProviderUsed = 'serper';
        }
      }

      if (feeRows.length === 0 && process.env.BRAVE_SEARCH_API_KEY?.trim()) {
        const braveFeeRows = await runBraveWebSearch({
          query: `"${targetTitleQuery}" "${universityName}" international tuition fees ${country} 2026`,
          siteDomain: knownHost || undefined,
          excludeDomains: THIRD_PARTY_EXCLUDED_DOMAINS,
          maxResults: 4,
        });
        if (braveFeeRows.length > 0) {
          feeRows = braveFeeRows;
          feeProviderUsed = 'brave';
        }
      }

      if (feeRows.length > 0) {
        const existingUris = new Set(verifiedSources.map((s) => s.uri));
        const feeCandidates = feeRows
          .map((r: any) => {
            const u = sanitizeHttpUrl(String(r?.url || ''));
            if (!u) return null;
            const title = String(r?.title || '').trim();
            const snippet = String(r?.content || '').trim();
            const score = scoreCandidatePage(u, title, knownHost, targetTitleQuery, degreeLevel);
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

        // Also include any clean search indexed snippets containing fee amounts
        const cleanFeeSnippets = feeRows
          .map((r: any) => `${String(r?.title || '')}: ${String(r?.content || '').trim()}`)
          .filter((s) => s.length >= 40 && /\d{3,6}|[£€$]/.test(s))
          .slice(0, 3);
        if (cleanFeeSnippets.length > 0) {
          extraChunks.push(`SEARCH ENGINE INDEXED FEE SNIPPETS:\n${cleanFeeSnippets.join('\n')}`);
        }

        if (extraChunks.length > 0) {
          if (feeProviderUsed) searchProvider = feeProviderUsed;
          combinedPageText = `${combinedPageText}\n\n---\n\n${extraChunks.join('\n\n')}`.slice(0, 14000);
          const feeExtraction = await runExtractionConsensus(combinedPageText);
          if (feeExtraction && feeExtraction.chosen.tuitionEur !== null) {
            extraction = feeExtraction;
          }
        }
      }
    }

    if (
      extraction &&
      (extraction.chosen.isRelevantCoursePage === false ||
        hasIrrelevantSummaryText(extraction.chosen.summary) ||
        isNonCourseUrl(verifiedDirectUrl || verifiedSources[0]?.uri) ||
        isDepartmentSubpageUrl(verifiedDirectUrl || verifiedSources[0]?.uri))
    ) {
      extraction = null;
      verifiedDirectUrl = undefined;
    }

    if (extraction) {
      const { chosen, consensusStatus, providersUsed } = extraction;
      const aiPickedSource = chosen.bestOfficialCourseUrl
        ? verifiedSources.find(
            (s) => s.uri.trim().toLowerCase() === chosen.bestOfficialCourseUrl!.trim().toLowerCase()
          )?.uri
        : undefined;
      const primaryOfficialUrl =
        (aiPickedSource &&
        !isGenericUniversityUrl(aiPickedSource).isGeneric &&
        !isNonCourseUrl(aiPickedSource) &&
        !isDepartmentSubpageUrl(aiPickedSource) &&
        (!isFeeOverviewUrl(aiPickedSource) || !verifiedCourseUrl)
          ? aiPickedSource
          : undefined) ||
        verifiedDirectUrl ||
        verifiedSources[0]?.uri;
      const finalDomain =
        extractDomainHost(primaryOfficialUrl) || extractDomainHost(verifiedSources[0]?.uri) || knownHost;

      const statutoryFee =
        chosen.tuitionEur === null || chosen.tuitionEur === undefined
          ? getStatutoryPublicTuition(country, universityName, resolvedSector)
          : null;

      const resolvedTuitionEur =
        chosen.tuitionEur !== null && chosen.tuitionEur !== undefined
          ? chosen.tuitionEur
          : statutoryFee
          ? statutoryFee.tuitionEur
          : null;
      const resolvedOrigAmount =
        chosen.tuitionAmount !== null && chosen.tuitionAmount !== undefined
          ? chosen.tuitionAmount
          : statutoryFee
          ? statutoryFee.originalAmount
          : null;
      const resolvedOrigCurrency =
        chosen.tuitionAmount !== null && chosen.tuitionAmount !== undefined
          ? chosen.tuitionCurrency
          : statutoryFee
          ? statutoryFee.currency
          : null;
      const resolvedTuitionQuote = chosen.tuitionQuote
        ? trimToCleanSentence(chosen.tuitionQuote, 240)
        : statutoryFee
        ? statutoryFee.quote
        : undefined;
      const feeSource: 'page-extracted' | 'statutory-public' | undefined =
        chosen.tuitionEur !== null && chosen.tuitionEur !== undefined
          ? 'page-extracted'
          : statutoryFee
          ? 'statutory-public'
          : undefined;
      const feeVerified = resolvedTuitionEur !== null && resolvedTuitionEur !== undefined;

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
        officialUrl: primaryOfficialUrl,
        verifiedDomain: finalDomain || undefined,
        tuitionFeesEur: resolvedTuitionEur,
        originalTuitionAmount: resolvedOrigAmount,
        originalTuitionCurrency: resolvedOrigCurrency,
        tuitionQuote: resolvedTuitionQuote,
        academicYear: chosen.academicYear || undefined,
        matchedProgramName,
        teachingLanguage: chosen.teachingLanguage || undefined,
        languageProficiency: chosen.languageProficiency || undefined,
        feeVerified,
        feeSource,
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
  const fallbackLangNotice = inferredLangInfo.isLocalLanguageRequired
    ? `CRITICAL LANGUAGE RULE: This programme's expected medium of instruction is ${inferredLangInfo.displayLabel}. NEVER claim it is taught or offered in English.\n`
    : '';
  const fallbackAiRaw = await callGroqFreeJson(
    `Provide current 2026 international admission requirements for ${universityName} (${country}) — ${programName} (${degreeLevel || 'Degree'}).
${expertDirectives ? `${expertDirectives}\n` : ''}${fallbackLangNotice}Return JSON: {"min12thPercent": number, "minDegreePercent": number, "minIelts": number, "englishPolicy": "IELTS_TOEFL"|"MOI_ACCEPTED"|"WAIVED", "intakes": string[], "subjectRequirements": string, "summary": string}.`
  );
  if (fallbackAiRaw) {
    try {
      const p = JSON.parse(fallbackAiRaw);
      let safeSummary = String(
        p.summary || 'Verify live fee details directly on the official university portal.'
      );
      if (
        inferredLangInfo.isLocalLanguageRequired &&
        /\b(?:taught|offered|delivered|instructed|conducted)\s+(?:entirely\s+|fully\s+)?in\s+english\b/i.test(
          safeSummary
        )
      ) {
        safeSummary = safeSummary.replace(
          /\b(?:taught|offered|delivered|instructed|conducted)\s+(?:entirely\s+|fully\s+)?in\s+english\b/gi,
          `taught in ${inferredLangInfo.displayLabel}`
        );
      }
      const fallbackStatutory = getStatutoryPublicTuition(country, universityName, resolvedSector);
      const snap: VerifiedCourseSnapshot = {
        courseKey: verifyKey,
        courseId,
        officialUrl: verifiedDirectUrl,
        verifiedDomain: extractDomainHost(verifiedDirectUrl || courseUrl) || undefined,
        tuitionFeesEur: fallbackStatutory ? fallbackStatutory.tuitionEur : null,
        originalTuitionAmount: fallbackStatutory ? fallbackStatutory.originalAmount : null,
        originalTuitionCurrency: fallbackStatutory ? fallbackStatutory.currency : null,
        tuitionQuote: fallbackStatutory ? fallbackStatutory.quote : undefined,
        feeVerified: Boolean(fallbackStatutory),
        feeSource: fallbackStatutory ? 'statutory-public' : undefined,
        ...(inferredLangInfo.isLocalLanguageRequired
          ? {
              teachingLanguage: inferredLangInfo.language,
              languageProficiency: inferredLangInfo.proficiencyRequired,
            }
          : {}),
        extractorVersion: CURRENT_EXTRACTOR_VERSION,
        min12thPercent: Number(p.min12thPercent) || (isUg ? 60 : 55),
        minDegreePercent: Number(p.minDegreePercent) || (isUg ? 60 : 55),
        minIelts: Number(p.minIelts) || 6.0,
        englishPolicy: ['MOI_ACCEPTED', 'WAIVED'].includes(p.englishPolicy) ? p.englishPolicy : 'IELTS_TOEFL',
        intakes: Array.isArray(p.intakes) && p.intakes.length > 0 ? p.intakes.slice(0, 4) : ['September'],
        subjectRequirements: String(p.subjectRequirements || ''),
        summary: trimToCleanSentence(safeSummary, 300),
        consensusStatus: 'ai-search',
        providersUsed: ['ai-fallback'],
        searchProvider,
        verifiedAt: new Date().toISOString(),
        sources: verifiedSources,
      };
      if (verifiedDirectUrl) {
        await saveCourseVerificationSnapshot(snap);
      }
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
