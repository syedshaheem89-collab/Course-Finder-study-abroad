import { NextRequest, NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isValidEmail } from '@/lib/security/validation';
import {
  findPortalUserByEmail,
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  verifySupabasePassword,
} from '@/lib/security/admin-users';
import {
  createCounselorSessionPayload,
  PortalRole,
  setCounselorSessionCookie,
} from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };
const GENERIC_AUTH_ERROR = 'Invalid credentials or account temporarily locked.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: 'Cross-site request blocked.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const rl = checkRateLimit(`counselor-login:${ip}`, 12, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many login attempts. Please wait a few minutes.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!isValidEmail(email) || !password || password.length > 128) {
      await sleep(220);
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const user = await findPortalUserByEmail(email);
    const meta = (user?.app_metadata || {}) as Record<string, any>;
    const role = meta.role as PortalRole | undefined;

    if (
      !user ||
      (role !== 'counselor' && role !== 'admin' && role !== 'super_admin') ||
      meta.status !== 'active'
    ) {
      await sleep(220);
      await logSecurityEvent({
        event: 'COUNSELOR_LOGIN_FAILED',
        severity: 'WARN',
        actorEmail: email,
        actorId: user?.id ?? null,
        ip,
        userAgent: ua,
        path: '/api/auth/counselor-login',
        details: { reason: user ? 'inactive_or_invalid_role' : 'unknown_account' },
      });
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const lockState = isAccountLocked(meta);
    if (lockState.locked) {
      await sleep(220);
      await logSecurityEvent({
        event: 'COUNSELOR_LOGIN_LOCKED',
        severity: 'CRITICAL',
        actorEmail: email,
        actorId: user.id,
        ip,
        userAgent: ua,
        path: '/api/auth/counselor-login',
        details: { lockedUntil: lockState.until },
      });
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const passwordOk = await verifySupabasePassword(email, password);
    if (!passwordOk) {
      const failInfo = await recordFailedAttempt(user, ip);
      await sleep(220);
      await logSecurityEvent({
        event: failInfo.lockedNow ? 'ACCOUNT_LOCKED' : 'COUNSELOR_LOGIN_FAILED',
        severity: failInfo.lockedNow ? 'CRITICAL' : 'WARN',
        actorEmail: email,
        actorId: user.id,
        ip,
        userAgent: ua,
        path: '/api/auth/counselor-login',
        details: {
          failedCount: failInfo.failedCount,
          lockedUntil: failInfo.lockedUntil,
        },
      });
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const name = String(meta.name || 'Counselor');
    const ver = Number(meta.session_version || 1);

    await recordSuccessfulLogin(user, ip);
    await logSecurityEvent({
      event: 'COUNSELOR_LOGIN_SUCCESS',
      severity: 'INFO',
      actorEmail: email,
      actorId: user.id,
      ip,
      userAgent: ua,
      path: '/api/auth/counselor-login',
      details: { role },
    });

    const payload = createCounselorSessionPayload({
      uid: user.id,
      email,
      name,
      role,
      ver,
      req,
    });

    const res = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email,
          name,
          role,
        },
        redirectTo: '/courses',
      },
      { headers: NO_STORE_HEADERS }
    );
    setCounselorSessionCookie(res, payload);
    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: GENERIC_AUTH_ERROR },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
}
