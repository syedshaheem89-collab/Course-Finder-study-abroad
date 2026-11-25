import { NextRequest, NextResponse } from 'next/server';
import {
  clearCounselorSessionCookie,
  clearSessionCookie,
  verifyCounselorSessionCookie,
  verifyCounselorSessionFreshness,
  verifySessionCookie,
  verifySessionFreshness,
} from '@/lib/security/session';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET(req: NextRequest) {
  const adminPayload = verifySessionCookie(req);
  if (adminPayload) {
    const freshAdmin = await verifySessionFreshness(adminPayload);
    if (freshAdmin) {
      return NextResponse.json(
        {
          authenticated: true,
          isStaff: true,
          isAdmin: true,
          user: {
            id: adminPayload.uid,
            email: adminPayload.email,
            name: adminPayload.name,
            role: adminPayload.role,
            sessionExpiresAt: adminPayload.exp,
          },
        },
        { headers: NO_STORE_HEADERS }
      );
    }
  }

  const counselorPayload = verifyCounselorSessionCookie(req);
  if (counselorPayload) {
    const freshCounselor = await verifyCounselorSessionFreshness(counselorPayload);
    if (freshCounselor) {
      return NextResponse.json(
        {
          authenticated: true,
          isStaff: true,
          isAdmin: false,
          user: {
            id: counselorPayload.uid,
            email: counselorPayload.email,
            name: counselorPayload.name,
            role: counselorPayload.role,
            sessionExpiresAt: counselorPayload.exp,
          },
        },
        { headers: NO_STORE_HEADERS }
      );
    }
    const staleRes = NextResponse.json(
      { authenticated: false, isStaff: false, isAdmin: false },
      { headers: NO_STORE_HEADERS }
    );
    clearCounselorSessionCookie(staleRes);
    if (adminPayload) clearSessionCookie(staleRes);
    return staleRes;
  }

  const res = NextResponse.json(
    { authenticated: false, isStaff: false, isAdmin: false },
    { headers: NO_STORE_HEADERS }
  );
  if (adminPayload) clearSessionCookie(res);
  return res;
}
