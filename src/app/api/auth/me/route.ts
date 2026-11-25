import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  verifySessionCookie,
  verifySessionFreshness,
} from '@/lib/security/session';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET(req: NextRequest) {
  const payload = verifySessionCookie(req);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE_HEADERS });
  }

  const fresh = await verifySessionFreshness(payload);
  if (!fresh) {
    const res = NextResponse.json({ authenticated: false }, { headers: NO_STORE_HEADERS });
    clearSessionCookie(res);
    return res;
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        sessionExpiresAt: payload.exp,
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}
