import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/security/session';
import { getRecentAuditLogs } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const logs = await getRecentAuditLogs(100);
  return NextResponse.json({ success: true, logs }, { headers: NO_STORE_HEADERS });
}
