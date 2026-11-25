import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServerSupabaseClient } from '@/lib/supabase';
import { encryptJson, generateRecoveryCodes } from '@/lib/security/crypto';
import { buildOtpAuthUri, generateTotpSecret } from '@/lib/security/totp';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { isValidEmail } from '@/lib/security/validation';
import {
  findAdminUserByEmail,
  isAccountLocked,
  recordFailedAttempt,
  verifySupabasePassword,
} from '@/lib/security/admin-users';
import { AdminRole, setMfaChallengeCookie } from '@/lib/security/session';
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

  const rl = checkRateLimit(`login:${ip}`, 10, 5 * 60_000);
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

    const user = await findAdminUserByEmail(email);
    const meta = (user?.app_metadata || {}) as Record<string, any>;
    const role = meta.role as AdminRole | undefined;

    if (!user || (role !== 'super_admin' && role !== 'admin') || meta.status !== 'active') {
      await sleep(220);
      await logSecurityEvent({
        event: 'LOGIN_FAILED',
        severity: 'WARN',
        actorEmail: email,
        actorId: user?.id ?? null,
        ip,
        userAgent: ua,
        path: '/api/auth/login',
        details: { reason: user ? 'inactive_or_non_admin' : 'unknown_account' },
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
        event: 'LOGIN_BLOCKED_LOCKED',
        severity: 'CRITICAL',
        actorEmail: email,
        actorId: user.id,
        ip,
        userAgent: ua,
        path: '/api/auth/login',
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
        event: failInfo.lockedNow ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        severity: failInfo.lockedNow ? 'CRITICAL' : 'WARN',
        actorEmail: email,
        actorId: user.id,
        ip,
        userAgent: ua,
        path: '/api/auth/login',
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

    const name = String(meta.name || 'Admin');

    if (meta.totp_enabled === true && meta.totp_secret_enc) {
      const res = NextResponse.json(
        {
          success: true,
          mfaRequired: true,
          mode: 'verify',
          email,
        },
        { headers: NO_STORE_HEADERS }
      );
      setMfaChallengeCookie(
        res,
        {
          uid: user.id,
          email,
          name,
          role,
          mode: 'verify',
        },
        req
      );
      return res;
    }

    // First login or MFA reset: enroll mandatory Google Authenticator 2FA now
    const totpSecret = generateTotpSecret();
    const totpSecretEnc = encryptJson({ secret: totpSecret }, 'totp');
    const { plain: backupCodes, hashes: backupHashes } = generateRecoveryCodes(8);
    const otpAuthUri = buildOtpAuthUri(email, totpSecret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUri, { width: 240, margin: 2 });

    const supabase = createServerSupabaseClient();
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...meta,
        totp_enabled: false,
        totp_secret_enc: totpSecretEnc,
        backup_codes: backupHashes,
        last_totp_step: 0,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        mfaRequired: true,
        mode: 'enroll',
        email,
        qrDataUrl,
        manualSecret: totpSecret,
        backupCodes,
      },
      { headers: NO_STORE_HEADERS }
    );

    setMfaChallengeCookie(
      res,
      {
        uid: user.id,
        email,
        name,
        role,
        mode: 'enroll',
      },
      req
    );

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Login failed.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
