import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { expandSearchTerms } from '@/lib/search-synonyms';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/security/validation';

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

function formatCourseRow(c: any) {
  return {
    ...c,
    eligibility_rules: Array.isArray(c.eligibility_rules)
      ? c.eligibility_rules[0]
      : c.eligibility_rules,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('id');
    const isMeta = searchParams.get('meta') === 'true';
    const isPaginated = searchParams.get('paginated') === 'true';
    const includeRaw = searchParams.get('include_raw') === 'true';

    const supabase = createServerSupabaseClient();

    // 1. Metadata-only endpoint (countries, universities, total count) — <20 KB even at 100k+ courses
    if (isMeta) {
      const [{ count: totalCourses }, { data: unis }] = await Promise.all([
        (supabase.from('courses') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('universities') as any).select('id, name, country').order('name').limit(5000),
      ]);

      const countriesSet = new Set<string>();
      (unis || []).forEach((u: any) => {
        if (u.country) countriesSet.add(u.country);
      });

      return NextResponse.json(
        {
          success: true,
          totalCourses: totalCourses || 0,
          countries: Array.from(countriesSet).sort(),
          universities: unis || [],
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          },
        }
      );
    }

    // 2. Single course detail fetch (includes raw_excel_data)
    if (courseId) {
      if (!isValidUuid(courseId)) {
        return NextResponse.json({ success: false, error: 'Invalid course identifier' }, { status: 400 });
      }
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
        return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        course: formatCourseRow(data),
      });
    }

    // 3. Server-side paginated & filtered search (scales to 100,000+ courses under Vercel 4.5MB limit)
    if (isPaginated) {
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));
      const q = (searchParams.get('q') || '').trim();
      const country = (searchParams.get('country') || '').trim();
      const university = (searchParams.get('university') || '').trim();
      const subject = (searchParams.get('subject') || '').trim();
      const intake = (searchParams.get('intake') || '').trim();
      const maxTuition = Number(searchParams.get('maxTuition') || 100000);
      const idsParam = (searchParams.get('ids') || '').trim();
      const typesParam = (searchParams.get('types') || '').trim();
      const sort = searchParams.get('sort') || 'newest';

      let query = (supabase.from('courses') as any).select(BASE_SELECT, { count: 'exact' });

      if (typesParam) {
        const typeClauses: string[] = [];
        typesParam.split(',').map((t) => t.trim()).forEach((t) => {
          if (t === 'Masters') {
            typeClauses.push(
              'degree_level.ilike.%master%',
              'degree_level.ilike.%postgraduate%',
              'degree_level.ilike.%mba%',
              'program_name.ilike.%master%',
              'program_name.ilike.%msc%',
              'program_name.ilike.%mba%'
            );
          } else if (t === 'Undergraduate') {
            typeClauses.push('degree_level.ilike.%bachelor%', 'degree_level.ilike.%undergraduate%');
          } else if (t === 'UG Diploma') {
            typeClauses.push('degree_level.ilike.%ug diploma%', 'program_name.ilike.%ug diploma%');
          } else if (t === 'PG Diploma') {
            typeClauses.push('degree_level.ilike.%pg diploma%', 'program_name.ilike.%pg diploma%', 'program_name.ilike.%postgraduate diploma%');
          } else if (t === 'Certificate') {
            typeClauses.push('degree_level.ilike.%certificate%', 'program_name.ilike.%certificate%');
          } else if (t === 'PG Certificate') {
            typeClauses.push('degree_level.ilike.%pg certificate%', 'program_name.ilike.%pg certificate%', 'program_name.ilike.%postgraduate certificate%');
          }
        });
        if (typeClauses.length > 0) {
          query = query.or(typeClauses.join(','));
        }
      }

      if (idsParam) {
        const idList = idsParam.split(',').map((s) => s.trim()).filter(isValidUuid);
        if (idList.length === 0) {
          return NextResponse.json({ success: true, courses: [], total: 0, page, limit, hasMore: false });
        }
        query = query.in('id', idList);
      }

      if (country) {
        const cleanCountry = sanitizeSearchQuery(country);
        if (!cleanCountry) {
          return NextResponse.json({ success: true, courses: [], total: 0, page, limit, hasMore: false });
        }
        const { data: countryUnis } = await (supabase.from('universities') as any)
          .select('id')
          .ilike('country', cleanCountry);
        const uniIds = (countryUnis || []).map((u: any) => u.id);
        if (uniIds.length === 0) {
          return NextResponse.json({ success: true, courses: [], total: 0, page, limit, hasMore: false });
        }
        query = query.in('university_id', uniIds);
      }

      if (university && university !== 'all') {
        if (!isValidUuid(university)) {
          return NextResponse.json({ success: false, error: 'Invalid university filter' }, { status: 400 });
        }
        query = query.eq('university_id', university);
      }

      if (subject) {
        query = query.eq('category', subject);
      }

      if (intake && intake !== 'all') {
        query = query.contains('intake_months', [intake]);
      }

      if (!Number.isNaN(maxTuition) && maxTuition < 100000) {
        query = query.lte('tuition_fees_eur', maxTuition);
      }

      if (q) {
        const safeQ = sanitizeSearchQuery(q);
        if (safeQ) {
          const expandedTerms = expandSearchTerms(safeQ);
          const { data: matchingUnis } = await (supabase.from('universities') as any)
            .select('id')
            .or(`name.ilike.%${safeQ}%,country.ilike.%${safeQ}%`)
            .limit(40);
          const uniIds = (matchingUnis || []).map((u: any) => u.id).filter(isValidUuid);

          const orClauses = expandedTerms.flatMap((term) => {
            const cleanTerm = sanitizeSearchQuery(term);
            return cleanTerm
              ? [`program_name.ilike.%${cleanTerm}%`, `category.ilike.%${cleanTerm}%`]
              : [];
          });

          if (uniIds.length > 0) {
            orClauses.push(`university_id.in.(${uniIds.join(',')})`);
          }
          if (orClauses.length > 0) {
            query = query.or(orClauses.join(','));
          }
        }
      }

      if (sort === 'tuition_asc') {
        query = query.order('tuition_fees_eur', { ascending: true });
      } else if (sort === 'salary_desc') {
        query = query.order('average_graduate_salary', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to query courses.' }, { status: 500 });
      }

      const formatted = (data || []).map(formatCourseRow);
      const total = count ?? formatted.length;

      return NextResponse.json(
        {
          success: true,
          courses: formatted,
          total,
          page,
          limit,
          hasMore: from + formatted.length < total,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
          },
        }
      );
    }

    // 4. Legacy / Export list fetch (capped safely at 2000 rows to protect serverless memory/4.5MB limit)
    const idsParam = (searchParams.get('ids') || '').trim();
    const maxCap = includeRaw ? 1500 : 3000;
    const allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let useRawColumn = includeRaw;

    while (allRows.length < maxCap) {
      const selectCols = useRawColumn ? `raw_excel_data, ${BASE_SELECT}` : BASE_SELECT;
      let qBuilder = (supabase.from('courses') as any)
        .select(selectCols)
        .order('created_at', { ascending: false });

      if (idsParam) {
        const idList = idsParam.split(',').map((s) => s.trim()).filter(isValidUuid);
        if (idList.length === 0) {
          return NextResponse.json({ success: true, courses: [], count: 0 });
        }
        qBuilder = qBuilder.in('id', idList);
      }

      const res: { data: any[] | null; error: any } = await qBuilder.range(from, from + pageSize - 1);
      const { data, error } = res;

      if (error && useRawColumn && error.message?.includes('raw_excel_data')) {
        useRawColumn = false;
        continue;
      }

      if (error) {
        console.error('Error fetching Supabase courses:', error);
        return NextResponse.json({ success: false, error: 'Failed to load courses.' }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const formattedCourses = allRows.map(formatCourseRow);

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
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load courses.' }, { status: 500 });
  }
}
