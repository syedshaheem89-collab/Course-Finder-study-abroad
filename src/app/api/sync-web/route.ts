import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source = 'daad', limit = 100, offset = 0 } = body;

    if (source !== 'daad') {
      return NextResponse.json({
        success: true,
        source,
        inserted_count: 0,
        has_more: false,
        message: `${source.toUpperCase()} sync worker pinged. Live JSON feed currently configured for DAAD Germany.`,
      });
    }

    // Fetch a batch of English-taught Bachelor & Master programmes from DAAD Germany API
    const daadUrl = `https://www2.daad.de/deutschland/studienangebote/international-programmes/api/solr/en/search.json?degree%5B%5D=1&degree%5B%5D=2&lang%5B%5D=2&limit=${limit}&offset=${offset}&display=list`;

    const res = await fetch(daadUrl, {
      headers: {
        'User-Agent': 'GlobalCourseAI/2026',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `DAAD API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const daadCourses: any[] = json.courses || [];
    const totalAvailable: number = json.numResults || daadCourses.length;

    if (daadCourses.length === 0) {
      return NextResponse.json({
        success: true,
        source: 'daad',
        fetched_count: 0,
        inserted_count: 0,
        total_available: totalAvailable,
        next_offset: offset,
        has_more: false,
        message: 'Reached end of DAAD Germany catalogue.',
      });
    }

    const supabase = createServerSupabaseClient();

    // 1. Pre-load existing universities in 1 query
    const { data: existingUnis } = await supabase.from('universities').select('id, name');
    const uniMap = new Map<string, string>();
    (existingUnis || []).forEach((u: any) => uniMap.set(u.name.trim().toLowerCase(), u.id));

    // Find missing universities in this batch and batch-insert them
    const missingUnisMap = new Map<string, { name: string; country: string; global_ranking: number; campus_locations: string[] }>();
    for (const item of daadCourses) {
      const uniName = (item.academy || 'German Public University').trim();
      const key = uniName.toLowerCase();
      if (!uniMap.has(key) && !missingUnisMap.has(key)) {
        missingUnisMap.set(key, {
          name: uniName,
          country: 'Germany',
          global_ranking: 150,
          campus_locations: [(item.city || 'Germany').trim()],
        });
      }
    }

    if (missingUnisMap.size > 0) {
      const { data: insertedUnis } = await supabase
        .from('universities')
        .insert(Array.from(missingUnisMap.values()))
        .select('id, name');
      (insertedUnis || []).forEach((u: any) => uniMap.set(u.name.trim().toLowerCase(), u.id));
    }

    // 2. Pre-load existing courses for these universities to avoid duplicates
    const relevantUniIds = Array.from(new Set(Array.from(uniMap.values())));
    const { data: existingCourses } = await supabase
      .from('courses')
      .select('university_id, program_name')
      .in('university_id', relevantUniIds);

    const existingSet = new Set<string>();
    (existingCourses || []).forEach((c: any) => {
      existingSet.add(`${c.university_id}::${c.program_name.trim().toLowerCase()}`);
    });

    // 3. Build batch of new courses
    const coursePayloads: any[] = [];
    const coursePayloadsNoRaw: any[] = [];

    for (const item of daadCourses) {
      const uniName = (item.academy || 'German Public University').trim();
      const uniId = uniMap.get(uniName.toLowerCase());
      if (!uniId) continue;

      const programName = (item.courseName || item.courseNameShort || 'International Programme').trim();
      const dedupeKey = `${uniId}::${programName.toLowerCase()}`;
      if (existingSet.has(dedupeKey)) continue;
      existingSet.add(dedupeKey);

      const city = (item.city || 'Germany').trim();
      const degreeLevel = item.courseType === 1 ? 'Bachelor' : 'Master';

      let durationMonths = 24;
      const semMatch = String(item.programmeDuration || '').match(/(\d+)\s*semester/i);
      if (semMatch) durationMonths = Number(semMatch[1]) * 6;

      let tuitionEur = 0;
      const feeText = String(item.tuitionFees || '');
      if (!feeText.toLowerCase().includes('no tuition')) {
        const numMatch = feeText.replace(/,/g, '').match(/\d+/);
        if (numMatch) tuitionEur = Number(numMatch[0]);
      }

      const beginning = String(item.beginning || 'Winter semester');
      const intakes: string[] = [];
      if (beginning.toLowerCase().includes('winter')) intakes.push('October');
      if (beginning.toLowerCase().includes('summer')) intakes.push('April');
      if (intakes.length === 0) intakes.push('October');

      const subj = String(item.subject || '').toLowerCase();
      let category = 'Engineering';
      if (subj.includes('computer') || subj.includes('informatics') || subj.includes('ai')) {
        category = 'Computer Science & AI';
      } else if (subj.includes('data') || subj.includes('math')) {
        category = 'Data Science';
      } else if (subj.includes('business') || subj.includes('econom') || subj.includes('management')) {
        category = 'Business & Management';
      }

      const officialUrl = item.link
        ? `https://www2.daad.de${item.link}`
        : 'https://www2.daad.de/deutschland/studienangebote/international-programmes/en/';

      const rawDaadData = {
        'DAAD Programme ID': item.id,
        'Course Name': programName,
        'University': uniName,
        'City': city,
        'Country': 'Germany',
        'Degree Type': degreeLevel,
        'Subject': item.subject || '',
        'Languages': Array.isArray(item.languages) ? item.languages.join(', ') : 'English',
        'Duration': item.programmeDuration || `${durationMonths} months`,
        'Beginning': beginning,
        'Tuition Fees': item.tuitionFees || 'No tuition fees',
        'Official DAAD Link': officialUrl,
      };

      const base = {
        university_id: uniId,
        program_name: programName,
        degree_level: degreeLevel,
        category,
        duration_months: durationMonths,
        tuition_fees_eur: tuitionEur,
        intake_months: intakes,
        course_url: officialUrl,
        stay_back_visa_years: 1.5,
        average_graduate_salary: 58000,
      };

      coursePayloadsNoRaw.push(base);
      coursePayloads.push({ ...base, raw_excel_data: rawDaadData });
    }

    let insertedCount = 0;

    if (coursePayloads.length > 0) {
      let { data: insertedCourses, error: batchErr } = await supabase
        .from('courses')
        .insert(coursePayloads)
        .select('id');

      if (batchErr && batchErr.message?.includes('raw_excel_data')) {
        const fb = await supabase
          .from('courses')
          .insert(coursePayloadsNoRaw)
          .select('id');
        insertedCourses = fb.data;
      }

      if (insertedCourses && insertedCourses.length > 0) {
        insertedCount = insertedCourses.length;
        const rulesBatch = insertedCourses.map((c: any) => ({
          course_id: c.id,
          min_12th_percent: 70,
          min_degree_percent: 70,
          min_ielts: 6.5,
          min_toefl: 88,
          interview_required: false,
          work_experience_months: 0,
        }));
        await supabase.from('eligibility_rules').insert(rulesBatch);
      }
    }

    const nextOffset = offset + daadCourses.length;
    const hasMore = nextOffset < totalAvailable;

    return NextResponse.json({
      success: true,
      source: 'daad',
      fetched_count: daadCourses.length,
      inserted_count: insertedCount,
      total_available: totalAvailable,
      next_offset: nextOffset,
      has_more: hasMore,
      message: `Synced ${insertedCount} new courses (${nextOffset} / ${totalAvailable} checked).`,
    });
  } catch (err: any) {
    console.error('Error in /api/sync-web:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
