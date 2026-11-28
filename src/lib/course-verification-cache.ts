import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizeCountryName } from '@/lib/countries';
import { sanitizeHttpUrl } from '@/lib/security/validation';

export type VerificationConsensusStatus =
  | 'consensus-2ai'
  | 'judge-resolved'
  | 'single-page-verified'
  | 'ai-search'
  | 'baseline';

export interface VerifiedCourseSnapshot {
  courseKey: string;
  courseId?: string;
  officialUrl?: string;
  verifiedDomain?: string;
  tuitionFeesEur?: number | null;
  originalTuitionAmount?: number | null;
  originalTuitionCurrency?: string | null;
  tuitionQuote?: string;
  academicYear?: string;
  matchedProgramName?: string;
  teachingLanguage?: string;
  languageProficiency?: string;
  feeVerified?: boolean;
  extractorVersion?: number;
  min12thPercent?: number;
  minDegreePercent?: number;
  minIelts?: number;
  englishPolicy?: string;
  intakes?: string[];
  subjectRequirements?: string;
  summary?: string;
  consensusStatus: VerificationConsensusStatus;
  providersUsed: string[];
  searchProvider: 'tavily' | 'gemini-grounding' | 'fallback';
  verifiedAt: string;
  sources: { title: string; uri: string }[];
}

export interface MonthlyTavilyUsage {
  month: string; // YYYY-MM
  tavilyCreditsUsed: number;
}

export const COURSE_VERIFY_CACHE_EMAIL = '__course_verify_cache__';
export const DEFAULT_VERIFY_CACHE_DAYS = 180;
export const AUTO_TAVILY_MONTHLY_LIMIT = 700;
export const CRON_POLICY_TAVILY_MONTHLY_LIMIT = 850;
export const HARD_TAVILY_MONTHLY_LIMIT = 900;
export const CURRENT_EXTRACTOR_VERSION = 3;

export const NON_COURSE_URL_RE =
  /\/(?:conference|conferences|symposium|congress|workshop|news|all-news|blog|blogs|event|events|calendar|press|media|alumni|staff|people|faculty|directory|careers|jobs|vacancy|vacancies|library|repository|publications?|journal|thesis|dissertation|privacy|cookie|cookies|terms|contact|about-us|sitemap)\b/i;

export const NON_COURSE_SUBDOMAIN_RE =
  /^(?:conf|conference|etech|blog|news|events|press|alumni|library|repo|repository|moodle|elearning|mail|webmail|intranet|portal)\./i;

export const ACADEMIC_PORTAL_SUBDOMAINS = new Set([
  'study',
  'studies',
  'admission',
  'admissions',
  'apply',
  'course',
  'courses',
  'programme',
  'programmes',
  'program',
  'programs',
  'degree',
  'degrees',
  'international',
  'en',
  'prospectus',
]);

const SECOND_LEVEL_DOMAINS = new Set(['ac', 'edu', 'co', 'org', 'gov', 'com', 'net', 'or', 'ne']);

export function isSubdomainHost(rawHost?: string | null): boolean {
  const clean = String(rawHost || '').replace(/^www\./i, '').trim().toLowerCase();
  if (!clean) return false;
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return false;
  if (parts.length === 3 && SECOND_LEVEL_DOMAINS.has(parts[1])) return false;
  return true;
}

export function isNonPortalSubdomainUrl(rawUrl?: string | null): boolean {
  const raw = String(rawUrl || '').trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase();
    if (!isSubdomainHost(host)) return false;
    const sub = host.split('.')[0] || '';
    return !ACADEMIC_PORTAL_SUBDOMAINS.has(sub);
  } catch {
    return false;
  }
}

export function isNonCourseUrl(rawUrl?: string | null): boolean {
  const raw = String(rawUrl || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (NON_COURSE_SUBDOMAIN_RE.test(host)) return true;
    return NON_COURSE_URL_RE.test(parsed.pathname);
  } catch {
    return NON_COURSE_URL_RE.test(raw);
  }
}

export function hasBlockedSummaryText(summary?: string | null): boolean {
  return /\b(?:captcha|cloudflare|access\s+denied|security\s+check|verify\s+you\s+are\s+human|are\s+you\s+a\s+robot|just\s+a\s+moment)\b/i.test(
    String(summary || '')
  );
}

