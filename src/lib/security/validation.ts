// Matches any valid PostgreSQL 128-bit UUID (RFC 4122 v1-v8 and seeded 8-4-4-4-12 hex UUIDs)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidUuid(val: string): boolean {
  return typeof val === 'string' && UUID_RE.test(val.trim());
}

export function isValidEmail(val: string): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length <= 254 && EMAIL_RE.test(trimmed);
}

/**
 * Strips PostgREST filter syntax characters and caps search length.
 */
export function sanitizeSearchQuery(q: string): string {
  return String(q || '')
    .slice(0, 120)
    .replace(/[^a-zA-Z0-9\s\-&+']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ensures an external URL uses strictly http: or https: (blocks javascript:, data:, file:, etc.).
 */
export function sanitizeHttpUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
