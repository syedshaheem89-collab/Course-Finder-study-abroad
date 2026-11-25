import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { decryptJson, encryptJson, safeEqual, sha256Hex } from './crypto';
import { verifySameOrigin } from './csrf';

export type AdminRole = 'super_admin' | 'admin';

export interface AdminSessionPayload {
  sid: string;
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  ver: number;
  iat: number;
  exp: number;
  lastActivity: number;
  uaHash: string;
}

export interface MfaChallengePayload {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  mode: 'verify' | 'enroll';
  exp: number;
  uaHash: string;
}

export const ADMIN_SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-gc_admin_session' : 'gc_admin_session';

export const MFA_CHALLENGE_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-gc_mfa_challenge' : 'gc_mfa_challenge';

export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000; // 8 hours
export const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes
export const MFA_CHALLENGE_MS = 5 * 60 * 1000; // 5 minutes

interface CachedUserStatus {
  active: boolean;
  role: string;
  totpEnabled: boolean;
  sessionVersion: number;
  checkedAt: number;
}

const USER_CACHE_TTL_MS = 10_000;
const globalForUserCache = globalThis as unknown as {
  __gcAdminUserFreshnessCache?: Map<string, CachedUserStatus>;
};

const userCache =
  globalForUserCache.__gcAdminUserFreshnessCache ||
  (globalForUserCache.__gcAdminUserFreshnessCache = new Map<string, CachedUserStatus>());

export function invalidateUserCache(uid: string): void {
  userCache.delete(uid);
}

export function getUaHash(req: NextRequest): string {
  const ua = (req.headers.get('user-agent') || 'unknown').slice(0, 200);
  return sha256Hex(ua).slice(0, 24);
}

export function createSessionPayload(params: {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  ver: number;
  req: NextRequest;
}): AdminSessionPayload {
  const now = Date.now();
  return {
    sid: crypto.randomUUID(),
    uid: params.uid,
    email: params.email,
    name: params.name,
    role: params.role,
    ver: params.ver,
    iat: now,
    exp: now + SESSION_ABSOLUTE_MS,
    lastActivity: now,
    uaHash: getUaHash(params.req),
  };
}

export function verifySessionCookie(req: NextRequest): AdminSessionPayload | null {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decryptJson<AdminSessionPayload>(token, 'session');
  if (!payload || !payload.uid || !payload.email) return null;

  const now = Date.now();
  if (typeof payload.exp !== 'number' || now >= payload.exp) return null;
  if (typeof payload.lastActivity !== 'number' || now - payload.lastActivity >= SESSION_IDLE_MS) {
    return null;
  }

  const reqUaHash = getUaHash(req);
  if (!payload.uaHash || !safeEqual(payload.uaHash, reqUaHash)) {
    return null;
  }

  if (payload.role !== 'super_admin' && payload.role !== 'admin') {
    return null;
  }

  return payload;
}

export function setSessionCookie(res: NextResponse, payload: AdminSessionPayload): void {
  const token = encryptJson(payload, 'session');
  const maxAgeSeconds = Math.max(60, Math.floor((payload.exp - Date.now()) / 1000));
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export function verifyMfaChallengeCookie(req: NextRequest): MfaChallengePayload | null {
  const token = req.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  const payload = decryptJson<MfaChallengePayload>(token, 'mfa-challenge');
  if (!payload || !payload.uid) return null;

  if (typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null;
  if (!payload.uaHash || !safeEqual(payload.uaHash, getUaHash(req))) return null;

  return payload;
}

export function setMfaChallengeCookie(
  res: NextResponse,
  payload: Omit<MfaChallengePayload, 'exp' | 'uaHash'>,
  req: NextRequest
): void {
  const fullPayload: MfaChallengePayload = {
    ...payload,
    exp: Date.now() + MFA_CHALLENGE_MS,
    uaHash: getUaHash(req),
  };
  const token = encryptJson(fullPayload, 'mfa-challenge');
  res.cookies.set({
    name: MFA_CHALLENGE_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(MFA_CHALLENGE_MS / 1000),
  });
}

export function clearMfaChallengeCookie(res: NextResponse): void {
  res.cookies.set({
    name: MFA_CHALLENGE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Verifies live account status, role, 2FA enrollment, and session_version against Supabase Auth.
 */
export async function verifySessionFreshness(payload: AdminSessionPayload): Promise<boolean> {
  const now = Date.now();
  const cached = userCache.get(payload.uid);
  if (cached && now - cached.checkedAt < USER_CACHE_TTL_MS) {
    return (
      cached.active &&
      (cached.role === 'super_admin' || cached.role === 'admin') &&
      cached.totpEnabled &&
      cached.sessionVersion === payload.ver
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.admin.getUserById(payload.uid);
    if (error || !data?.user) {
      userCache.delete(payload.uid);
      return false;
    }

    const meta = (data.user.app_metadata || {}) as Record<string, any>;
    const statusObj: CachedUserStatus = {
      active: meta.status === 'active',
      role: String(meta.role || ''),
      totpEnabled: meta.totp_enabled === true,
      sessionVersion: Number(meta.session_version || 1),
      checkedAt: now,
    };

    userCache.set(payload.uid, statusObj);

    return (
      statusObj.active &&
      (statusObj.role === 'super_admin' || statusObj.role === 'admin') &&
      statusObj.totpEnabled &&
      statusObj.sessionVersion === payload.ver
    );
  } catch {
    return false;
  }
}

export async function requireAdminSession(
  req: NextRequest,
  opts?: { requireSuperAdmin?: boolean }
): Promise<{ ok: true; session: AdminSessionPayload } | { ok: false; response: NextResponse }> {
  if (!verifySameOrigin(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Cross-site request blocked (CSRF protection).' },
        { status: 403, headers: { 'Cache-Control': 'no-store, private' } }
      ),
    };
  }

  const session = verifySessionCookie(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: { 'Cache-Control': 'no-store, private' } }
      ),
    };
  }

  const fresh = await verifySessionFreshness(session);
  if (!fresh) {
    const res = NextResponse.json(
      { success: false, error: 'Session expired, revoked, or account disabled.' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } }
    );
    clearSessionCookie(res);
    return { ok: false, response: res };
  }

  if (opts?.requireSuperAdmin && session.role !== 'super_admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Super Admin privileges required.' },
        { status: 403, headers: { 'Cache-Control': 'no-store, private' } }
      ),
    };
  }

  return { ok: true, session };
}
