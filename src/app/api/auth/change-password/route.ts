import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { decryptJson } from '@/lib/security/crypto';
import { verifyTotpCode } from '@/lib/security/totp';
import { validatePasswordStrength } from '@/lib/security/password';
import { getClientIp } from '@/lib/security/rate-limit';
import { verifySupabasePassword } from '@/lib/security/admin-users';
import {
  createSessionPayload,
  invalidateUserCache,
  requireAdminSession,
  setSessionCookie,
} from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const totpCode = String(body.totpCode || '').trim();

    if (!currentPassword || !newPassword || !totpCode) {
      return NextResponse.json(
        { success: false, error: 'Current password, new password, and 6-digit authenticator code are required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from your current password.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { success: false, error: pwCheck.errors[0] },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const passwordValid = await verifySupabasePassword(auth.session.email, currentPassword);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: userData, error: fetchErr } = await supabase.auth.admin.getUserById(auth.session.uid);
    if (fetchErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: 'Account unavailable.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const meta = (userData.user.app_metadata || {}) as Record<string, any>;
    const secretPayload = decryptJson<{ secret: string }>(meta.totp_secret_enc, 'totp');
    const lastStep = typeof meta.last_totp_step === 'number' ? meta.last_totp_step : 0;

    if (!secretPayload?.secret) {
      return NextResponse.json(
        { success: false, error: '2FA configuration missing on account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const totpRes = verifyTotpCode(secretPayload.secret, totpCode, lastStep);
    if (!totpRes.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or already used 6-digit authenticator code.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const nextVer = Number(meta.session_version || 1) + 1;
    const { error: updErr } = await supabase.auth.admin.updateUserById(auth.session.uid, {
      password: newPassword,
      app_metadata: {
        ...meta,
        session_version: nextVer,
        last_totp_step: totpRes.step,
        password_changed_at: new Date().toISOString(),
      },
    });

    if (updErr) {
      return NextResponse.json(
        { success: false, error: updErr.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    invalidateUserCache(auth.session.uid);

    const newSession = createSessionPayload({
      uid: auth.session.uid,
      email: auth.session.email,
      name: auth.session.name,
      role: auth.session.role,
      ver: nextVer,
      req,
    });

    await logSecurityEvent({
      event: 'PASSWORD_CHANGED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/change-password',
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Password updated and all other active sessions invalidated.',
      },
      { headers: NO_STORE_HEADERS }
    );
    setSessionCookie(res, newSession);
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to change password.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
