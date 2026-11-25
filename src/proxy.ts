import { NextRequest, NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  clearSessionCookie,
  setSessionCookie,
  verifySessionCookie,
} from '@/lib/security/session';

const isDev = process.env.NODE_ENV !== 'production';

const ADMIN_ONLY_API_PREFIXES = [
  '/api/courses/manage',
  '/api/ingest-excel',
  '/api/parse-pdf',
  '/api/sync-web',
  '/api/sync-uk-university',
  '/api/ai-enrich',
  '/api/auth/users',
  '/api/auth/audit',
  '/api/auth/change-password',
  '/api/auth/backup-codes',
];

const SENSITIVE_NO_STORE_PREFIXES = [
  '/admin',
  '/api/auth',
  '/api/inquiries',
  '/api/courses/manage',
  '/api/ingest-excel',
  '/api/parse-pdf',
  '/api/sync-web',
  '/api/sync-uk-university',
  '/api/ai-enrich',
];

function buildCspHeader(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

function applySecurityHeaders(res: NextResponse, pathname: string): NextResponse {
  const isSensitivePath = pathname.startsWith('/admin') || pathname.startsWith('/api/');
  const isNoStore = SENSITIVE_NO_STORE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  res.headers.set('Content-Security-Policy', buildCspHeader());
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set(
    'Referrer-Policy',
    isSensitivePath ? 'no-referrer' : 'strict-origin-when-cross-origin'
  );

  if (!isDev) {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  if (isSensitivePath) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  if (isNoStore) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = (request.method || 'GET').toUpperCase();
  const isApi = pathname.startsWith('/api/');

  // 1. CSRF Protection & Rate Limiting on API routes
  if (isApi) {
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (!verifySameOrigin(request)) {
        return applySecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Cross-site request blocked (CSRF protection).' },
            { status: 403 }
          ),
          pathname
        );
      }
    }

    const ip = getClientIp(request);
    let rlResult: { allowed: boolean; retryAfterSeconds: number };

    if (
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/mfa' ||
      pathname === '/api/auth/setup'
    ) {
      rlResult = checkRateLimit(`proxy:auth:${ip}`, 12, 5 * 60_000);
    } else if (pathname === '/api/inquiries' && method === 'POST') {
      rlResult = checkRateLimit(`proxy:inq:${ip}`, 12, 15 * 60_000);
    } else if (
      pathname === '/api/ai-discover-courses' ||
      pathname === '/api/ai-course-check' ||
      pathname === '/api/ai-recommend'
    ) {
      rlResult = checkRateLimit(`proxy:ai:${ip}`, 18, 10 * 60_000);
    } else {
      rlResult = checkRateLimit(`proxy:api:${ip}`, 120, 60_000);
    }

    if (!rlResult.allowed) {
      const rlRes = NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        { status: 429 }
      );
      rlRes.headers.set('Retry-After', String(rlResult.retryAfterSeconds));
      return applySecurityHeaders(rlRes, pathname);
    }
  }

  // 2. Admin UI Wall
  const isProtectedAdminPage =
    pathname === '/admin' ||
    (pathname.startsWith('/admin/') &&
      pathname !== '/admin/login' &&
      pathname !== '/admin/setup');

  if (isProtectedAdminPage) {
    const payload = verifySessionCookie(request);
    if (!payload) {
      const loginUrl = new URL('/admin/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookie(res);
      return applySecurityHeaders(res, pathname);
    }

    const res = NextResponse.next();
    if (Date.now() - payload.lastActivity > 2 * 60_000) {
      setSessionCookie(res, {
        ...payload,
        lastActivity: Date.now(),
      });
    }
    return applySecurityHeaders(res, pathname);
  }

  // 3. Admin API Wall
  const isProtectedAdminApi =
    ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    (pathname === '/api/rules' && method !== 'GET') ||
    (pathname === '/api/inquiries' && method !== 'POST');

  if (isProtectedAdminApi) {
    const payload = verifySessionCookie(request);
    if (!payload) {
      const res = NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
      clearSessionCookie(res);
      return applySecurityHeaders(res, pathname);
    }

    const res = NextResponse.next();
    if (Date.now() - payload.lastActivity > 2 * 60_000) {
      setSessionCookie(res, {
        ...payload,
        lastActivity: Date.now(),
      });
    }
    return applySecurityHeaders(res, pathname);
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
