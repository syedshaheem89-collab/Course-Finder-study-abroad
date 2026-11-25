import { cacheLife } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizeCountryName } from '@/lib/countries';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import {
  EMPTY_LIVE_POLICY_STORE,
  LiveCountryPolicyOverride,
  LivePolicyStoreData,
  LivePolicyUpdateItem,
} from './live-policy-types';

export const LIVE_POLICY_EMAIL = '__live_policy_overrides__';

interface CachedLivePolicy {
  data: LivePolicyStoreData;
  expiresAt: number;
}

const globalForLivePolicy = globalThis as unknown as {
  __orbisLivePolicyCache?: CachedLivePolicy;
};

export function invalidateLivePolicyCache(): void {
  globalForLivePolicy.__orbisLivePolicyCache = undefined;
}

function sanitizeNumberInRange(val: unknown, min: number, max: number): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return Number(n.toFixed(2));
}

export function sanitizeCountryOverride(raw: any): LiveCountryPolicyOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const country = normalizeCountryName(String(raw.country || '')) || String(raw.country || '').trim();
  if (!country) return null;

  const stayBackYears = sanitizeNumberInRange(raw.stayBackYears, 0, 5);
  const bachelorStayBackYears = sanitizeNumberInRange(raw.bachelorStayBackYears, 0, 5);
  const phdStayBackYears = sanitizeNumberInRange(raw.phdStayBackYears, 0, 5);
  const showMoneyEur = sanitizeNumberInRange(raw.showMoneyEur, 2000, 50000);
  const visaSummary = typeof raw.visaSummary === 'string' ? raw.visaSummary.trim().slice(0, 320) : undefined;
  const showMoneyNote = typeof raw.showMoneyNote === 'string' ? raw.showMoneyNote.trim().slice(0, 180) : undefined;
  const sourceUrl = raw.sourceUrl ? sanitizeHttpUrl(String(raw.sourceUrl)) || undefined : undefined;
  const sourceTitle = typeof raw.sourceTitle === 'string' ? raw.sourceTitle.trim().slice(0, 140) : undefined;
  const lastVerifiedAt =
    typeof raw.lastVerifiedAt === 'string' && raw.lastVerifiedAt.trim()
      ? raw.lastVerifiedAt.trim()
      : '';

  return {
    country,
    ...(stayBackYears !== undefined ? { stayBackYears } : {}),
    ...(bachelorStayBackYears !== undefined ? { bachelorStayBackYears } : {}),
    ...(phdStayBackYears !== undefined ? { phdStayBackYears } : {}),
    ...(visaSummary ? { visaSummary } : {}),
    ...(showMoneyEur !== undefined ? { showMoneyEur: Math.round(showMoneyEur) } : {}),
    ...(showMoneyNote ? { showMoneyNote } : {}),
    lastVerifiedAt,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    autoUpdated: Boolean(raw.autoUpdated),
  };
}

function sanitizePolicyUpdate(raw: any): LivePolicyUpdateItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const country = normalizeCountryName(String(raw.country || '')) || String(raw.country || '').trim();
  const title = String(raw.title || '').trim().slice(0, 140);
  const summary = String(raw.summary || '').trim().slice(0, 320);
  if (!country || !title || !summary) return null;
  const allowedTags = new Set(['Visa & Stay-Back', 'Tuition & Fees', 'Eligibility', 'Scholarships']);
  const tag = allowedTags.has(raw.tag) ? raw.tag : 'Visa & Stay-Back';
  const sourceUrl = raw.sourceUrl ? sanitizeHttpUrl(String(raw.sourceUrl)) || undefined : undefined;
  const sourceName = typeof raw.sourceName === 'string' ? raw.sourceName.trim().slice(0, 80) : undefined;
  const publishedAt =
    typeof raw.publishedAt === 'string' && raw.publishedAt.trim()
      ? raw.publishedAt.trim()
      : new Date().toISOString();

  return {
    country,
    title,
    summary,
    tag,
    publishedAt,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceName ? { sourceName } : {}),
  };
}

function sanitizeLivePolicyStore(raw: any): LivePolicyStoreData {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LIVE_POLICY_STORE };

  const countryOverrides: Record<string, LiveCountryPolicyOverride> = {};
  if (raw.countryOverrides && typeof raw.countryOverrides === 'object') {
    for (const val of Object.values(raw.countryOverrides)) {
      const clean = sanitizeCountryOverride(val);
      if (clean) countryOverrides[clean.country] = clean;
    }
  }

  const policyUpdates: LivePolicyUpdateItem[] = [];
  const seenKeys = new Set<string>();
  if (Array.isArray(raw.policyUpdates)) {
    for (const item of raw.policyUpdates) {
      const clean = sanitizePolicyUpdate(item);
      if (!clean) continue;
      const key = `${clean.country.toLowerCase()}::${clean.title.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      policyUpdates.push(clean);
      if (policyUpdates.length >= 30) break;
    }
  }

  return {
    countryOverrides,
    policyUpdates,
    lastAutoSyncAt: typeof raw.lastAutoSyncAt === 'string' ? raw.lastAutoSyncAt : null,
    lastFeeSyncAt: typeof raw.lastFeeSyncAt === 'string' ? raw.lastFeeSyncAt : null,
    lastSyncSummary: typeof raw.lastSyncSummary === 'string' ? raw.lastSyncSummary.slice(0, 280) : '',
    lastBatchOffset:
      typeof raw.lastBatchOffset === 'number' && Number.isFinite(raw.lastBatchOffset) && raw.lastBatchOffset >= 0
        ? Math.floor(raw.lastBatchOffset)
        : 0,
  };
}

export async function getLivePolicyStoreCached(): Promise<LivePolicyStoreData> {
  'use cache';
  cacheLife('hours');
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('background_profile')
      .eq('email', LIVE_POLICY_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;
    const bp = !error && row?.background_profile ? row.background_profile : null;
    return sanitizeLivePolicyStore(bp);
  } catch {
    return { ...EMPTY_LIVE_POLICY_STORE };
  }
}

export async function getLivePolicyStore(forceFresh = false): Promise<LivePolicyStoreData> {
  const now = Date.now();
  const cached = globalForLivePolicy.__orbisLivePolicyCache;
  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('background_profile')
      .eq('email', LIVE_POLICY_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;
    const bp = !error && row?.background_profile ? row.background_profile : null;
    const clean = sanitizeLivePolicyStore(bp);

    globalForLivePolicy.__orbisLivePolicyCache = {
      data: clean,
      expiresAt: now + 300_000, // 5 min server memory cache
    };

    return clean;
  } catch {
    return { ...EMPTY_LIVE_POLICY_STORE };
  }
}

export async function saveLivePolicyStore(
  data: LivePolicyStoreData,
  updatedBy = 'system'
): Promise<boolean> {
  try {
    const clean = sanitizeLivePolicyStore(data);
    const supabase = createServerSupabaseClient();

    await supabase.from('inquiries').delete().eq('email', LIVE_POLICY_EMAIL);

    const { error } = await supabase.from('inquiries').insert({
      student_name: '__LIVE_POLICY__',
      email: LIVE_POLICY_EMAIL,
      phone: 'SYSTEM',
      background_profile: {
        ...clean,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      ai_suggested_courses: {},
    });

    if (error) {
      return false;
    }

    globalForLivePolicy.__orbisLivePolicyCache = {
      data: clean,
      expiresAt: Date.now() + 300_000,
    };
    return true;
  } catch {
    return false;
  }
}
