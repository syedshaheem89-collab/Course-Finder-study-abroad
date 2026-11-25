import { NextRequest, NextResponse } from 'next/server';
import { hasDedicatedSessionSecret } from '@/lib/security/crypto';
import { hasAnySuperAdmin } from '@/lib/security/admin-users';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`setup-status:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const initialized = await hasAnySuperAdmin();
  const setupKeyConfigured = Boolean(
    process.env.ADMIN_SETUP_SECRET && process.env.ADMIN_SETUP_SECRET.trim().length >= 16
  );

  return NextResponse.json(
    {
      success: true,
      initialized,
      setupKeyConfigured,
      sessionSecretConfigured: hasDedicatedSessionSecret(),
    },
    { headers: NO_STORE_HEADERS }
  );
}
