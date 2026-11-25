import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';
import { resolveOfficialStayBackYears } from '@/lib/country-visa-intel';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No validated rows provided' }, { status: 400 });
    }

    if (rows.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 rows permitted per commit batch.' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Pre-load existing universities in 1 query
    const { data: existingUnis, error: uniFetchErr } = await supabase
      .from('universities')
      .select('id, name, country')
      .limit(5000);

    if (uniFetchErr) {
      return NextResponse.json({ success: false, error: uniFetchErr.message }, { status: 500 });
    }

    const uniMap = new Map<string, string>();
    const uniCountryMap = new Map<string, string>();
    (existingUnis || []).forEach((u: any) => {
      if (u.name) {
        const key = u.name.trim().toLowerCase();
        uniMap.set(key, u.id);
        if (u.country) uniCountryMap.set(key, String(u.country).trim());
      }
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

    // 3. Pre-load existing courses for the batch's universities to prevent duplicates
    const batchUniIds = Array.from(
      new Set(
        rows
          .map((r: any) => uniMap.get(String(r.university || 'Global University').trim().toLowerCase()))
          .filter((id: string | undefined): id is string => Boolean(id))
      )
    );

    const existingCourseKeys = new Set<string>();
    if (batchUniIds.length > 0) {
      const { data: existingCourses } = await supabase
        .from('courses')
        .select('university_id, program_name')
        .in('university_id', batchUniIds)
        .limit(5000);

      (existingCourses || []).forEach((c: any) => {
        if (c.university_id && c.program_name) {
          existingCourseKeys.add(`${c.university_id}::${String(c.program_name).trim().toLowerCase()}`);
        }
      });
    }

    // 4. Prepare deduplicated course payloads for bulk insert
    const baseCourses: any[] = [];
    const coursesWithRaw: any[] = [];
    const matchedRows: any[] = [];

    for (const r of rows) {
      const uniName = String(r.university || 'Global University').trim();
      const uniId = uniMap.get(uniName.toLowerCase());
      if (!uniId) continue;

      const progName = String(r.program_name || 'Degree Program').trim();
      const dedupeKey = `${uniId}::${progName.toLowerCase()}`;
      if (existingCourseKeys.has(dedupeKey)) continue;
      existingCourseKeys.add(dedupeKey);

      const intakes =
        typeof r.intake === 'string'
          ? r.intake.split(',').map((s: string) => s.trim()).filter(Boolean)
          : ['September'];

      const uniKey = uniName.toLowerCase();
      const rowCountry = String(r.country || uniCountryMap.get(uniKey) || 'Global').trim();
      const degreeLevel = String(r.degree_level || 'Master');

      const basePayload = {
        university_id: uniId,
        program_name: progName,
        degree_level: degreeLevel,
        category: r.category || 'Computer Science & AI',
        duration_months: Number(r.duration_months) || 24,
        tuition_fees_eur: Math.max(0, Number(r.tuition_fees_eur) || 0),
        intake_months: intakes.length > 0 ? intakes : ['September'],
        course_url: sanitizeHttpUrl(String(r.course_url || '')) || 'https://study-abroad.edu',
        stay_back_visa_years: resolveOfficialStayBackYears(
          rowCountry,
          degreeLevel,
          progName,
          r.stay_back_visa_years !== undefined && r.stay_back_visa_years !== ''
            ? Number(r.stay_back_visa_years)
            : undefined,
          r.category
        ),
        average_graduate_salary: Math.max(0, Number(r.average_graduate_salary) || 50000),
      };

      baseCourses.push(basePayload);
      coursesWithRaw.push({
        ...basePayload,
        ...(r.raw_excel_data ? { raw_excel_data: r.raw_excel_data } : {}),
      });
      matchedRows.push(r);
    }

    if (baseCourses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All courses in this batch already exist in Supabase (skipped duplicates).',
        inserted_count: 0,
      });
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

    await logSecurityEvent({
      event: 'COURSES_COMMITTED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/ingest-excel/commit',
      details: { insertedCount: insertedCourses.length },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully confirmed and stored ${insertedCourses.length} courses into Supabase!`,
      inserted_count: insertedCourses.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
