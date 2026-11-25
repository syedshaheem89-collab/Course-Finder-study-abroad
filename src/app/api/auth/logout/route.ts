import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { verifySameOrigin } from '@/lib/security/csrf';
import { getClientIp } from '@/lib/security/rate-limit';
import {
  clearCounselorSessionCookie,
  clearMfaChallengeCookie,
  clearSessionCookie,
  invalidateUserCache,
  verifyCounselorSessionCookie,
  verifySessionCookie,
} from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: 'Cross-site request blocked.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';
  const adminSession = verifySessionCookie(req);
  const counselorSession = verifyCounselorSessionCookie(req);
  const activeSession = adminSession || counselorSession;

  let allDevices = false;
  try {
    const body = await req.json();
    allDevices = Boolean(body?.allDevices);
  } catch {
    // Empty body is valid
  }

  if (activeSession) {
    if (allDevices) {
      try {
        const supabase = createServerSupabaseClient();
        const { data } = await supabase.auth.admin.getUserById(activeSession.uid);
        if (data?.user) {
          const meta = (data.user.app_metadata || {}) as Record<string, any>;
          const nextVer = Number(meta.session_version || 1) + 1;
          await supabase.auth.admin.updateUserById(activeSession.uid, {
            app_metadata: {
              ...meta,
              session_version: nextVer,
            },
          });
          invalidateUserCache(activeSession.uid);
        }
      } catch {
        // Non-fatal
      }
    }

    await logSecurityEvent({
      event: allDevices ? 'SESSIONS_REVOKED' : 'LOGOUT',
      severity: 'INFO',
      actorEmail: activeSession.email,
      actorId: activeSession.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/logout',
    });
  }

  const res = NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  clearSessionCookie(res);
  clearCounselorSessionCookie(res);
  clearMfaChallengeCookie(res);
  return res;
}
