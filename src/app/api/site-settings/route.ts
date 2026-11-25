import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';

const SETTINGS_EMAIL = '__site_settings__';
const DEFAULT_BRAND_NAME = 'Course Engine';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('background_profile')
      .eq('email', SETTINGS_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;
    const savedBrand =
      !error && row?.background_profile && typeof (row.background_profile as any).brand_name === 'string'
        ? String((row.background_profile as any).brand_name).trim()
        : '';

    return NextResponse.json(
      {
        success: true,
        brandName: savedBrand || DEFAULT_BRAND_NAME,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        brandName: DEFAULT_BRAND_NAME,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const cleanBrand = String(body.brandName || '').trim().slice(0, 60);
    if (cleanBrand.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Brand name must be between 2 and 60 characters.' },
        { status: 400, headers: { 'Cache-Control': 'no-store, private' } }
      );
    }

    const supabase = createServerSupabaseClient();

    await supabase.from('inquiries').delete().eq('email', SETTINGS_EMAIL);

    const { error } = await supabase.from('inquiries').insert({
      student_name: '__SETTINGS__',
      email: SETTINGS_EMAIL,
      phone: 'SYSTEM',
      background_profile: {
        brand_name: cleanBrand,
        updated_by: auth.session.email,
        updated_at: new Date().toISOString(),
      },
      ai_suggested_courses: {},
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to save site settings.' },
        { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
      );
    }

    await logSecurityEvent({
      event: 'SITE_BRAND_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip: getClientIp(req),
      path: '/api/site-settings',
      details: { brandName: cleanBrand },
    });

    return NextResponse.json(
      { success: true, brandName: cleanBrand },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update site settings.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }
}
