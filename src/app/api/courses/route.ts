import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Query courses with universities and eligibility_rules joins
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        university_id,
        program_name,
        degree_level,
        category,
        duration_months,
        tuition_fees_eur,
        intake_months,
        course_url,
        stay_back_visa_years,
        average_graduate_salary,
        created_at,
        university:universities (
          id,
          name,
          country,
          global_ranking,
          campus_locations
        ),
        eligibility_rules (
          id,
          course_id,
          min_12th_percent,
          min_degree_percent,
          min_ielts,
          min_toefl,
          interview_required,
          work_experience_months
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Supabase courses:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Normalize eligibility_rules object
    const formattedCourses = (courses || []).map((c: any) => ({
      ...c,
      eligibility_rules: Array.isArray(c.eligibility_rules) ? c.eligibility_rules[0] : c.eligibility_rules,
    }));

    return NextResponse.json({
      success: true,
      courses: formattedCourses,
      count: formattedCourses.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
