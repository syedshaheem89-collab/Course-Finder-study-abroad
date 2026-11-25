import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { decryptJson, generateRecoveryCodes } from '@/lib/security/crypto';
import { verifyTotpCode } from '@/lib/security/totp';
import { getClientIp } from '@/lib/security/rate-limit';
import { invalidateUserCache, requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const totpCode = String(body.totpCode || '').trim();

    if (!totpCode) {
      return NextResponse.json(
        { success: false, error: 'Live 6-digit authenticator code is required.' },
        { status: 400, headers: NO_STORE_HEADERS }
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

    const { plain: backupCodes, hashes: backupHashes } = generateRecoveryCodes(8);

    const { error: updErr } = await supabase.auth.admin.updateUserById(auth.session.uid, {
      app_metadata: {
        ...meta,
        backup_codes: backupHashes,
        last_totp_step: totpRes.step,
      },
    });

    if (updErr) {
      return NextResponse.json(
        { success: false, error: updErr.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    invalidateUserCache(auth.session.uid);

    await logSecurityEvent({
      event: 'BACKUP_CODES_REGENERATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/backup-codes',
    });

    return NextResponse.json(
      {
        success: true,
        backupCodes,
        message: '8 fresh recovery codes generated. Previous recovery codes are invalidated.',
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to regenerate backup codes.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
