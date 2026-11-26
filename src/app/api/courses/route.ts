import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { expandSearchTerms } from '@/lib/search-synonyms';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/security/validation';
import { getSiteSettingsServer } from '@/lib/site-settings-server';
import { getLivePolicyStore } from '@/lib/live-policy-store';
import { LiveCountryPolicyOverride, resolveStayBackWithOverride } from '@/lib/live-policy-types';
import {
  getCourseVerificationCache,
  makeCourseVerifyKey,
  VerifiedCourseSnapshot,
} from '@/lib/course-verification-cache';
import { getCachedUniversities } from '@/lib/universities-cache';
import { searchCuratedCatalogue } from '@/lib/country-curated-fallback';
import { normalizeCountryName } from '@/lib/countries';
import {
  diversifyGlobalCourses,
  extractExplicitCountryFromQuery,
  isExplicitUniversityQuery,
} from '@/lib/course-diversity';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  getSubjectKeywords,
  PriorityUniversityRule,
  UniversitySector,
} from '@/lib/university-classification';

function isCuratedUniId(val: string): boolean {
  return /^cat-uni-[a-z0-9-]+$/i.test(val.trim());
}

function isCuratedCourseId(val: string): boolean {
  return /^cat-[a-z0-9-]+$/i.test(val.trim());
}

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

