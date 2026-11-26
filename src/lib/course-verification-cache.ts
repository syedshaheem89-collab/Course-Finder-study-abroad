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

export const COURSE_VERIFY_CACHE_EMAIL = '__course_verify_cache__';

interface CachedVerifyStore {
  snapshots: Record<string, VerifiedCourseSnapshot>;
  expiresAt: number;
}

const globalForVerify = globalThis as unknown as {
  __orbisVerifyCache?: CachedVerifyStore;
};

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

  return {
    courseKey,
    ...(raw.courseId ? { courseId: String(raw.courseId).slice(0, 120) } : {}),
    ...(officialUrl ? { officialUrl } : {}),
    ...(raw.verifiedDomain ? { verifiedDomain: String(raw.verifiedDomain).slice(0, 100) } : {}),
    tuitionFeesEur:
      raw.tuitionFeesEur !== undefined && raw.tuitionFeesEur !== null && Number.isFinite(Number(raw.tuitionFeesEur))
        ? Math.max(0, Math.round(Number(raw.tuitionFeesEur)))
        : null,
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

export async function getCourseVerificationCache(
  forceFresh = false
): Promise<Record<string, VerifiedCourseSnapshot>> {
  const now = Date.now();
  const cached = globalForVerify.__orbisVerifyCache;
  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.snapshots;
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
    const rawMap =
      !error && row?.background_profile && typeof row.background_profile === 'object'
        ? (row.background_profile as any).snapshots
        : null;

    const clean: Record<string, VerifiedCourseSnapshot> = {};
    if (rawMap && typeof rawMap === 'object') {
      for (const [k, v] of Object.entries(rawMap)) {
        const snap = sanitizeSnapshot(v);
        if (snap) clean[k] = snap;
      }
    }

    globalForVerify.__orbisVerifyCache = {
      snapshots: clean,
      expiresAt: now + 300_000,
    };

    return clean;
  } catch {
    return {};
  }
}

export async function getCachedCourseVerification(
  country?: string | null,
  universityName?: string | null,
  programName?: string | null,
  maxAgeDays = 60
): Promise<VerifiedCourseSnapshot | null> {
  const key = makeCourseVerifyKey(country, universityName, programName);
  const map = await getCourseVerificationCache(false);
  const hit = map[key];
  if (!hit) return null;
  const ageMs = Date.now() - new Date(hit.verifiedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > maxAgeDays * 86_400_000) {
    return null;
  }
  return hit;
}

export async function saveCourseVerificationSnapshot(
  snapshot: VerifiedCourseSnapshot
): Promise<boolean> {
  const clean = sanitizeSnapshot(snapshot);
  if (!clean) return false;

  try {
    const current = { ...(await getCourseVerificationCache(true)) };
    current[clean.courseKey] = clean;

    // Keep most recent 400 snapshots to stay well below JSON column size limits
    const entries = Object.entries(current)
      .sort((a, b) => new Date(b[1].verifiedAt).getTime() - new Date(a[1].verifiedAt).getTime())
      .slice(0, 400);
    const trimmedMap = Object.fromEntries(entries);

    const supabase = createServerSupabaseClient();
    await supabase.from('inquiries').delete().eq('email', COURSE_VERIFY_CACHE_EMAIL);

    const { error } = await supabase.from('inquiries').insert({
      student_name: '__COURSE_VERIFY_CACHE__',
      email: COURSE_VERIFY_CACHE_EMAIL,
      phone: 'SYSTEM',
      background_profile: {
        snapshots: trimmedMap,
        updated_at: new Date().toISOString(),
      },
      ai_suggested_courses: {},
    });

    if (error) return false;

    globalForVerify.__orbisVerifyCache = {
      snapshots: trimmedMap,
      expiresAt: Date.now() + 300_000,
    };
    return true;
  } catch {
    return false;
  }
}
