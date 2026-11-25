import { createServerSupabaseClient } from '@/lib/supabase';

export interface CachedUniversityRow {
  id: string;
  name: string;
  country: string;
}

interface UniversitiesCacheEntry {
  data: CachedUniversityRow[];
  expiresAt: number;
}

const globalForUnisCache = globalThis as unknown as {
  __gcUniversitiesCache?: UniversitiesCacheEntry;
};

export function invalidateUniversitiesCache(): void {
  globalForUnisCache.__gcUniversitiesCache = undefined;
}

export async function getCachedUniversities(
  forceFresh = false
): Promise<CachedUniversityRow[]> {
  const now = Date.now();
  const cached = globalForUnisCache.__gcUniversitiesCache;
  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await (supabase.from('universities') as any)
    .select('id, name, country')
    .order('name')
    .limit(5000);

  if (error || !Array.isArray(data)) {
    return cached?.data || [];
  }

  const rows: CachedUniversityRow[] = data.filter(
    (u: any): u is CachedUniversityRow => Boolean(u && u.id)
  );

  globalForUnisCache.__gcUniversitiesCache = {
    data: rows,
    expiresAt: now + 30_000,
  };

  return rows;
}
