import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { isValidUuid, sanitizeHttpUrl } from '@/lib/security/validation';
import { isGenericUniversityUrl, resolveCourseUrl } from '@/lib/student-guides';
import {
  DEFAULT_VERIFY_CACHE_DAYS,
  getCachedCourseVerification,
  makeCourseVerifyKey,
  saveCourseVerificationSnapshot,
} from '@/lib/course-verification-cache';
import { extractDomainHost } from '@/lib/live-course-verifier';
import { findCourseUrlInSitemap } from '@/lib/sitemap-course-matcher';

async function checkDirectHttp(url: string): Promise<{ ok: boolean; status: number; finalUrl: string }> {
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Orbis/2026' },
    });
    if (res.status === 405) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Orbis/2026' },
      });
    }
    const finalUrl = sanitizeHttpUrl(res.url || url) || url;
    const ok = res.status < 400 || res.status === 403;
    return { ok, status: res.status, finalUrl };
  } catch {
    return { ok: false, status: 0, finalUrl: url };
  }
}

async function persistRepairedUrl(
  courseId: string | undefined,
  repairedUrl: string,
  country: string,
  universityName: string,
  programName: string,
  domainHost: string
) {
  await saveCourseVerificationSnapshot({
    courseKey: makeCourseVerifyKey(country, universityName, programName),
    courseId,
    officialUrl: repairedUrl,
    verifiedDomain: domainHost || extractDomainHost(repairedUrl) || undefined,
    tuitionFeesEur: null,
    consensusStatus: 'single-page-verified',
    providersUsed: ['sitemap'],
    searchProvider: 'fallback',
    verifiedAt: new Date().toISOString(),
    sources: [{ title: programName, uri: repairedUrl }],
  }).catch(() => {});

  if (courseId && isValidUuid(courseId)) {
    try {
      const supabase = createServerSupabaseClient();
      await supabase.from('courses').update({ course_url: repairedUrl }).eq('id', courseId);
    } catch {
      // Non-fatal
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const courseId = body.courseId ? String(body.courseId).trim() : undefined;
    const rawCourseUrl = body.courseUrl ? String(body.courseUrl).trim() : '';
    const programName = String(body.programName || '').trim().slice(0, 200);
    const universityName = String(body.universityName || '').trim().slice(0, 200);
    const country = String(body.country || '').trim().slice(0, 80);
    const degreeLevel = body.degreeLevel ? String(body.degreeLevel).trim().slice(0, 60) : undefined;

    if (!programName) {
      return NextResponse.json({ success: false, error: 'programName is required' }, { status: 400 });
    }

    // 1. Check 180-day verification cache first (0 tokens)
    const cached = await getCachedCourseVerification(
      country,
      universityName,
      programName,
      DEFAULT_VERIFY_CACHE_DAYS
    );
    if (cached?.officialUrl && !isGenericUniversityUrl(cached.officialUrl).isGeneric) {
      return NextResponse.json({
        success: true,
        status: 'verified',
        safeUrl: cached.officialUrl,
        isDirect: true,
        repaired: false,
        wasBroken404: false,
      });
    }

    const domainHost = extractDomainHost(rawCourseUrl);
    const safeCourseUrl = sanitizeHttpUrl(rawCourseUrl);
    const genericCheck = isGenericUniversityUrl(safeCourseUrl || '');

    // 2. If stored URL claims to be a direct course URL, check HTTP status (0 tokens)
    if (safeCourseUrl && !genericCheck.isGeneric) {
      const probe = await checkDirectHttp(safeCourseUrl);
      if (probe.ok && !isGenericUniversityUrl(probe.finalUrl).isGeneric) {
        return NextResponse.json({
          success: true,
          status: 'ok',
          safeUrl: probe.finalUrl,
          isDirect: true,
          repaired: false,
          wasBroken404: false,
        });
      }

      // Caught a dead 404 / broken redirect! Try free sitemap repair on the university domain
      if (domainHost) {
        const repairedUrl = await findCourseUrlInSitemap(domainHost, programName, degreeLevel);
        if (repairedUrl) {
          await persistRepairedUrl(courseId, repairedUrl, country, universityName, programName, domainHost);
          return NextResponse.json({
            success: true,
            status: 'repaired-sitemap',
            safeUrl: repairedUrl,
            isDirect: true,
            repaired: true,
            wasBroken404: true,
          });
        }
      }

      // Safe fallback so student NEVER hits a 404 page
      const fallbackInfo = resolveCourseUrl({
        program_name: programName,
        course_url: domainHost ? `https://${domainHost}` : '',
        university: { name: universityName, country },
      });
      return NextResponse.json({
        success: true,
        status: 'broken-fallback',
        safeUrl: fallbackInfo.url,
        universityUrl: fallbackInfo.universityUrl,
        isDirect: false,
        repaired: true,
        wasBroken404: true,
      });
    }

    // 3. Generic or missing URL: try free sitemap lookup first if university domain is known
    if (domainHost) {
      const repairedUrl = await findCourseUrlInSitemap(domainHost, programName, degreeLevel);
      if (repairedUrl) {
        await persistRepairedUrl(courseId, repairedUrl, country, universityName, programName, domainHost);
        return NextResponse.json({
          success: true,
          status: 'repaired-sitemap',
          safeUrl: repairedUrl,
          isDirect: true,
          repaired: true,
          wasBroken404: false,
        });
      }
    }

    const fallbackInfo = resolveCourseUrl({
      program_name: programName,
      course_url: rawCourseUrl,
      university: { name: universityName, country },
    });
    return NextResponse.json({
      success: true,
      status: fallbackInfo.linkType,
      safeUrl: fallbackInfo.url,
      universityUrl: fallbackInfo.universityUrl,
      isDirect: fallbackInfo.isDirect,
      repaired: false,
      wasBroken404: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Link check failed' },
      { status: 500 }
    );
  }
}