function applyVerifiedOverlay(
  course: any,
  verifiedCache?: Record<string, VerifiedCourseSnapshot>
) {
  if (!verifiedCache || !course) return course;
  const key = makeCourseVerifyKey(
    course.university?.country,
    course.university?.name,
    course.program_name
  );
  const snap = verifiedCache[key];
  if (!snap) return course;
  return {
    ...course,
    course_url: snap.officialUrl || course.course_url,
    tuition_fees_eur:
      snap.tuitionFeesEur !== null && snap.tuitionFeesEur !== undefined
        ? snap.tuitionFeesEur
        : course.tuition_fees_eur,
    verified_meta: {
      verifiedAt: snap.verifiedAt,
      consensusStatus: snap.consensusStatus,
      providersUsed: snap.providersUsed,
      verifiedDomain: snap.verifiedDomain,
      originalTuitionAmount: snap.originalTuitionAmount,
      originalTuitionCurrency: snap.originalTuitionCurrency,
      tuitionQuote: snap.tuitionQuote,
      academicYear: snap.academicYear,
    },
  };
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
  >,
  liveOverrides?: Record<string, LiveCountryPolicyOverride>,
  verifiedCache?: Record<string, VerifiedCourseSnapshot>
) {
  const cached = c.university_id && uniMetaMap ? uniMetaMap.get(c.university_id) : undefined;
  const uniName = c.university?.name || '';
  const uniCountry = c.university?.country || '';

  const priority =
    cached?.priority || getPriorityUniversityMatch(uniName, uniCountry, priorityRules);
  const sector =
    cached?.sector ||
    classifyUniversityType(uniName, uniCountry, c.raw_excel_data, priorityRules);

  return applyVerifiedOverlay(
    {
      ...c,
      stay_back_visa_years: resolveStayBackWithOverride(
        uniCountry,
        c.degree_level,
        c.program_name,
        c.stay_back_visa_years,
        c.category,
        liveOverrides
      ),
      institution_type: sector,
      is_priority_university: priority.isPriority,
      priority_rank: priority.isPriority ? priority.rank : null,
      priority_note: priority.rule?.note || null,
      eligibility_rules: Array.isArray(c.eligibility_rules)
        ? c.eligibility_rules[0]
        : c.eligibility_rules,
    },
    verifiedCache
  );
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
      const [{ priorityUniversities }, liveStore, verifiedCache] = await Promise.all([
        getSiteSettingsServer(),
        getLivePolicyStore(),
        getCourseVerificationCache(),
      ]);
      if (isCuratedCourseId(courseId)) {
        const found = searchCuratedCatalogue({
          ids: [courseId],
          priorityUniversities,
          liveOverrides: liveStore.countryOverrides,
        });
        if (found.length === 0) {
          return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          course: applyVerifiedOverlay(found[0], verifiedCache),
        });
      }
      if (!isValidUuid(courseId)) {
        return NextResponse.json({ success: false, error: 'Invalid course identifier' }, { status: 400 });
      }
      const courseResult = await (supabase.from('courses') as any)
        .select(`raw_excel_data, ${BASE_SELECT}`)
        .eq('id', courseId)
        .single();

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
        course: formatCourseRow(data, priorityUniversities, undefined, liveStore.countryOverrides, verifiedCache),
      });
    }

    // 3. Server-side paginated & filtered search (zero-lag, Public/Private, Priority & Global Catalogue aware)
    if (isPaginated) {
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 120)));
      const includeCatalogue = searchParams.get('include_catalogue') === 'true';
      const q = (searchParams.get('q') || '').trim();
      const rawCountry = (searchParams.get('country') || '').trim();
      const country = rawCountry ? normalizeCountryName(rawCountry) || rawCountry : '';
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
      const parsedTypes = typesParam
        ? typesParam.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      const sort = searchParams.get('sort') || 'match';

      const [{ priorityUniversities }, liveStore, verifiedCache, allUnis] = await Promise.all([
        getSiteSettingsServer(),
        getLivePolicyStore(),
        getCourseVerificationCache(),
        getCachedUniversities(!includeCatalogue),
      ]);
      const liveOverrides = liveStore.countryOverrides;

      const countryVariants = country ? getCountrySearchVariants(country) : [];
      const variantSet = new Set(countryVariants.map((v) => v.toLowerCase()));
      const uniRows =
        countryVariants.length > 0
          ? allUnis.filter((u) => u.country && variantSet.has(u.country.trim().toLowerCase()))
          : allUnis;

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

      if (
        university &&
        university !== 'all' &&
        !isValidUuid(university) &&
        !(includeCatalogue && isCuratedUniId(university))
      ) {
        return NextResponse.json({ success: false, error: 'Invalid university filter' }, { status: 400 });
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const explicitQueryCountry = q ? extractExplicitCountryFromQuery(q) : null;
      const isGlobalDiscoveryCandidate =
        includeCatalogue &&
        !country &&
        (!university || university === 'all') &&
        !idsParam &&
        !explicitQueryCountry;

      const makeCatalogueResponse = (
        items: any[],
        extraMeta?: { diversified?: boolean; countryCount?: number }
      ) => {
        const paged = items.slice(from, to + 1).map((it) => applyVerifiedOverlay(it, verifiedCache));
        return NextResponse.json(
          {
            success: true,
            courses: paged,
            total: items.length,
            page,
            limit,
            hasMore: from + paged.length < items.length,
            diversified: Boolean(extraMeta?.diversified),
            ...(extraMeta?.countryCount !== undefined
              ? { countryCount: extraMeta.countryCount }
              : {}),
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      };

      // Fast path: curated university filter
      if (includeCatalogue && university && isCuratedUniId(university)) {
        return makeCatalogueResponse(
          searchCuratedCatalogue({
            country,
            q,
            subject,
            types: parsedTypes,
            sector: sectorFilter,
            intake,
            maxTuition,
            universityId: university,
            sort,
            priorityUniversities,
            liveOverrides,
          })
        );
      }

      // Parse shortlist IDs (supports both Supabase UUIDs and curated catalogue IDs)
      const rawIds = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const uuidIds = rawIds.filter(isValidUuid);
      const catIds = includeCatalogue ? rawIds.filter(isCuratedCourseId) : [];

      if (idsParam && uuidIds.length === 0 && catIds.length === 0) {
        return NextResponse.json(
          { success: true, courses: [], total: 0, page, limit, hasMore: false },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }

      const catMatchedById =
        catIds.length > 0
          ? searchCuratedCatalogue({
              ids: catIds,
              country,
              q,
              subject,
              types: parsedTypes,
              sector: sectorFilter,
              intake,
              maxTuition,
              sort,
              priorityUniversities,
              liveOverrides,
            })
          : [];

      if (idsParam && uuidIds.length === 0) {
        return makeCatalogueResponse(catMatchedById);
      }

      if ((country || sectorFilter !== 'all') && matchingSectorIds.length === 0) {
        if (includeCatalogue && (!university || university === 'all') && !idsParam) {
          const catItems = searchCuratedCatalogue({
            country,
            q,
            subject,
            types: parsedTypes,
            sector: sectorFilter,
            intake,
            maxTuition,
            sort,
            priorityUniversities,
            liveOverrides,
          });
          if (isGlobalDiscoveryCandidate && !(q && isExplicitUniversityQuery(q, catItems))) {
            const { items: diversified, countryCount } = diversifyGlobalCourses(catItems, {
              maxPerUniversity: 1,
              maxPerCountry: 2,
              sort,
              q,
              subject,
            });
            return makeCatalogueResponse(diversified, { diversified: true, countryCount });
          }
          return makeCatalogueResponse(catItems, { diversified: false });
        }
        return NextResponse.json(
          { success: true, courses: [], total: 0, page, limit, hasMore: false, diversified: false },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }

      // Compute search query OR groups (single-word OR phrase vs multi-word AND-of-ORs)
      const qOrGroups: string[] = [];
      if (q) {
        const safeQ = sanitizeSearchQuery(q);
        if (safeQ) {
          const words = safeQ.toLowerCase().split(/\s+/).filter(Boolean);
          if (words.length <= 1) {
            const expandedTerms = expandSearchTerms(safeQ);
            const qLower = safeQ.toLowerCase();
            const matchingQUniIds = uniRows
              .filter(
                (u) =>
                  u.name?.toLowerCase().includes(qLower) ||
                  u.country?.toLowerCase().includes(qLower)
              )
              .slice(0, 60)
              .map((u) => u.id)
              .filter(isValidUuid);

            const clauses = expandedTerms.flatMap((term) => {
              const cleanTerm = sanitizeSearchQuery(term);
              return cleanTerm
                ? [
                    `program_name.ilike.%${cleanTerm}%`,
                    `category.ilike.%${cleanTerm}%`,
                    `degree_level.ilike.%${cleanTerm}%`,
                  ]
                : [];
            });

            if (matchingQUniIds.length > 0) {
              clauses.push(`university_id.in.(${matchingQUniIds.join(',')})`);
            }
            if (clauses.length > 0) qOrGroups.push(clauses.join(','));
          } else {
            const meaningfulWords = words.filter((w) => w.length >= 2).slice(0, 3);
            for (const w of meaningfulWords) {
              const wordTerms = expandSearchTerms(w)
                .map((t) => sanitizeSearchQuery(t))
                .filter(Boolean);
              const clauses = wordTerms.flatMap((t) => [
                `program_name.ilike.%${t}%`,
                `category.ilike.%${t}%`,
                `degree_level.ilike.%${t}%`,
              ]);
              const matchingWordUnis = uniRows
                .filter((u) => {
                  const uName = u.name?.toLowerCase() || '';
                  const uCountry = u.country?.toLowerCase() || '';
                  return wordTerms.some((t) => uName.includes(t) || uCountry.includes(t));
                })
                .slice(0, 60)
                .map((u) => u.id)
                .filter(isValidUuid);
              if (matchingWordUnis.length > 0) {
                clauses.push(`university_id.in.(${matchingWordUnis.join(',')})`);
              }
              if (clauses.length > 0) qOrGroups.push(clauses.join(','));
            }
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

        if (parsedTypes.length > 0) {
          const parsedTypeSet = new Set(parsedTypes);
          const typeClauses: string[] = [];
          parsedTypes.forEach((t) => {
            if (t === 'Masters') {
              typeClauses.push(
                'degree_level.ilike.%master%',
                'degree_level.ilike.%postgraduate%',
                'degree_level.ilike.%mba%',
                'program_name.ilike.%master%',
                'program_name.ilike.%msc%',
                'program_name.ilike.%m.sc%',
                'program_name.ilike.%mba%'
              );
            } else if (t === 'Undergraduate') {
              typeClauses.push(
                'degree_level.ilike.%bachelor%',
                'degree_level.ilike.%undergraduate%',
                'degree_level.ilike.%b.sc%',
                'degree_level.ilike.%bsc%',
                'program_name.ilike.%bachelor%',
                'program_name.ilike.%b.sc%',
                'program_name.ilike.%bsc%',
                'program_name.ilike.%bba%'
              );
            } else if (t === 'UG Diploma') {
              typeClauses.push(
                'degree_level.ilike.%ug diploma%',
                'program_name.ilike.%ug diploma%',
                'program_name.ilike.%undergraduate diploma%'
              );
            } else if (t === 'PG Diploma') {
              typeClauses.push(
                'degree_level.ilike.%pg diploma%',
                'program_name.ilike.%pg diploma%',
                'program_name.ilike.%postgraduate diploma%',
                'program_name.ilike.%post graduate diploma%'
              );
            } else if (t === 'Certificate') {
              typeClauses.push('degree_level.ilike.%certificate%', 'program_name.ilike.%certificate%');
            } else if (t === 'PG Certificate') {
              typeClauses.push(
                'degree_level.ilike.%pg certificate%',
                'program_name.ilike.%pg certificate%',
                'program_name.ilike.%postgraduate certificate%',
                'program_name.ilike.%post graduate certificate%'
              );
            }
          });
          if (typeClauses.length > 0) {
            qBuilder = qBuilder.or(typeClauses.join(','));
          }
          if (!parsedTypeSet.has('Certificate') && !parsedTypeSet.has('PG Certificate')) {
            qBuilder = qBuilder.or('degree_level.is.null,degree_level.not.ilike.%certificate%');
          }
          if (!parsedTypeSet.has('UG Diploma') && !parsedTypeSet.has('PG Diploma')) {
            qBuilder = qBuilder.or('degree_level.is.null,degree_level.not.ilike.%diploma%');
          }
        }

        if (uuidIds.length > 0) {
          qBuilder = qBuilder.in('id', uuidIds);
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
          qBuilder = qBuilder.overlaps('intake_months', [intake, `${intake} (tentative)`]);
        }

        if (!Number.isNaN(maxTuition) && maxTuition < 100000) {
          qBuilder = qBuilder.lte('tuition_fees_eur', maxTuition);
        }

        for (const groupClause of qOrGroups) {
          qBuilder = qBuilder.or(groupClause);
        }

        return qBuilder;
      };

      const selectStr = useInnerCountry ? INNER_UNI_SELECT : BASE_SELECT;
      let regularQuery = applyFilters(
        (supabase.from('courses') as any).select(selectStr, { count: 'exact' })
      );

      if (sort === 'tuition_asc') {
        regularQuery = regularQuery
          .order('tuition_fees_eur', { ascending: true })
          .order('id', { ascending: true });
      } else if (sort === 'salary_desc') {
        regularQuery = regularQuery
          .order('average_graduate_salary', { ascending: false })
          .order('id', { ascending: true });
      } else {
        regularQuery = regularQuery
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });
      }

      const shouldFetchPriorityFirst =
        (page === 1 || isGlobalDiscoveryCandidate) &&
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
            .order('id', { ascending: true })
            .limit(60)
        : Promise.resolve({ data: null, error: null });

      const queryFrom = isGlobalDiscoveryCandidate ? 0 : from;
      const queryTo = isGlobalDiscoveryCandidate ? Math.max(199, to) : to;

      const [regularRes, priorityRes] = await Promise.all([
        regularQuery.range(queryFrom, queryTo),
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

      let formatted = combinedRaw.map((c) =>
        formatCourseRow(c, priorityUniversities, uniMetaMap, liveOverrides, verifiedCache)
      );
      let total = regularRes.count ?? formatted.length;
      let hasMore = from + (regularRes.data?.length || 0) < total;

      if (isGlobalDiscoveryCandidate) {
        const globalCurated = searchCuratedCatalogue({
          country: '',
          q,
          subject,
          types: parsedTypes,
          sector: sectorFilter,
          intake,
          maxTuition,
          sort,
          priorityUniversities,
          liveOverrides,
        });

        const seenKeys = new Set(
          formatted.map(
            (c: any) => `${(c.university?.name || '').toLowerCase()}::${(c.program_name || '').toLowerCase()}`
          )
        );
        const uniqueCurated = globalCurated.filter((c) => {
          const k = `${(c.university?.name || '').toLowerCase()}::${(c.program_name || '').toLowerCase()}`;
          if (seenKeys.has(k)) return false;
          seenKeys.add(k);
          return true;
        });
        const mergedCandidates = [...formatted, ...uniqueCurated];
        const isUniPreference = q ? isExplicitUniversityQuery(q, mergedCandidates) : false;

        if (!isUniPreference) {
          const { items: diversified, countryCount } = diversifyGlobalCourses(mergedCandidates, {
            maxPerUniversity: 1,
            maxPerCountry: 2,
            sort,
            q,
            subject,
          });
          return makeCatalogueResponse(diversified, { diversified: true, countryCount });
        }

        const uncapped = total < 6 ? mergedCandidates : formatted;
        const pagedUncapped = uncapped.slice(from, to + 1);
        const uncappedTotal = total < 6 ? mergedCandidates.length : total;
        return NextResponse.json(
          {
            success: true,
            courses: pagedUncapped,
            total: uncappedTotal,
            page,
            limit,
            hasMore: from + pagedUncapped.length < uncappedTotal,
            diversified: false,
          },
          {
            headers: {
              'Cache-Control': 'no-store, max-age=0',
            },
          }
        );
      }

      // Merge any curated shortlist rows when mixed IDs were queried
      if (idsParam && catMatchedById.length > 0 && page === 1) {
        const seenIds = new Set(formatted.map((c: any) => c.id));
        const extra = catMatchedById.filter((c) => !seenIds.has(c.id));
        if (extra.length > 0) {
          formatted = [...formatted, ...extra];
          total += extra.length;
        }
      } else if (
        includeCatalogue &&
        page === 1 &&
        (!university || university === 'all') &&
        !idsParam &&
        total < 6 &&
        (country || q || subject)
      ) {
        const curatedSupplement = searchCuratedCatalogue({
          country,
          q,
          subject,
          types: parsedTypes,
          sector: sectorFilter,
          intake,
          maxTuition,
          sort,
          priorityUniversities,
          liveOverrides,
        });
        if (curatedSupplement.length > 0) {
          const seenKeys = new Set(
            formatted.map(
              (c: any) => `${(c.university?.name || '').toLowerCase()}::${(c.program_name || '').toLowerCase()}`
            )
          );
          const uniqueCurated = curatedSupplement.filter((c) => {
            const k = `${(c.university?.name || '').toLowerCase()}::${(c.program_name || '').toLowerCase()}`;
            if (seenKeys.has(k)) return false;
            seenKeys.add(k);
            return true;
          });
          if (uniqueCurated.length > 0) {
            formatted = [
              ...formatted,
              ...uniqueCurated.map((it) => applyVerifiedOverlay(it, verifiedCache)),
            ];
            total = formatted.length;
            hasMore = false;
          }
        }
      }

      return NextResponse.json(
        {
          success: true,
          courses: formatted,
          total,
          page,
          limit,
          hasMore,
          diversified: false,
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // 4. Legacy / Export list fetch (capped safely to protect serverless memory/4.5MB limit)
    const [{ priorityUniversities }, legacyLiveStore, legacyVerifiedCache] = await Promise.all([
      getSiteSettingsServer(),
      getLivePolicyStore(),
      getCourseVerificationCache(),
    ]);
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

    const formattedCourses = allRows.map((c) =>
      formatCourseRow(c, priorityUniversities, undefined, legacyLiveStore.countryOverrides, legacyVerifiedCache)
    );

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
