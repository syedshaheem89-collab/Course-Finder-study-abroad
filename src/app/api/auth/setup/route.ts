import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  encryptJson,
  generateRecoveryCodes,
  safeEqual,
} from '@/lib/security/crypto';
import { buildOtpAuthUri, generateTotpSecret } from '@/lib/security/totp';
import { validatePasswordStrength } from '@/lib/security/password';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { isValidEmail } from '@/lib/security/validation';
import { hasAnySuperAdmin, resetSuperAdminCache } from '@/lib/security/admin-users';
import { setMfaChallengeCookie } from '@/lib/security/session';
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

  const rl = checkRateLimit(`setup:${ip}`, 5, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many setup attempts. Try again later.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const alreadyInitialized = await hasAnySuperAdmin();
    if (alreadyInitialized) {
      await logSecurityEvent({
        event: 'SETUP_BLOCKED_ALREADY_INITIALIZED',
        severity: 'WARN',
        ip,
        userAgent: ua,
        path: '/api/auth/setup',
      });
      return NextResponse.json(
        { success: false, error: 'Initial admin setup has already been completed and is permanently locked.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const expectedSetupSecret = (process.env.ADMIN_SETUP_SECRET || '').trim();
    if (!expectedSetupSecret || expectedSetupSecret.length < 16) {
      return NextResponse.json(
        {
          success: false,
          error: 'ADMIN_SETUP_SECRET (minimum 16 characters) must be configured in environment variables before setup.',
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();
    const setupSecret = String(body.setupSecret || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!setupSecret || !safeEqual(setupSecret, expectedSetupSecret)) {
      await logSecurityEvent({
        event: 'SETUP_INVALID_SECRET',
        severity: 'CRITICAL',
        actorEmail: email || null,
        ip,
        userAgent: ua,
        path: '/api/auth/setup',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid Setup Secret Key.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { success: false, error: 'Full name must be between 2 and 80 characters.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { success: false, error: pwCheck.errors[0] },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const totpSecret = generateTotpSecret();
    const totpSecretEnc = encryptJson({ secret: totpSecret }, 'totp');
    const { plain: backupCodes, hashes: backupHashes } = generateRecoveryCodes(8);
    const otpAuthUri = buildOtpAuthUri(email, totpSecret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUri, { width: 240, margin: 2 });

    const supabase = createServerSupabaseClient();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'super_admin',
        name,
        status: 'active',
        session_version: 1,
        totp_enabled: false,
        totp_secret_enc: totpSecretEnc,
        backup_codes: backupHashes,
        failed_attempts: 0,
        locked_until: null,
        last_totp_step: 0,
      },
    });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { success: false, error: createErr?.message || 'Failed to create Super Admin account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    resetSuperAdminCache();

    await logSecurityEvent({
      event: 'SUPER_ADMIN_CREATED',
      severity: 'INFO',
      actorEmail: email,
      actorId: created.user.id,
      ip,
      userAgent: ua,
      path: '/api/auth/setup',
      details: { name },
    });

    const res = NextResponse.json(
      {
        success: true,
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
        uid: created.user.id,
        email,
        name,
        role: 'super_admin',
        mode: 'enroll',
      },
      req
    );

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Setup failed.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
