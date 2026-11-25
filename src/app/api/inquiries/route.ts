import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { isValidEmail } from '@/lib/security/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: true, inquiries: [] });
    }

    return NextResponse.json(
      { success: true, inquiries: data || [] },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load inquiries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Silent bot trap via honeypot field
    if (body.website_hp) {
      return NextResponse.json({ success: true, message: 'Enquiry saved successfully' });
    }

    const {
      student_name,
      email = 'counselor@intake.local',
      phone = 'N/A',
      background_profile,
      ai_suggested_courses = {},
    } = body;

    const cleanName = String(student_name || '').trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      return NextResponse.json(
        { success: false, error: 'Student name must be between 2 and 120 characters.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email || 'counselor@intake.local').trim().toLowerCase();
    if (cleanEmail !== 'counselor@intake.local' && !isValidEmail(cleanEmail)) {
      return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }

    const cleanPhone = String(phone || 'N/A').trim().slice(0, 30);
    const safeProfile = background_profile && typeof background_profile === 'object' ? background_profile : {};
    if (JSON.stringify(safeProfile).length > 16_000) {
      return NextResponse.json({ success: false, error: 'Profile payload too large.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        student_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        background_profile: safeProfile,
        ai_suggested_courses:
          ai_suggested_courses && typeof ai_suggested_courses === 'object' ? ai_suggested_courses : {},
      })
      .select('id, student_name, created_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Unable to save enquiry right now.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Enquiry saved successfully',
      inquiry: data,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to submit enquiry.' }, { status: 500 });
  }
}
