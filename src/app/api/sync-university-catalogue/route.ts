import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { normalizeCountryName } from '@/lib/countries';
import { getCountryVisaIntel, resolveOfficialStayBackYears } from '@/lib/country-visa-intel';
import { classifyUniversityType } from '@/lib/university-classification';
import {
  extractDomainCatalogueCourses,
  resolveUniversityDomainFree,
} from '@/lib/sitemap-course-matcher';

function inferCategoryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/\b(?:data|analytics|statistics|quantitative)\b/.test(t)) return 'Data Science';
  if (/\b(?:nursing|medicine|medical|health|pharmacy|biology|biotech|clinical|psychology|genetics)\b/.test(t)) {
    return 'Healthcare & Life Sciences';
  }
  if (/\b(?:business|management|finance|marketing|economics|accounting|mba|entrepreneurship|banking|commerce|law)\b/.test(t)) {
    return 'Business & Management';
  }
  if (/\b(?:engineering|mechanical|electrical|civil|mechatronics|robotics|chemical|physics|photonics|laser)\b/.test(t)) {
    return 'Engineering';
  }
  return 'Computer Science & AI';
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const universityName = String(body?.universityName || '').trim().slice(0, 160);
    const rawCountry = String(body?.country || '').trim().slice(0, 80);
    const country = normalizeCountryName(rawCountry) || rawCountry;
    const rawDomain = String(body?.domain || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
    const commit = Boolean(body?.commit);
    const limit = Math.min(80, Math.max(5, Number(body?.limit) || 50));

    if (!universityName || !country) {
      return NextResponse.json(
        { success: false, error: 'universityName and country are required' },
        { status: 400 }
      );
    }

    const cleanDomain = rawDomain || (await resolveUniversityDomainFree(universityName, country));
    if (!cleanDomain) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve an official website domain for this university.' },
        { status: 404 }
      );
    }

    const discovered = await extractDomainCatalogueCourses(cleanDomain, limit);
    const sector = classifyUniversityType(universityName, country);
    const intel = getCountryVisaIntel(country);

    const mappedCourses = discovered.map((item) => {
      const category = inferCategoryFromTitle(item.title);
      const isBach = item.degreeLevel === 'Bachelor';
      const defaultTuition =
        sector === 'Public'
          ? /germany|norway|austria/i.test(country)
            ? 1500
            : 4500
          : 8500;
      return {
        university: universityName,
        country,
        program_name: item.title,
        degree_level: item.degreeLevel,
        category,
        duration_months: isBach ? 36 : item.degreeLevel === 'PhD' ? 36 : 24,
        tuition_fees_eur: defaultTuition,
        intake_months: ['September', 'October'],
        course_url: sanitizeHttpUrl(item.url) || `https://www.${cleanDomain}`,
        stay_back_visa_years: resolveOfficialStayBackYears(
          country,
          item.degreeLevel,
          item.title,
          undefined,
          category
        ),
        average_graduate_salary: intel.avgSalaryEur,
        min_12th_percent: 60,
        min_degree_percent: 60,
        min_ielts: 6.0,
      };
    });

    if (!commit) {
      return NextResponse.json({
        success: true,
        domain: cleanDomain,
        discoveredCount: mappedCourses.length,
        courses: mappedCourses,
      });
    }

    const supabase = createServerSupabaseClient();
    const { data: existingUnis } = await supabase
      .from('universities')
      .select('id, name, country')
      .ilike('name', universityName)
      .limit(5);

    let uniId = existingUnis?.[0]?.id as string | undefined;
    if (!uniId) {
      const { data: insertedUni, error: uniErr } = await supabase
        .from('universities')
        .insert({
          name: universityName,
          country,
          global_ranking: 200,
          campus_locations: [country],
        })
        .select('id')
        .single();
      if (uniErr || !insertedUni) {
        return NextResponse.json(
          { success: false, error: `University upsert failed: ${uniErr?.message}` },
          { status: 500 }
        );
      }
      uniId = insertedUni.id;
    }

    const { data: existingCourses } = await supabase
      .from('courses')
      .select('program_name')
      .eq('university_id', uniId)
      .limit(2000);

    const existingNames = new Set(
      (existingCourses || []).map((c: any) => String(c.program_name || '').trim().toLowerCase())
    );

    const rowsToInsert = mappedCourses
      .filter((c) => !existingNames.has(c.program_name.toLowerCase()))
      .map((c) => ({
        university_id: uniId,
        program_name: c.program_name,
        degree_level: c.degree_level,
        category: c.category,
        duration_months: c.duration_months,
        tuition_fees_eur: c.tuition_fees_eur,
        intake_months: c.intake_months,
        course_url: c.course_url,
        stay_back_visa_years: c.stay_back_visa_years,
        average_graduate_salary: c.average_graduate_salary,
      }));

    let insertedCount = 0;
    if (rowsToInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('courses')
        .insert(rowsToInsert)
        .select('id');
      if (insErr) {
        return NextResponse.json(
          { success: false, error: `Course insert failed: ${insErr.message}` },
          { status: 500 }
        );
      }
      insertedCount = inserted?.length || 0;
      if (inserted && inserted.length > 0) {
        await supabase.from('eligibility_rules').insert(
          inserted.map((c: { id: string }) => ({
            course_id: c.id,
            min_12th_percent: 60,
            min_degree_percent: 60,
            min_ielts: 6.0,
            min_toefl: 85,
            interview_required: false,
            work_experience_months: 0,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      domain: cleanDomain,
      discoveredCount: mappedCourses.length,
      insertedCount,
      courses: mappedCourses,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Catalogue sync failed' },
      { status: 500 }
    );
  }
}
