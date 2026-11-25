import { normalizeCountryName } from './countries';
import {
  CountryVisaIntel,
  resolveOfficialStayBackYears,
} from './country-visa-intel';

export interface LiveCountryPolicyOverride {
  country: string;
  stayBackYears?: number;
  bachelorStayBackYears?: number;
  phdStayBackYears?: number;
  visaSummary?: string;
  showMoneyEur?: number;
  showMoneyNote?: string;
  lastVerifiedAt: string;
  sourceUrl?: string;
  sourceTitle?: string;
  autoUpdated?: boolean;
}

export interface LivePolicyUpdateItem {
  country: string;
  title: string;
  summary: string;
  tag: 'Visa & Stay-Back' | 'Tuition & Fees' | 'Eligibility' | 'Scholarships';
  publishedAt: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface LivePolicyStoreData {
  countryOverrides: Record<string, LiveCountryPolicyOverride>;
  policyUpdates: LivePolicyUpdateItem[];
  lastAutoSyncAt: string | null;
  lastFeeSyncAt: string | null;
  lastSyncSummary?: string;
  lastBatchOffset?: number;
}

export const EMPTY_LIVE_POLICY_STORE: LivePolicyStoreData = {
  countryOverrides: {},
  policyUpdates: [],
  lastAutoSyncAt: null,
  lastFeeSyncAt: null,
  lastSyncSummary: '',
  lastBatchOffset: 0,
};

export function findLiveCountryOverride(
  overrides: Record<string, LiveCountryPolicyOverride> | undefined,
  country?: string
): LiveCountryPolicyOverride | undefined {
  if (!overrides || !country) return undefined;
  const normalized = normalizeCountryName(country) || country.trim();
  const lower = normalized.toLowerCase();
  if (overrides[normalized]) return overrides[normalized];
  const matchedKey = Object.keys(overrides).find((k) => k.trim().toLowerCase() === lower);
  return matchedKey ? overrides[matchedKey] : undefined;
}

function isValidStayBackNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 5;
}

export function resolveStayBackWithOverride(
  country?: string,
  degreeLevel?: string,
  programName?: string,
  fallbackYears?: number,
  category?: string,
  overrides?: Record<string, LiveCountryPolicyOverride>
): number {
  const override = findLiveCountryOverride(overrides, country);
  if (override) {
    const levelLower = `${degreeLevel || ''} ${programName || ''}`.toLowerCase();
    const isPhd =
      levelLower.includes('phd') ||
      levelLower.includes('doctorate') ||
      levelLower.includes('doctoral') ||
      levelLower.includes('research master') ||
      levelLower.includes('mres');
    const isBachelor =
      !isPhd &&
      (levelLower.includes('bachelor') ||
        levelLower.includes('undergraduate') ||
        /\b(bsc|ba|beng|bba|ll\.?b|mbbs|ug\b)/.test(levelLower));

    if (isPhd && isValidStayBackNumber(override.phdStayBackYears)) {
      return Number(override.phdStayBackYears);
    }
    if (isBachelor && isValidStayBackNumber(override.bachelorStayBackYears)) {
      return Number(override.bachelorStayBackYears);
    }
    if (isValidStayBackNumber(override.stayBackYears)) {
      return Number(override.stayBackYears);
    }
  }

  return resolveOfficialStayBackYears(country, degreeLevel, programName, fallbackYears, category);
}

export function mergeCountryVisaIntel(
  baseIntel: CountryVisaIntel,
  override?: LiveCountryPolicyOverride,
  degreeLevel?: string
): CountryVisaIntel {
  if (!override) return baseIntel;
  const lower = (degreeLevel || '').toLowerCase();
  const isPhd = lower.includes('phd') || lower.includes('doctor');
  const isUg = lower.includes('bachelor') || lower.includes('ug') || lower.includes('certificate');

  const nextStayBack = isPhd
    ? isValidStayBackNumber(override.phdStayBackYears)
      ? override.phdStayBackYears
      : isValidStayBackNumber(override.stayBackYears)
      ? override.stayBackYears
      : baseIntel.stayBackYears
    : isUg
    ? isValidStayBackNumber(override.bachelorStayBackYears)
      ? override.bachelorStayBackYears
      : isValidStayBackNumber(override.stayBackYears)
      ? override.stayBackYears
      : baseIntel.stayBackYears
    : isValidStayBackNumber(override.stayBackYears)
    ? override.stayBackYears
    : baseIntel.stayBackYears;

  return {
    ...baseIntel,
    stayBackYears: nextStayBack,
    bachelorStayBackYears: isValidStayBackNumber(override.bachelorStayBackYears)
      ? override.bachelorStayBackYears
      : baseIntel.bachelorStayBackYears,
    phdStayBackYears: isValidStayBackNumber(override.phdStayBackYears)
      ? override.phdStayBackYears
      : baseIntel.phdStayBackYears,
    visaSummary: override.visaSummary?.trim() ? override.visaSummary.trim() : baseIntel.visaSummary,
  };
}

export function mergeLivingCostGuide(
  baseLiving: { amountEur: number; note: string },
  override?: LiveCountryPolicyOverride
): { amountEur: number; note: string } {
  if (!override) return baseLiving;
  const validEur =
    typeof override.showMoneyEur === 'number' &&
    Number.isFinite(override.showMoneyEur) &&
    override.showMoneyEur >= 2000 &&
    override.showMoneyEur <= 50000
      ? Math.round(override.showMoneyEur)
      : baseLiving.amountEur;
  const validNote = override.showMoneyNote?.trim() ? override.showMoneyNote.trim() : baseLiving.note;
  return { amountEur: validEur, note: validNote };
}
