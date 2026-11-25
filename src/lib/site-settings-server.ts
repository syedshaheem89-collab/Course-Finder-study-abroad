import { createServerSupabaseClient } from '@/lib/supabase';
import {
  PriorityUniversityRule,
  sanitizePriorityRules,
} from '@/lib/university-classification';

export const SETTINGS_EMAIL = '__site_settings__';
export const DEFAULT_BRAND_NAME = 'Orbis';

export interface SiteSettingsData {
  brandName: string;
  priorityUniversities: PriorityUniversityRule[];
}

interface CachedSiteSettings {
  data: SiteSettingsData;
  expiresAt: number;
}

const globalForSiteSettings = globalThis as unknown as {
  __gcSiteSettingsCache?: CachedSiteSettings;
};

export function invalidateSiteSettingsCache(): void {
  globalForSiteSettings.__gcSiteSettingsCache = undefined;
}

export async function getSiteSettingsServer(forceFresh = false): Promise<SiteSettingsData> {
  const now = Date.now();
  const cached = globalForSiteSettings.__gcSiteSettingsCache;
  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('background_profile')
      .eq('email', SETTINGS_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;
    const bp =
      !error && row?.background_profile && typeof row.background_profile === 'object'
        ? (row.background_profile as Record<string, any>)
        : {};

    const savedBrand =
      typeof bp.brand_name === 'string' && bp.brand_name.trim()
        ? bp.brand_name.trim().slice(0, 60)
        : DEFAULT_BRAND_NAME;

    const priorityUniversities = sanitizePriorityRules(bp.priority_universities);

    const result: SiteSettingsData = {
      brandName: savedBrand,
      priorityUniversities,
    };

    globalForSiteSettings.__gcSiteSettingsCache = {
      data: result,
      expiresAt: now + 15_000,
    };

    return result;
  } catch {
    return {
      brandName: DEFAULT_BRAND_NAME,
      priorityUniversities: [],
    };
  }
}
