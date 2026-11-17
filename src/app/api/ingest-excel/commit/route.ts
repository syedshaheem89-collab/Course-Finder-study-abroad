import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No validated rows provided' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    let insertedCount = 0;
    const errors: string[] = [];

    for (const r of rows) {
      try {
        const uniName = r.university || 'Global University';
        const country = r.country || 'Global';

        // 1. Ensure University exists
        let { data: existingUni } = await supabase
          .from('universities')
          .select('id')
          .eq('name', uniName)
          .maybeSingle();

        let uniId = existingUni?.id;

        if (!uniId) {
          const { data: newUni, error: uniError } = await supabase
            .from('universities')
            .insert({
              name: uniName,
              country: country,
              global_ranking: 150,
              campus_locations: [country],
            })
            .select('id')
            .single();

          if (uniError || !newUni) {
            errors.push(`University insert failed: ${uniError?.message}`);
            continue;
          }
          uniId = newUni.id;
        }

        // 2. Insert Course
        const intakes = typeof r.intake === 'string' ? r.intake.split(',').map((s: string) => s.trim()) : ['September'];

        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert({
            university_id: uniId,
            program_name: r.program_name || 'Degree Program',
            degree_level: r.degree_level || 'Master',
            category: r.category || 'Computer Science & AI',
            duration_months: Number(r.duration_months) || 24,
            tuition_fees_eur: Number(r.tuition_fees_eur) || 0,
            intake_months: intakes,
            course_url: r.course_url || 'https://study-abroad.edu',
            stay_back_visa_years: Number(r.stay_back_visa_years) || 1.5,
            average_graduate_salary: Number(r.average_graduate_salary) || 50000,
          })
          .select('id')
          .single();

        if (courseError || !newCourse) {
          errors.push(`Course insert failed: ${courseError?.message}`);
          continue;
        }

        // 3. Insert Eligibility Rules
        await supabase.from('eligibility_rules').insert({
          course_id: newCourse.id,
          min_12th_percent: Number(r.min_12th_percent) || 60,
          min_degree_percent: Number(r.min_degree_percent) || 60,
          min_ielts: Number(r.min_ielts) || 6.5,
          min_toefl: 85,
          interview_required: Boolean(r.interview_required),
          work_experience_months: 0,
        });

        insertedCount++;
      } catch (rowErr: any) {
        errors.push(rowErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully confirmed and stored ${insertedCount} courses into Supabase!`,
      inserted_count: insertedCount,
      errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