export function hasIrrelevantSummaryText(summary?: string | null): boolean {
  return /does\s+not\s+contain\s+(?:any\s+)?information\s+about|no\s+information\s+about\s+the\s+.*(?:programme|program|course)|is\s+for\s+an?\s+.*(?:conference|symposium|event|news\s+article|blog)|not\s+(?:about|for)\s+the\s+.*(?:programme|program|course)|unrelated\s+(?:page|article|event|conference)|provided\s+text\s+(?:is\s+for|does\s+not\s+(?:mention|describe|contain))/i.test(
    String(summary || '')
  );
}

export function isUsableVerifiedSnapshot(snap?: VerifiedCourseSnapshot | null): boolean {
  if (!snap) return false;
  if (hasBlockedSummaryText(snap.summary) || hasIrrelevantSummaryText(snap.summary)) return false;
  if (isNonCourseUrl(snap.officialUrl)) return false;
  if (snap.consensusStatus === 'baseline') return false;
  if (snap.consensusStatus === 'ai-search' && !snap.officialUrl) return false;
  return true;
}

interface CachedVerifyStore {
  snapshots: Record<string, VerifiedCourseSnapshot>;
  usage: MonthlyTavilyUsage;
  expiresAt: number;
}

const globalForVerify = globalThis as unknown as {
  __orbisVerifyCache?: CachedVerifyStore;
};

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function invalidateCourseVerificationCache(): void {
  globalForVerify.__orbisVerifyCache = undefined;
}

