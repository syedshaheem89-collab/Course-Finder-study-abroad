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

    // 1. Pre-load existing universities in 1 query
    const { data: existingUnis, error: uniFetchErr } = await supabase
      .from('universities')
      .select('id, name');

    if (uniFetchErr) {
      return NextResponse.json({ success: false, error: uniFetchErr.message }, { status: 500 });
    }

    const uniMap = new Map<string, string>();
    (existingUnis || []).forEach((u: any) => {
      if (u.name) uniMap.set(u.name.trim().toLowerCase(), u.id);
    });

    // 2. Bulk-insert any missing universities in 1 query
    const missingUnisMap = new Map<
      string,
      { name: string; country: string; global_ranking: number; campus_locations: string[] }
    >();

    for (const r of rows) {
      const uniName = String(r.university || 'Global University').trim();
      const country = String(r.country || 'Global').trim();
      const key = uniName.toLowerCase();
      if (!uniMap.has(key) && !missingUnisMap.has(key)) {
        missingUnisMap.set(key, {
          name: uniName,
          country,
          global_ranking: 150,
          campus_locations: [country],
        });
      }
    }

    if (missingUnisMap.size > 0) {
      const { data: insertedUnis, error: insertUniErr } = await supabase
        .from('universities')
        .insert(Array.from(missingUnisMap.values()))
        .select('id, name');

      if (insertUniErr) {
        return NextResponse.json({ success: false, error: `University batch insert failed: ${insertUniErr.message}` }, { status: 500 });
      }
      (insertedUnis || []).forEach((u: any) => {
        if (u.name) uniMap.set(u.name.trim().toLowerCase(), u.id);
      });
    }

    // 3. Prepare course payloads for bulk insert
    const baseCourses: any[] = [];
    const coursesWithRaw: any[] = [];
    const matchedRows: any[] = [];

    for (const r of rows) {
      const uniName = String(r.university || 'Global University').trim();
      const uniId = uniMap.get(uniName.toLowerCase());
      if (!uniId) continue;

      const intakes =
        typeof r.intake === 'string'
          ? r.intake.split(',').map((s: string) => s.trim()).filter(Boolean)
          : ['September'];

      const basePayload = {
        university_id: uniId,
        program_name: r.program_name || 'Degree Program',
        degree_level: r.degree_level || 'Master',
        category: r.category || 'Computer Science & AI',
        duration_months: Number(r.duration_months) || 24,
        tuition_fees_eur: Number(r.tuition_fees_eur) || 0,
        intake_months: intakes.length > 0 ? intakes : ['September'],
        course_url: r.course_url || 'https://study-abroad.edu',
        stay_back_visa_years: Number(r.stay_back_visa_years) || 1.5,
        average_graduate_salary: Number(r.average_graduate_salary) || 50000,
      };

      baseCourses.push(basePayload);
      coursesWithRaw.push({
        ...basePayload,
        ...(r.raw_excel_data ? { raw_excel_data: r.raw_excel_data } : {}),
      });
      matchedRows.push(r);
    }

    if (baseCourses.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid rows could be mapped to universities' }, { status: 400 });
    }

    // 4. Bulk-insert courses in 1 query (with fallback if raw_excel_data column doesn't exist)
    let { data: insertedCourses, error: courseError } = await supabase
      .from('courses')
      .insert(coursesWithRaw)
      .select('id');

    if (courseError && courseError.message?.includes('raw_excel_data')) {
      const fallback = await supabase
        .from('courses')
        .insert(baseCourses)
        .select('id');
      insertedCourses = fallback.data;
      courseError = fallback.error;
    }

    if (courseError || !insertedCourses) {
      return NextResponse.json(
        { success: false, error: `Course batch insert failed: ${courseError?.message}` },
        { status: 500 }
      );
    }

    // 5. Bulk-insert eligibility rules in 1 query
    const rulesToInsert = insertedCourses.map((course: { id: string }, idx: number) => {
      const r = matchedRows[idx] || {};
      return {
        course_id: course.id,
        min_12th_percent: Number(r.min_12th_percent) || 60,
        min_degree_percent: Number(r.min_degree_percent) || 60,
        min_ielts: Number(r.min_ielts) || 6.5,
        min_toefl: 85,
        interview_required: Boolean(r.interview_required),
        work_experience_months: 0,
      };
    });

    if (rulesToInsert.length > 0) {
      await supabase.from('eligibility_rules').insert(rulesToInsert);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully confirmed and stored ${insertedCourses.length} courses into Supabase!`,
      inserted_count: insertedCourses.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
