import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET() {
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

    return NextResponse.json({ success: true, inquiries: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_name,
      email = 'counselor@intake.local',
      phone = 'N/A',
      background_profile,
      ai_suggested_courses = {},
    } = body;

    if (!student_name) {
      return NextResponse.json({ success: false, error: 'Student name is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        student_name,
        email,
        phone,
        background_profile: background_profile || {},
        ai_suggested_courses,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Enquiry saved successfully',
      inquiry: data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
