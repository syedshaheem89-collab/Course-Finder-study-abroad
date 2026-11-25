import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';

const MAX_EXCEL_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXCEL_EXTS = ['.xlsx', '.xls', '.csv'];

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_EXCEL_EXTS.some((ext) => lowerName.endsWith(ext))) {
      return NextResponse.json(
        { success: false, error: 'Only .xlsx, .xls, and .csv files are permitted.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_EXCEL_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Uploaded spreadsheet exceeds 15 MB limit.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Read the workbook from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to JSON array
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'The uploaded spreadsheet contains no data rows' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    let insertedCount = 0;
    const errors: string[] = [];

    for (const row of rawRows) {
      try {
        // Normalize column keys regardless of case or spacing
        const getVal = (possibleKeys: string[]) => {
          for (const k of Object.keys(row)) {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const target of possibleKeys) {
              if (cleanKey === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                return row[k];
              }
            }
          }
          return undefined;
        };

        const uniName = getVal(['university', 'university_name', 'institution', 'college']) || 'Unknown University';
        const country = getVal(['country', 'nation', 'location']) || 'Global';
        const programName = getVal(['program_name', 'course', 'course_name', 'program', 'title']) || 'Degree Program';
        const degreeLevel = getVal(['degree_level', 'level', 'degree']) || 'Master';
        const category = getVal(['category', 'discipline', 'stream', 'field']) || 'Computer Science & AI';
        const duration = Number(getVal(['duration_months', 'duration', 'months']) || 24);
        const fees = Number(getVal(['tuition_fees_eur', 'tuition_fee', 'fees', 'tuition', 'fee_eur']) || 0);
        const intake = getVal(['intake_months', 'intakes', 'intake', 'terms']) || 'September';
        const courseUrl = getVal(['course_url', 'url', 'link', 'website']) || 'https://study-abroad.edu';
        const stayBack = Number(getVal(['stay_back_visa_years', 'stay_back', 'visa_stay_back']) || 2.0);
        const avgSalary = Number(getVal(['average_graduate_salary', 'salary', 'avg_salary']) || 55000);

        // Eligibility rules
        const min12th = Number(getVal(['min_12th_percent', '12th_percent', '12th']) || 60);
        const minDegree = Number(getVal(['min_degree_percent', 'degree_percent', 'undergrad_percent']) || 60);
        const minIelts = Number(getVal(['min_ielts', 'ielts']) || 6.5);
        const minToefl = Number(getVal(['min_toefl', 'toefl']) || 85);
        const interview = Boolean(getVal(['interview_required', 'interview']));
        const workExp = Number(getVal(['work_experience_months', 'experience']) || 0);

        // 1. Ensure University exists in Supabase
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
            errors.push(`Failed university insert for ${uniName}: ${uniError?.message}`);
            continue;
          }
          uniId = newUni.id;
        }

        // 2. Insert Course
        const intakeArray = typeof intake === 'string' ? intake.split(',').map((s) => s.trim()) : ['September'];

        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert({
            university_id: uniId,
            program_name: programName,
            degree_level: degreeLevel,
            category: category,
            duration_months: duration,
            tuition_fees_eur: fees,
            intake_months: intakeArray,
            course_url: courseUrl,
            stay_back_visa_years: stayBack,
            average_graduate_salary: avgSalary,
          })
          .select('id')
          .single();

        if (courseError || !newCourse) {
          errors.push(`Failed course insert for ${programName}: ${courseError?.message}`);
          continue;
        }

        // 3. Insert Eligibility Rules
        await supabase.from('eligibility_rules').insert({
          course_id: newCourse.id,
          min_12th_percent: min12th,
          min_degree_percent: minDegree,
          min_ielts: minIelts,
          min_toefl: minToefl,
          interview_required: interview,
          work_experience_months: workExp,
        });

        insertedCount++;
      } catch (rowErr: any) {
        errors.push(`Row processing exception: ${rowErr.message}`);
      }
    }

    await logSecurityEvent({
      event: 'EXCEL_INGESTED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/ingest-excel',
      details: { fileName: file.name, insertedCount },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ingested and saved ${insertedCount} course records directly into your Supabase database!`,
      inserted_count: insertedCount,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err: any) {
    console.error('Error in /api/ingest-excel:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
