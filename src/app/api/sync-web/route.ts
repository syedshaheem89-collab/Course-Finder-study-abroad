import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source = 'daad', limit = 20 } = body;

    if (source !== 'daad') {
      return NextResponse.json({
        success: true,
        source,
        inserted_count: 0,
        message: `${source.toUpperCase()} sync worker pinged. Live JSON feed currently configured for DAAD Germany.`,
      });
    }

    // Fetch real English-taught Bachelor & Master programmes from DAAD Germany API
    const daadUrl = `https://www2.daad.de/deutschland/studienangebote/international-programmes/api/solr/en/search.json?degree%5B%5D=1&degree%5B%5D=2&lang%5B%5D=2&limit=${limit}&offset=0&display=list`;

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

    if (daadCourses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No courses returned from DAAD API',
      });
    }

    const supabase = createServerSupabaseClient();
    let insertedCount = 0;

    for (const item of daadCourses) {
      const uniName = (item.academy || 'German Public University').trim();
      const city = (item.city || 'Germany').trim();
      const programName = (item.courseName || item.courseNameShort || 'International Programme').trim();

      // 1. Ensure University exists
      let { data: existingUni } = await supabase
        .from('universities')
        .select('id')
        .eq('name', uniName)
        .maybeSingle();

      let uniId = existingUni?.id;
      if (!uniId) {
        const { data: newUni } = await supabase
          .from('universities')
          .insert({
            name: uniName,
            country: 'Germany',
            global_ranking: 150,
            campus_locations: [city],
          })
          .select('id')
          .single();
        uniId = newUni?.id;
      }

      if (!uniId) continue;

      // Skip if this exact course already exists for this university
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('university_id', uniId)
        .eq('program_name', programName)
        .maybeSingle();

      if (existingCourse) continue;

      // Parse degree level
      const degreeLevel = item.courseType === 1 ? 'Bachelor' : 'Master';

      // Parse duration in months (e.g. "4 semesters" -> 24 months)
      let durationMonths = 24;
      const semMatch = String(item.programmeDuration || '').match(/(\d+)\s*semester/i);
      if (semMatch) {
        durationMonths = Number(semMatch[1]) * 6;
      }

      // Parse tuition fees (EUR)
      let tuitionEur = 0;
      const feeText = String(item.tuitionFees || '');
      if (!feeText.toLowerCase().includes('no tuition')) {
        const numMatch = feeText.replace(/,/g, '').match(/\d+/);
        if (numMatch) tuitionEur = Number(numMatch[0]);
      }

      // Parse intakes
      const beginning = String(item.beginning || 'Winter semester');
      const intakes: string[] = [];
      if (beginning.toLowerCase().includes('winter')) intakes.push('October');
      if (beginning.toLowerCase().includes('summer')) intakes.push('April');
      if (intakes.length === 0) intakes.push('October');

      // Map subject to category
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

      const basePayload = {
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

      let { data: newCourse, error: courseErr } = await supabase
        .from('courses')
        .insert({ ...basePayload, raw_excel_data: rawDaadData })
        .select('id')
        .single();

      if (courseErr && courseErr.message?.includes('raw_excel_data')) {
        const fb = await supabase
          .from('courses')
          .insert(basePayload)
          .select('id')
          .single();
        newCourse = fb.data;
      }

      if (newCourse?.id) {
        await supabase.from('eligibility_rules').insert({
          course_id: newCourse.id,
          min_12th_percent: 70,
          min_degree_percent: 70,
          min_ielts: 6.5,
          min_toefl: 88,
          interview_required: false,
          work_experience_months: 0,
        });
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      source: 'daad',
      fetched_count: daadCourses.length,
      inserted_count: insertedCount,
      message: `Synced ${insertedCount} new live programmes from DAAD Germany (${daadCourses.length} checked)!`,
    });
  } catch (err: any) {
    console.error('Error in /api/sync-web:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
