import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { isValidEmail, isValidUuid } from '@/lib/security/validation';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .neq('email', '__analytics_event__')
      .neq('email', '__site_settings__')
      .order('created_at', { ascending: false })
      .limit(500);

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
      email = '',
      phone,
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

    const rawEmail = String(email || '').trim().toLowerCase();
    if (rawEmail === '__analytics_event__' || rawEmail === '__site_settings__') {
      return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }
    const cleanEmail =
      !rawEmail || rawEmail === 'counselor@intake.local'
        ? rawEmail || 'student@lead.local'
        : rawEmail;
    if (
      cleanEmail !== 'counselor@intake.local' &&
      cleanEmail !== 'student@lead.local' &&
      !isValidEmail(cleanEmail)
    ) {
      return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }

    let cleanPhone = 'N/A';
    if (phone !== undefined && phone !== null && String(phone).trim() !== '' && String(phone).trim() !== 'N/A') {
      const sanitizedPhone = String(phone).replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 30);
      const digitCount = sanitizedPhone.replace(/\D/g, '').length;
      if (digitCount < 7 || digitCount > 16) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid mobile number (at least 7 digits).' },
          { status: 400 }
        );
      }
      cleanPhone = sanitizedPhone;
    }

    const safeProfile = background_profile && typeof background_profile === 'object' ? background_profile : {};
    if (JSON.stringify(safeProfile).length > 24_000) {
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

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!isValidUuid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid lead ID.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('inquiries').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to delete lead.' }, { status: 500 });
    }

    await logSecurityEvent({
      event: 'ADMIN_DELETE_INQUIRY',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip: getClientIp(req),
      path: '/api/inquiries',
      details: { inquiryId: id },
    });

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete lead.' }, { status: 500 });
  }
}
