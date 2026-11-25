import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { expandSearchTerms } from '@/lib/search-synonyms';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/security/validation';
import { getSiteSettingsServer } from '@/lib/site-settings-server';
import { resolveOfficialStayBackYears } from '@/lib/country-visa-intel';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  getSubjectKeywords,
  PriorityUniversityRule,
  UniversitySector,
} from '@/lib/university-classification';

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

const INNER_UNI_SELECT = `
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
  university:universities!inner (
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

function getCountrySearchVariants(country: string): string[] {
  const lower = country.trim().toLowerCase();
  if (lower === 'united kingdom' || lower === 'uk') return ['United Kingdom', 'UK'];
  if (lower === 'usa' || lower === 'united states') return ['USA', 'United States', 'US'];
  if (lower === 'united arab emirates' || lower === 'uae') return ['United Arab Emirates', 'UAE'];
  return [country.trim()];
}

function formatCourseRow(
  c: any,
  priorityRules: PriorityUniversityRule[] = [],
  uniMetaMap?: Map<
    string,
    {
      sector: UniversitySector;
      priority: ReturnType<typeof getPriorityUniversityMatch>;
    }
  >
) {
  const cached = c.university_id && uniMetaMap ? uniMetaMap.get(c.university_id) : undefined;
  const uniName = c.university?.name || '';
  const uniCountry = c.university?.country || '';

  const priority =
    cached?.priority || getPriorityUniversityMatch(uniName, uniCountry, priorityRules);
  const sector =
    cached?.sector ||
    classifyUniversityType(uniName, uniCountry, c.raw_excel_data, priorityRules);

  return {
    ...c,
    stay_back_visa_years: resolveOfficialStayBackYears(
      uniCountry,
      c.degree_level,
      c.program_name,
      c.stay_back_visa_years,
      c.category
    ),
    institution_type: sector,
    is_priority_university: priority.isPriority,
    priority_rank: priority.isPriority ? priority.rank : null,
    priority_note: priority.rule?.note || null,
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

    // 2. Single course detail fetch (includes raw_excel_data + sector/priority metadata)
    if (courseId) {
      if (!isValidUuid(courseId)) {
        return NextResponse.json({ success: false, error: 'Invalid course identifier' }, { status: 400 });
      }
      const [{ priorityUniversities }, courseResult] = await Promise.all([
        getSiteSettingsServer(),
        (supabase.from('courses') as any)
          .select(`raw_excel_data, ${BASE_SELECT}`)
          .eq('id', courseId)
          .single(),
      ]);

      let { data, error }: { data: any; error: any } = courseResult;

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
        course: formatCourseRow(data, priorityUniversities),
      });
    }

    // 3. Server-side paginated & filtered search (zero-lag, Public/Private & Priority aware)
    if (isPaginated) {
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 120)));
      const q = (searchParams.get('q') || '').trim();
      const country = (searchParams.get('country') || '').trim();
      const university = (searchParams.get('university') || '').trim();
      const subject = (searchParams.get('subject') || '').trim();
      const intake = (searchParams.get('intake') || '').trim();
      const rawSector = (searchParams.get('sector') || 'all').trim();
      const sectorFilter: 'all' | 'Public' | 'Private' =
        rawSector.toLowerCase() === 'public'
          ? 'Public'
          : rawSector.toLowerCase() === 'private'
          ? 'Private'
          : 'all';
      const maxTuition = Number(searchParams.get('maxTuition') || 100000);
      const idsParam = (searchParams.get('ids') || '').trim();
      const typesParam = (searchParams.get('types') || '').trim();
      const sort = searchParams.get('sort') || 'match';

      const { priorityUniversities } = await getSiteSettingsServer();

      // Classify universities once in scope (fast single query)
      const countryVariants = country ? getCountrySearchVariants(country) : [];
      let uniQuery = (supabase.from('universities') as any)
        .select('id, name, country')
        .limit(2500);
      if (countryVariants.length > 0) {
        const cleanVariants = countryVariants
          .map((v) => sanitizeSearchQuery(v))
          .filter(Boolean);
        if (cleanVariants.length === 0) {
          return NextResponse.json({
            success: true,
            courses: [],
            total: 0,
            page,
            limit,
            hasMore: false,
          });
        }
        uniQuery = uniQuery.or(cleanVariants.map((v) => `country.ilike.${v}`).join(','));
      }

      const { data: scopedUnis } = await uniQuery;
      const uniRows: { id: string; name: string; country: string }[] = Array.isArray(scopedUnis)
        ? scopedUnis
        : [];

      const uniMetaMap = new Map<
        string,
        {
          sector: UniversitySector;
          priority: ReturnType<typeof getPriorityUniversityMatch>;
        }
      >();
      const matchingSectorIds: string[] = [];
      const oppositeSectorIds: string[] = [];
      const priorityUnisRanked: { id: string; rank: number }[] = [];

      for (const u of uniRows) {
        if (!u?.id) continue;
        const sector = classifyUniversityType(u.name, u.country, undefined, priorityUniversities);
        const priority = getPriorityUniversityMatch(u.name, u.country, priorityUniversities);
        uniMetaMap.set(u.id, { sector, priority });

        const matchesSector = sectorFilter === 'all' || sector === sectorFilter;
        if (matchesSector) {
          matchingSectorIds.push(u.id);
          if (priority.isPriority) {
            priorityUnisRanked.push({ id: u.id, rank: priority.rank });
          }
        } else {
          oppositeSectorIds.push(u.id);
        }
      }

      priorityUnisRanked.sort((a, b) => a.rank - b.rank);
      const priorityUniIds = priorityUnisRanked.map((p) => p.id);

      if ((country || sectorFilter !== 'all') && matchingSectorIds.length === 0) {
        return NextResponse.json(
          { success: true, courses: [], total: 0, page, limit, hasMore: false },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }

      if (university && university !== 'all' && !isValidUuid(university)) {
        return NextResponse.json({ success: false, error: 'Invalid university filter' }, { status: 400 });
      }

      // Compute search query university ID matches once
      let qOrClauses: string[] = [];
      if (q) {
        const safeQ = sanitizeSearchQuery(q);
        if (safeQ) {
          const expandedTerms = expandSearchTerms(safeQ);
          const qLower = safeQ.toLowerCase();
          const matchingQUniIds = uniRows
            .filter(
              (u) =>
                u.name?.toLowerCase().includes(qLower) ||
                u.country?.toLowerCase().includes(qLower)
            )
            .slice(0, 40)
            .map((u) => u.id)
            .filter(isValidUuid);

          qOrClauses = expandedTerms.flatMap((term) => {
            const cleanTerm = sanitizeSearchQuery(term);
            return cleanTerm
              ? [`program_name.ilike.%${cleanTerm}%`, `category.ilike.%${cleanTerm}%`]
              : [];
          });

          if (matchingQUniIds.length > 0) {
            qOrClauses.push(`university_id.in.(${matchingQUniIds.join(',')})`);
          }
        }
      }

      const useInnerCountry = countryVariants.length > 0;
      const countryOrClause = useInnerCountry
        ? countryVariants
            .map((v) => sanitizeSearchQuery(v))
            .filter(Boolean)
            .map((v) => `country.ilike.${v}`)
            .join(',')
        : '';

      const applyFilters = (qBuilder: any, skipSectorIdFilter = false) => {
        if (useInnerCountry && countryOrClause) {
          qBuilder = qBuilder.or(countryOrClause, { foreignTable: 'universities' });
        }

        if (!skipSectorIdFilter && sectorFilter !== 'all') {
          if (matchingSectorIds.length <= oppositeSectorIds.length || oppositeSectorIds.length === 0) {
            if (oppositeSectorIds.length > 0 || !useInnerCountry) {
              qBuilder = qBuilder.in('university_id', matchingSectorIds);
            }
          } else {
            qBuilder = qBuilder.not(
              'university_id',
              'in',
              `(${oppositeSectorIds.join(',')})`
            );
          }
        }

        if (typesParam) {
          const typeClauses: string[] = [];
          typesParam
            .split(',')
            .map((t) => t.trim())
            .forEach((t) => {
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
                typeClauses.push(
                  'degree_level.ilike.%pg diploma%',
                  'program_name.ilike.%pg diploma%',
                  'program_name.ilike.%postgraduate diploma%'
                );
              } else if (t === 'Certificate') {
                typeClauses.push('degree_level.ilike.%certificate%', 'program_name.ilike.%certificate%');
              } else if (t === 'PG Certificate') {
                typeClauses.push(
                  'degree_level.ilike.%pg certificate%',
                  'program_name.ilike.%pg certificate%',
                  'program_name.ilike.%postgraduate certificate%'
                );
              }
            });
          if (typeClauses.length > 0) {
            qBuilder = qBuilder.or(typeClauses.join(','));
          }
        }

        if (idsParam) {
          const idList = idsParam.split(',').map((s) => s.trim()).filter(isValidUuid);
          if (idList.length > 0) {
            qBuilder = qBuilder.in('id', idList);
          }
        }

        if (university && university !== 'all') {
          qBuilder = qBuilder.eq('university_id', university);
        }

        if (subject) {
          const cleanSubject = sanitizeSearchQuery(subject);
          if (cleanSubject) {
            const subjectKeywords = getSubjectKeywords(subject)
              .map((kw) => sanitizeSearchQuery(kw))
              .filter(Boolean);
            const subjClauses = [
              `category.ilike.%${cleanSubject}%`,
              ...subjectKeywords.map((kw) => `program_name.ilike.%${kw}%`),
            ];
            qBuilder = qBuilder.or(subjClauses.join(','));
          }
        }

        if (intake && intake !== 'all') {
          qBuilder = qBuilder.contains('intake_months', [intake]);
        }

        if (!Number.isNaN(maxTuition) && maxTuition < 100000) {
          qBuilder = qBuilder.lte('tuition_fees_eur', maxTuition);
        }

        if (qOrClauses.length > 0) {
          qBuilder = qBuilder.or(qOrClauses.join(','));
        }

        return qBuilder;
      };

      if (idsParam) {
        const idList = idsParam.split(',').map((s) => s.trim()).filter(isValidUuid);
        if (idList.length === 0) {
          return NextResponse.json(
            { success: true, courses: [], total: 0, page, limit, hasMore: false },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
          );
        }
      }

      const selectStr = useInnerCountry ? INNER_UNI_SELECT : BASE_SELECT;
      let regularQuery = applyFilters(
        (supabase.from('courses') as any).select(selectStr, { count: 'exact' })
      );

      if (sort === 'tuition_asc') {
        regularQuery = regularQuery.order('tuition_fees_eur', { ascending: true });
      } else if (sort === 'salary_desc') {
        regularQuery = regularQuery.order('average_graduate_salary', { ascending: false });
      } else {
        regularQuery = regularQuery.order('created_at', { ascending: false });
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const shouldFetchPriorityFirst =
        page === 1 &&
        (sort === 'match' || sort === 'newest') &&
        !idsParam &&
        (!university || university === 'all') &&
        priorityUniIds.length > 0;

      const priorityPromise = shouldFetchPriorityFirst
        ? applyFilters(
            (supabase.from('courses') as any).select(selectStr),
            true
          )
            .in('university_id', priorityUniIds.slice(0, 60))
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: null, error: null });

      const [regularRes, priorityRes] = await Promise.all([
        regularQuery.range(from, to),
        priorityPromise,
      ]);

      if (regularRes.error) {
        console.error('Paginated courses query error:', regularRes.error);
        return NextResponse.json({ success: false, error: 'Failed to query courses.' }, { status: 500 });
      }

      let combinedRaw: any[] = Array.isArray(regularRes.data) ? regularRes.data : [];

      if (shouldFetchPriorityFirst && Array.isArray(priorityRes?.data) && priorityRes.data.length > 0) {
        const sortedPriority = [...priorityRes.data].sort((a: any, b: any) => {
          const rankA = uniMetaMap.get(a.university_id)?.priority.rank ?? 9999;
          const rankB = uniMetaMap.get(b.university_id)?.priority.rank ?? 9999;
          return rankA - rankB;
        });

        const seenCourseIds = new Set(sortedPriority.map((c: any) => c.id));
        const nonPriorityRegular = combinedRaw.filter((c: any) => !seenCourseIds.has(c.id));
        combinedRaw = [...sortedPriority, ...nonPriorityRegular];
      }

      const formatted = combinedRaw.map((c) => formatCourseRow(c, priorityUniversities, uniMetaMap));
      const total = regularRes.count ?? formatted.length;

      return NextResponse.json(
        {
          success: true,
          courses: formatted,
          total,
          page,
          limit,
          hasMore: from + (regularRes.data?.length || 0) < total,
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // 4. Legacy / Export list fetch (capped safely to protect serverless memory/4.5MB limit)
    const { priorityUniversities } = await getSiteSettingsServer();
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

    const formattedCourses = allRows.map((c) => formatCourseRow(c, priorityUniversities));

    return NextResponse.json(
      {
        success: true,
        courses: formattedCourses,
        count: formattedCourses.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    if (err?.digest === 'NEXT_PRERENDER_INTERRUPTED') throw err;
    console.error('Courses API error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load courses.' }, { status: 500 });
  }
}
