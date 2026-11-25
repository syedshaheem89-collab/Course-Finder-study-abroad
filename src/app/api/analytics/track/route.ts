import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizeCountryName } from '@/lib/countries';

const ALLOWED_EVENTS = new Set([
  'search',
  'country_select',
  'course_view',
  'ai_recommend',
  'excel_export',
]);

function capStr(val: unknown, max = 120): string {
  return String(val || '').trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = capStr(body.event_type, 40);
    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ success: false, error: 'Invalid event type' }, { status: 400 });
    }

    const rawCountry = capStr(body.country, 80);
    const normalizedCountry = rawCountry ? normalizeCountryName(rawCountry) || '' : '';

    const safePayload = {
      event_type: eventType,
      country: normalizedCountry,
      query: capStr(body.query, 120),
      degree_level: capStr(body.degree_level, 80),
      subject: capStr(body.subject, 100),
      budget_tier: capStr(body.budget_tier, 80),
      intake: capStr(body.intake, 60),
      english_status: capStr(body.english_status, 80),
      city: capStr(body.city, 100),
      course_name: capStr(body.course_name, 160),
      university_name: capStr(body.university_name, 160),
      utm_source: capStr(body.utm_source, 80),
      utm_medium: capStr(body.utm_medium, 80),
      utm_campaign: capStr(body.utm_campaign, 80),
      referrer: capStr(body.referrer, 100),
      device_type: body.device_type === 'Mobile' ? 'Mobile' : 'Desktop',
      recorded_at: new Date().toISOString(),
    };

    try {
      const supabase = createServerSupabaseClient();
      await supabase.from('inquiries').insert({
        student_name: '__ANALYTICS__',
        email: '__analytics_event__',
        phone: 'SYSTEM',
        background_profile: safePayload,
        ai_suggested_courses: {},
      });
    } catch {
      // Non-fatal: analytics persistence errors never block public visitors
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
