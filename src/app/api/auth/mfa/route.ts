import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { decryptJson, hashRecoveryCode, safeEqual } from '@/lib/security/crypto';
import { verifyTotpCode } from '@/lib/security/totp';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import {
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from '@/lib/security/admin-users';
import {
  AdminRole,
  clearMfaChallengeCookie,
  createSessionPayload,
  setSessionCookie,
  verifyMfaChallengeCookie,
} from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: 'Cross-site request blocked.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const rl = checkRateLimit(`mfa:${ip}`, 10, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many verification attempts. Please wait a few minutes.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const challenge = verifyMfaChallengeCookie(req);
    if (!challenge) {
      return NextResponse.json(
        { success: false, error: '2FA verification session expired. Please sign in again.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';

    if (!code && !recoveryCode) {
      return NextResponse.json(
        { success: false, error: 'Please enter a 6-digit authenticator code or a recovery code.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(challenge.uid);
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: 'Account unavailable.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const user = userData.user;
    const meta = (user.app_metadata || {}) as Record<string, any>;
    const role = meta.role as AdminRole;

    if (meta.status !== 'active' || (role !== 'super_admin' && role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Account is disabled or unauthorized.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const lockState = isAccountLocked(meta);
    if (lockState.locked) {
      return NextResponse.json(
        { success: false, error: 'Account temporarily locked due to failed attempts.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    let verified = false;
    let verifiedStep: number | undefined;
    let updatedBackupCodes: any[] | undefined;

    if (code) {
      const secretPayload = decryptJson<{ secret: string }>(meta.totp_secret_enc, 'totp');
      if (secretPayload?.secret) {
        const lastUsedStep = typeof meta.last_totp_step === 'number' ? meta.last_totp_step : 0;
        const totpResult = verifyTotpCode(secretPayload.secret, code, lastUsedStep);
        if (totpResult.valid) {
          verified = true;
          verifiedStep = totpResult.step;
        }
      }
    } else if (recoveryCode && challenge.mode === 'verify') {
      const codesList = Array.isArray(meta.backup_codes) ? [...meta.backup_codes] : [];
      for (let i = 0; i < codesList.length; i++) {
        const entry = codesList[i];
        if (entry && !entry.used && entry.salt && entry.hash) {
          const candidateHash = hashRecoveryCode(recoveryCode, entry.salt);
          if (safeEqual(candidateHash, entry.hash)) {
            codesList[i] = { ...entry, used: true };
            updatedBackupCodes = codesList;
            verified = true;
            break;
          }
        }
      }
    }

    if (!verified) {
      const failInfo = await recordFailedAttempt(user, ip);
      await logSecurityEvent({
        event: failInfo.lockedNow ? 'ACCOUNT_LOCKED' : 'MFA_FAILED',
        severity: failInfo.lockedNow ? 'CRITICAL' : 'WARN',
        actorEmail: user.email || challenge.email,
        actorId: user.id,
        ip,
        userAgent: ua,
        path: '/api/auth/mfa',
        details: {
          mode: challenge.mode,
          method: code ? 'totp' : 'recovery',
          failedCount: failInfo.failedCount,
        },
      });
      return NextResponse.json(
        { success: false, error: 'Invalid or already used verification code.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const extraMeta: Record<string, any> = {
      totp_enabled: true,
    };
    if (typeof verifiedStep === 'number') {
      extraMeta.last_totp_step = verifiedStep;
    }
    if (updatedBackupCodes) {
      extraMeta.backup_codes = updatedBackupCodes;
    }

    await recordSuccessfulLogin(user, ip, extraMeta);

    const sessionVersion = Number(meta.session_version || 1);
    const name = String(meta.name || challenge.name || 'Admin');
    const sessionPayload = createSessionPayload({
      uid: user.id,
      email: user.email || challenge.email,
      name,
      role,
      ver: sessionVersion,
      req,
    });

    await logSecurityEvent({
      event: challenge.mode === 'enroll' ? 'MFA_ENROLLED_AND_LOGIN' : 'LOGIN_SUCCESS',
      severity: 'INFO',
      actorEmail: user.email || challenge.email,
      actorId: user.id,
      ip,
      userAgent: ua,
      path: '/api/auth/mfa',
      details: {
        role,
        usedRecoveryCode: Boolean(recoveryCode && !code),
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email || challenge.email,
          name,
          role,
        },
      },
      { headers: NO_STORE_HEADERS }
    );

    setSessionCookie(res, sessionPayload);
    clearMfaChallengeCookie(res);
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Verification failed.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
