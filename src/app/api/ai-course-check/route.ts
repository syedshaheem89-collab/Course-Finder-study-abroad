import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { isValidUuid, sanitizeHttpUrl } from '@/lib/security/validation';
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
    } = body as {
      courseId?: string;
      programName: string;
      universityName: string;
      country: string;
      degreeLevel?: string;
      courseUrl?: string;
      saveToDb?: boolean;
      forceRefresh?: boolean;
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

    const { snapshot, fromCache } = await verifyCourseLive({
      courseId,
      programName,
      universityName,
      country,
      degreeLevel,
      courseUrl,
      forceRefresh: Boolean(forceRefresh),
    });

    // Persist verified data back to Supabase courses/eligibility_rules ONLY for authenticated admins
    if (saveToDb && courseId && isValidUuid(courseId)) {
      const adminAuth = await requireAdminSession(req);
      if (adminAuth.ok) {
        try {
          const supabase = createServerSupabaseClient();
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
          console.error('Non-fatal DB update error during live verification:', dbErr);
        }
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
