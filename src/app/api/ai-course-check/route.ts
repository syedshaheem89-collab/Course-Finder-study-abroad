import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { isValidUuid, sanitizeHttpUrl } from '@/lib/security/validation';
import {
  DEFAULT_VERIFY_CACHE_DAYS,
  getCachedCourseVerification,
} from '@/lib/course-verification-cache';
import { verifyCourseLive } from '@/lib/live-course-verifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseId,
      programName: rawProgramName,
      universityName: rawUniversityName,
      country: rawCountry,
      degreeLevel: rawDegreeLevel,
      courseUrl: rawCourseUrl,
      saveToDb = false,
      forceRefresh = false,
      autoTrigger = false,
    } = body as {
      courseId?: string;
      programName: string;
      universityName: string;
      country: string;
      degreeLevel?: string;
      courseUrl?: string;
      saveToDb?: boolean;
      forceRefresh?: boolean;
      autoTrigger?: boolean;
    };

    const programName = String(rawProgramName || '').trim().slice(0, 200);
    const universityName = String(rawUniversityName || '').trim().slice(0, 200);
    const country = String(rawCountry || '').trim().slice(0, 80);
    const degreeLevel = rawDegreeLevel ? String(rawDegreeLevel).trim().slice(0, 60) : undefined;
    const courseUrl = rawCourseUrl ? sanitizeHttpUrl(String(rawCourseUrl)) || undefined : undefined;

    if (!programName || !universityName) {
      return NextResponse.json(
        { success: false, error: 'programName and universityName are required' },
        { status: 400 }
      );
    }

    // Check 180-day verified cache first (0 credits, never rate-limited)
    if (!forceRefresh) {
      const cached = await getCachedCourseVerification(
        country,
        universityName,
        programName,
        DEFAULT_VERIFY_CACHE_DAYS
      );
      if (cached) {
        return NextResponse.json({
          success: true,
          verifiedAt: cached.verifiedAt,
          verifiedSource: cached.consensusStatus,
          fromCache: true,
          data: {
            min12thPercent: cached.min12thPercent ?? 55,
            minDegreePercent: cached.minDegreePercent ?? 55,
            minIelts: cached.minIelts ?? 6.0,
            englishPolicy: cached.englishPolicy || 'IELTS_TOEFL',
            tuitionFeesEur: cached.tuitionFeesEur ?? null,
            originalTuitionAmount: cached.originalTuitionAmount ?? null,
            originalTuitionCurrency: cached.originalTuitionCurrency ?? null,
            tuitionQuote: cached.tuitionQuote || '',
            academicYear: cached.academicYear || '',
            matchedProgramName: cached.matchedProgramName || '',
            feeVerified: Boolean(cached.tuitionFeesEur !== null && cached.tuitionFeesEur !== undefined),
            extractorVersion: cached.extractorVersion || 1,
            verifiedDomain: cached.verifiedDomain || '',
            consensusStatus: cached.consensusStatus,
            providersUsed: cached.providersUsed,
            searchProvider: cached.searchProvider,
            intakes: cached.intakes || [],
            subjectRequirements: cached.subjectRequirements || '',
            officialUrl: cached.officialUrl,
            summary: cached.summary || '',
            sources: cached.sources || [],
          },
        });
      }
    }

    const adminAuth = await requireAdminSession(req);
    const isAdminUser = adminAuth.ok;

    // Protect free monthly API quotas from anonymous spam on uncached live checks
    if (!isAdminUser) {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`ai-course-check:${ip}`, 8, 3600_000);
      if (!rl.allowed) {
        return NextResponse.json(
          {
            success: false,
            rateLimited: true,
            error: 'Hourly live verification limit reached. Try again later or open the university portal directly.',
          },
          { status: 429 }
        );
      }
    }

    const { snapshot, fromCache } = await verifyCourseLive({
      courseId,
      programName,
      universityName,
      country,
      degreeLevel,
      courseUrl,
      forceRefresh: Boolean(forceRefresh && isAdminUser),
      autoTrigger: Boolean(autoTrigger),
    });

    const isPageVerified =
      snapshot.consensusStatus === 'consensus-2ai' ||
      snapshot.consensusStatus === 'judge-resolved' ||
      snapshot.consensusStatus === 'single-page-verified';

    // Permanently self-heal verified URL & grounded tuition in Supabase `courses`
    // so broken 404 URLs and stale fees stay fixed for all future visitors
    if (courseId && isValidUuid(courseId) && isPageVerified) {
      try {
        const supabase = createServerSupabaseClient();
        if (saveToDb && isAdminUser) {
          await supabase.from('eligibility_rules').upsert(
            {
              course_id: courseId,
              min_12th_percent: snapshot.min12thPercent ?? 55,
              min_degree_percent: snapshot.minDegreePercent ?? 55,
              min_ielts: snapshot.minIelts ?? 6.0,
              english_requirement_type: snapshot.englishPolicy || 'IELTS_TOEFL',
            },
            { onConflict: 'course_id' }
          );
        }

        const { data: existingCourse } = await supabase
          .from('courses')
          .select('raw_excel_data')
          .eq('id', courseId)
          .single();

        const coursePatch: Record<string, any> = {
          raw_excel_data: {
            ...(existingCourse?.raw_excel_data && typeof existingCourse.raw_excel_data === 'object'
              ? existingCourse.raw_excel_data
              : {}),
            'Last Live Verified': snapshot.verifiedAt,
            'Verification Consensus': snapshot.consensusStatus,
            ...(snapshot.verifiedDomain ? { 'Verified Source': snapshot.verifiedDomain } : {}),
            ...(snapshot.tuitionQuote ? { 'Verified Fee Quote': snapshot.tuitionQuote } : {}),
            ...(snapshot.matchedProgramName ? { 'Matched Official Title': snapshot.matchedProgramName } : {}),
          },
        };

        if (snapshot.tuitionFeesEur !== null && snapshot.tuitionFeesEur !== undefined) {
          coursePatch.tuition_fees_eur = Math.round(Number(snapshot.tuitionFeesEur));
        }
        if (Array.isArray(snapshot.intakes) && snapshot.intakes.length > 0) {
          coursePatch.intake_months = snapshot.intakes;
        }
        if (snapshot.officialUrl) {
          coursePatch.course_url = snapshot.officialUrl;
        }
        await supabase.from('courses').update(coursePatch).eq('id', courseId);
      } catch (dbErr) {
        console.error('Non-fatal DB self-heal error:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      verifiedAt: snapshot.verifiedAt,
      verifiedSource: snapshot.consensusStatus,
      fromCache,
      data: {
        min12thPercent: snapshot.min12thPercent ?? 55,
        minDegreePercent: snapshot.minDegreePercent ?? 55,
        minIelts: snapshot.minIelts ?? 6.0,
        englishPolicy: snapshot.englishPolicy || 'IELTS_TOEFL',
        tuitionFeesEur: snapshot.tuitionFeesEur ?? null,
        originalTuitionAmount: snapshot.originalTuitionAmount ?? null,
        originalTuitionCurrency: snapshot.originalTuitionCurrency ?? null,
        tuitionQuote: snapshot.tuitionQuote || '',
        academicYear: snapshot.academicYear || '',
        matchedProgramName: snapshot.matchedProgramName || '',
        feeVerified: Boolean(snapshot.tuitionFeesEur !== null && snapshot.tuitionFeesEur !== undefined),
        extractorVersion: snapshot.extractorVersion || 3,
        verifiedDomain: snapshot.verifiedDomain || '',
        consensusStatus: snapshot.consensusStatus,
        providersUsed: snapshot.providersUsed,
        searchProvider: snapshot.searchProvider,
        intakes: snapshot.intakes || [],
        subjectRequirements: snapshot.subjectRequirements || '',
        officialUrl: snapshot.officialUrl,
        summary: snapshot.summary || '',
        sources: snapshot.sources || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