export function makeCourseVerifyKey(
  country?: string | null,
  universityName?: string | null,
  programName?: string | null
): string {
  const normCountry = (normalizeCountryName(country || '') || country || 'global')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normUni = String(universityName || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normProg = String(programName || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return `${normCountry}::${normUni}::${normProg}`;
}

function sanitizeSnapshot(raw: any): VerifiedCourseSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const courseKey = String(raw.courseKey || '').trim().slice(0, 300);
  if (!courseKey) return null;

  const officialUrl = raw.officialUrl ? sanitizeHttpUrl(String(raw.officialUrl)) || undefined : undefined;
  const sources = Array.isArray(raw.sources)
    ? raw.sources
        .map((s: any) => ({
          title: String(s?.title || '').trim().slice(0, 120),
          uri: sanitizeHttpUrl(String(s?.uri || '')) || '',
        }))
        .filter((s: any) => Boolean(s.uri))
        .slice(0, 4)
    : [];

  const allowedConsensus = new Set([
    'consensus-2ai',
    'judge-resolved',
    'single-page-verified',
    'ai-search',
    'baseline',
  ]);

  const tuitionFeesEur =
    raw.tuitionFeesEur !== undefined && raw.tuitionFeesEur !== null && Number.isFinite(Number(raw.tuitionFeesEur))
      ? Math.max(0, Math.round(Number(raw.tuitionFeesEur)))
      : null;

  return {
    courseKey,
    ...(raw.courseId ? { courseId: String(raw.courseId).slice(0, 120) } : {}),
    ...(officialUrl ? { officialUrl } : {}),
    ...(raw.verifiedDomain ? { verifiedDomain: String(raw.verifiedDomain).slice(0, 100) } : {}),
    tuitionFeesEur,
    originalTuitionAmount:
      raw.originalTuitionAmount !== undefined &&
      raw.originalTuitionAmount !== null &&
      Number.isFinite(Number(raw.originalTuitionAmount))
        ? Math.max(0, Math.round(Number(raw.originalTuitionAmount)))
        : null,
    ...(raw.originalTuitionCurrency
      ? { originalTuitionCurrency: String(raw.originalTuitionCurrency).slice(0, 10) }
      : {}),
    ...(raw.tuitionQuote ? { tuitionQuote: String(raw.tuitionQuote).slice(0, 260) } : {}),
    ...(raw.academicYear ? { academicYear: String(raw.academicYear).slice(0, 20) } : {}),
    ...(raw.matchedProgramName
      ? { matchedProgramName: String(raw.matchedProgramName).trim().slice(0, 180) }
      : {}),
    ...(raw.teachingLanguage
      ? { teachingLanguage: String(raw.teachingLanguage).trim().slice(0, 40) }
      : {}),
    ...(raw.languageProficiency
      ? { languageProficiency: String(raw.languageProficiency).trim().slice(0, 80) }
      : {}),
    feeVerified: typeof raw.feeVerified === 'boolean' ? raw.feeVerified : tuitionFeesEur !== null,
    extractorVersion:
      raw.extractorVersion !== undefined && Number.isFinite(Number(raw.extractorVersion))
        ? Math.max(1, Math.floor(Number(raw.extractorVersion)))
        : 1,
    ...(raw.min12thPercent !== undefined && Number.isFinite(Number(raw.min12thPercent))
      ? { min12thPercent: Number(raw.min12thPercent) }
      : {}),
    ...(raw.minDegreePercent !== undefined && Number.isFinite(Number(raw.minDegreePercent))
      ? { minDegreePercent: Number(raw.minDegreePercent) }
      : {}),
    ...(raw.minIelts !== undefined && Number.isFinite(Number(raw.minIelts))
      ? { minIelts: Number(raw.minIelts) }
      : {}),
    ...(raw.englishPolicy ? { englishPolicy: String(raw.englishPolicy).slice(0, 30) } : {}),
    intakes: Array.isArray(raw.intakes)
      ? raw.intakes.map((x: any) => String(x).slice(0, 30)).slice(0, 4)
      : [],
    ...(raw.subjectRequirements ? { subjectRequirements: String(raw.subjectRequirements).slice(0, 260) } : {}),
    ...(raw.summary ? { summary: String(raw.summary).slice(0, 360) } : {}),
    consensusStatus: allowedConsensus.has(raw.consensusStatus) ? raw.consensusStatus : 'single-page-verified',
    providersUsed: Array.isArray(raw.providersUsed)
      ? raw.providersUsed.map((x: any) => String(x).slice(0, 30)).slice(0, 5)
      : [],
    searchProvider:
      raw.searchProvider === 'tavily' || raw.searchProvider === 'gemini-grounding'
        ? raw.searchProvider
        : 'fallback',
    verifiedAt:
      typeof raw.verifiedAt === 'string' && raw.verifiedAt.trim()
        ? raw.verifiedAt.trim()
        : new Date().toISOString(),
    sources,
  };
}

function sanitizeUsage(raw: any): MonthlyTavilyUsage {
  const ym = currentYearMonth();
  if (!raw || typeof raw !== 'object' || raw.month !== ym) {
    return { month: ym, tavilyCreditsUsed: 0 };
  }
  const used = Number(raw.tavilyCreditsUsed);
  return {
    month: ym,
    tavilyCreditsUsed: Number.isFinite(used) && used >= 0 ? Math.floor(used) : 0,
  };
}

async function loadVerificationStore(forceFresh = false): Promise<{
  snapshots: Record<string, VerifiedCourseSnapshot>;
  usage: MonthlyTavilyUsage;
}> {
  const now = Date.now();
  const cached = globalForVerify.__orbisVerifyCache;
  if (!forceFresh && cached && cached.expiresAt > now) {
    return { snapshots: cached.snapshots, usage: sanitizeUsage(cached.usage) };
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('background_profile')
      .eq('email', COURSE_VERIFY_CACHE_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;
    const bp = !error && row?.background_profile && typeof row.background_profile === 'object'
      ? (row.background_profile as any)
      : null;

    const rawMap = bp?.snapshots;
    const clean: Record<string, VerifiedCourseSnapshot> = {};
    if (rawMap && typeof rawMap === 'object') {
      for (const [k, v] of Object.entries(rawMap)) {
        const snap = sanitizeSnapshot(v);
        if (snap) clean[k] = snap;
      }
    }
    const usage = sanitizeUsage(bp?.usage);

    globalForVerify.__orbisVerifyCache = {
      snapshots: clean,
      usage,
      expiresAt: now + 300_000,
    };

    return { snapshots: clean, usage };
  } catch {
    return { snapshots: {}, usage: { month: currentYearMonth(), tavilyCreditsUsed: 0 } };
  }
}

async function persistVerificationStore(
  snapshots: Record<string, VerifiedCourseSnapshot>,
  usage: MonthlyTavilyUsage
): Promise<boolean> {
  try {
    const entries = Object.entries(snapshots)
      .sort((a, b) => new Date(b[1].verifiedAt).getTime() - new Date(a[1].verifiedAt).getTime())
      .slice(0, 400);
    const trimmedMap = Object.fromEntries(entries);
    const cleanUsage = sanitizeUsage(usage);

    const supabase = createServerSupabaseClient();
    await supabase.from('inquiries').delete().eq('email', COURSE_VERIFY_CACHE_EMAIL);

    const { error } = await supabase.from('inquiries').insert({
      student_name: '__COURSE_VERIFY_CACHE__',
      email: COURSE_VERIFY_CACHE_EMAIL,
      phone: 'SYSTEM',
      background_profile: {
        snapshots: trimmedMap,
        usage: cleanUsage,
        updated_at: new Date().toISOString(),
      },
      ai_suggested_courses: {},
    });

    if (error) return false;

    globalForVerify.__orbisVerifyCache = {
      snapshots: trimmedMap,
      usage: cleanUsage,
      expiresAt: Date.now() + 300_000,
    };
    return true;
  } catch {
    return false;
  }
}

export async function getCourseVerificationCache(
  forceFresh = false
): Promise<Record<string, VerifiedCourseSnapshot>> {
  const { snapshots } = await loadVerificationStore(forceFresh);
  return snapshots;
}

export async function getCachedCourseVerification(
  country?: string | null,
  universityName?: string | null,
  programName?: string | null,
  maxAgeDays = DEFAULT_VERIFY_CACHE_DAYS
): Promise<VerifiedCourseSnapshot | null> {
  const key = makeCourseVerifyKey(country, universityName, programName);
  const map = await getCourseVerificationCache(false);
  const hit = map[key];
  if (!hit) return null;
  const ageMs = Date.now() - new Date(hit.verifiedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > maxAgeDays * 86_400_000) {
    return null;
  }
  const hasFee = hit.tuitionFeesEur !== null && hit.tuitionFeesEur !== undefined;
  const hasUnparsedSemesterQuote =
    !hasFee &&
    Boolean(
      hit.tuitionQuote &&
        /\d{3,6}/.test(hit.tuitionQuote) &&
        /\b(?:per\s+semester|\/\s*sem(?:ester)?|each\s+semester|semester|per\s+term)\b/i.test(
          hit.tuitionQuote
        )
    );
  const hasSuboptimalInstituteLink = !hasFee && isNonPortalSubdomainUrl(hit.officialUrl);
  if (
    !isUsableVerifiedSnapshot(hit) ||
    hasUnparsedSemesterQuote ||
    hasSuboptimalInstituteLink ||
    (!hasFee && (hit.extractorVersion || 1) < CURRENT_EXTRACTOR_VERSION)
  ) {
    return null;
  }
  return hit;
}

export async function getMonthlyTavilyUsage(): Promise<MonthlyTavilyUsage> {
  const { usage } = await loadVerificationStore(false);
  return usage;
}

export async function incrementTavilyUsage(credits = 1): Promise<number> {
  const { snapshots, usage } = await loadVerificationStore(true);
  const nextUsage: MonthlyTavilyUsage = {
    month: currentYearMonth(),
    tavilyCreditsUsed: usage.tavilyCreditsUsed + Math.max(0, Math.floor(credits)),
  };
  await persistVerificationStore(snapshots, nextUsage);
  return nextUsage.tavilyCreditsUsed;
}

export async function saveCourseVerificationSnapshot(
  snapshot: VerifiedCourseSnapshot
): Promise<boolean> {
  const clean = sanitizeSnapshot(snapshot);
  if (!isUsableVerifiedSnapshot(clean)) {
    return false;
  }
  const { snapshots, usage } = await loadVerificationStore(true);
  const nextSnapshots = { ...snapshots, [clean!.courseKey]: clean! };
  return persistVerificationStore(nextSnapshots, usage);
}
