import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

const BASE_SELECT = `
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
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('id');
    const includeRaw = searchParams.get('include_raw') === 'true';

    const supabase = createServerSupabaseClient();

    // 1. Single course detail fetch (includes raw_excel_data)
    if (courseId) {
      let { data, error }: { data: any; error: any } = await (supabase.from('courses') as any)
        .select(`raw_excel_data, ${BASE_SELECT}`)
        .eq('id', courseId)
        .single();

      if (error && error.message?.includes('raw_excel_data')) {
        const fb = await (supabase.from('courses') as any)
          .select(BASE_SELECT)
          .eq('id', courseId)
          .single();
        data = fb.data;
        error = fb.error;
      }

      if (error || !data) {
        return NextResponse.json({ success: false, error: error?.message || 'Not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        course: {
          ...data,
          eligibility_rules: Array.isArray(data.eligibility_rules)
            ? data.eligibility_rules[0]
            : data.eligibility_rules,
        },
      });
    }

    // 2. Paginated list fetch (lightweight by default for fast loading)
    const allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let useRawColumn = includeRaw;

    while (true) {
      const selectCols = useRawColumn ? `raw_excel_data, ${BASE_SELECT}` : BASE_SELECT;
      const res: { data: any[] | null; error: any } = await (supabase.from('courses') as any)
        .select(selectCols)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      const { data, error } = res;

      if (error && useRawColumn && error.message?.includes('raw_excel_data')) {
        useRawColumn = false;
        continue;
      }

      if (error) {
        console.error('Error fetching Supabase courses:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const formattedCourses = allRows.map((c: any) => ({
      ...c,
      eligibility_rules: Array.isArray(c.eligibility_rules)
        ? c.eligibility_rules[0]
        : c.eligibility_rules,
    }));

    return NextResponse.json(
      {
        success: true,
        courses: formattedCourses,
        count: formattedCourses.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
