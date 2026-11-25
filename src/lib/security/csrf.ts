import type { NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Verifies same-origin for mutating requests using Fetch Metadata + Origin/Referer host matching.
 */
export function verifySameOrigin(req: NextRequest): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return true;
  }

  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const rawHost =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    '';
  const expectedHost = rawHost.split(',')[0]?.trim().toLowerCase();

  const originHeader = req.headers.get('origin');
  if (originHeader) {
    if (originHeader === 'null') return false;
    try {
      const originUrl = new URL(originHeader);
      if (!expectedHost || originUrl.host.toLowerCase() !== expectedHost) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  const refererHeader = req.headers.get('referer');
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      if (!expectedHost || refererUrl.host.toLowerCase() !== expectedHost) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // Reject cross-site if Sec-Fetch-Mode indicates browser CORS/navigate without origin match
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false;
  }

  return true;
}
