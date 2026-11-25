import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';
import {
  DEFAULT_BRAND_NAME,
  SETTINGS_EMAIL,
  getSiteSettingsServer,
  invalidateSiteSettingsCache,
} from '@/lib/site-settings-server';
import { sanitizePriorityRules } from '@/lib/university-classification';

export async function GET() {
  try {
    const settings = await getSiteSettingsServer(true);

    return NextResponse.json(
      {
        success: true,
        brandName: settings.brandName,
        priorityUniversities: settings.priorityUniversities,
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
        priorityUniversities: [],
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
    const existing = await getSiteSettingsServer(true);

    let nextBrand = existing.brandName;
    if (body.brandName !== undefined) {
      const cleanBrand = String(body.brandName || '').trim().slice(0, 60);
      if (cleanBrand.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Brand name must be between 2 and 60 characters.' },
          { status: 400, headers: { 'Cache-Control': 'no-store, private' } }
        );
      }
      nextBrand = cleanBrand;
    }

    let nextPriority = existing.priorityUniversities;
    if (body.priorityUniversities !== undefined) {
      if (!Array.isArray(body.priorityUniversities)) {
        return NextResponse.json(
          { success: false, error: 'priorityUniversities must be an array.' },
          { status: 400, headers: { 'Cache-Control': 'no-store, private' } }
        );
      }
      nextPriority = sanitizePriorityRules(body.priorityUniversities);
    }

    const supabase = createServerSupabaseClient();

    await supabase.from('inquiries').delete().eq('email', SETTINGS_EMAIL);

    const { error } = await supabase.from('inquiries').insert({
      student_name: '__SETTINGS__',
      email: SETTINGS_EMAIL,
      phone: 'SYSTEM',
      background_profile: {
        brand_name: nextBrand,
        priority_universities: nextPriority,
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

    invalidateSiteSettingsCache();

    await logSecurityEvent({
      event:
        body.priorityUniversities !== undefined && body.brandName === undefined
          ? 'PRIORITY_UNIVERSITIES_UPDATED'
          : 'SITE_SETTINGS_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip: getClientIp(req),
      path: '/api/site-settings',
      details: {
        brandName: nextBrand,
        priorityCount: nextPriority.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        brandName: nextBrand,
        priorityUniversities: nextPriority,
      },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update site settings.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }
}
