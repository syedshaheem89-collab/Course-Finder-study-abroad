import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { safeFetchExternal } from '@/lib/security/ssrf-guard';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const { source = 'daad', limit = 100, offset = 0, url } = body;

    if (source === 'fetch_url') {
      if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
        return NextResponse.json(
          { success: false, error: 'Please provide a valid http:// or https:// CSV/Excel/JSON URL.' },
          { status: 400 }
        );
      }

      let feed: Awaited<ReturnType<typeof safeFetchExternal>>;
      try {
        feed = await safeFetchExternal(url.trim(), {
          headers: { 'User-Agent': 'Orbis/2026' },
          timeoutMs: 12_000,
          maxBytes: 8_000_000,
        });
      } catch (ssrfErr: any) {
        await logSecurityEvent({
          event: 'SSRF_OR_FETCH_BLOCKED',
          severity: 'CRITICAL',
          actorEmail: auth.session.email,
          actorId: auth.session.uid,
          ip,
          userAgent: ua,
          path: '/api/sync-web',
          details: { targetUrl: url.slice(0, 200), reason: ssrfErr?.message },
        });
        return NextResponse.json(
          { success: false, error: ssrfErr?.message || 'Blocked unsafe external URL.' },
          { status: 400 }
        );
      }

      if (!feed.ok) {
        return NextResponse.json(
          { success: false, error: `Remote URL returned HTTP ${feed.status}` },
          { status: 502 }
        );
      }

      const contentType = feed.contentType;
      if (contentType.includes('application/json') || url.trim().toLowerCase().endsWith('.json')) {
        const jsonData = JSON.parse(feed.buffer.toString('utf8'));
        const arr = Array.isArray(jsonData) ? jsonData : jsonData.courses || jsonData.data || jsonData.results || [];
        if (!Array.isArray(arr) || arr.length === 0) {
          return NextResponse.json({ success: false, error: 'JSON feed contained no array of courses.' }, { status: 400 });
        }
        const headers = Object.keys(arr[0]);
        const rawAoA = [headers, ...arr.map((row: any) => headers.map((h) => row[h] ?? ''))];
        await logSecurityEvent({
          event: 'WEB_SYNC_EXECUTED',
          severity: 'INFO',
          actorEmail: auth.session.email,
          actorId: auth.session.uid,
          ip,
          userAgent: ua,
          path: '/api/sync-web',
          details: { source: 'fetch_url', count: arr.length },
        });
        return NextResponse.json({ success: true, rawAoA, count: arr.length });
      }

      const wb = XLSX.read(feed.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawAoA: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawAoA || rawAoA.length < 2) {
        return NextResponse.json({ success: false, error: 'Feed file is empty or unreadable.' }, { status: 400 });
      }
      await logSecurityEvent({
        event: 'WEB_SYNC_EXECUTED',
        severity: 'INFO',
        actorEmail: auth.session.email,
        actorId: auth.session.uid,
        ip,
        userAgent: ua,
        path: '/api/sync-web',
        details: { source: 'fetch_url', count: rawAoA.length - 1 },
      });
      return NextResponse.json({ success: true, rawAoA, count: rawAoA.length - 1 });
    }

    if (source !== 'daad') {
      return NextResponse.json({
        success: true,
        source,
        inserted_count: 0,
        has_more: false,
        message: `${source.toUpperCase()} does not provide a public unauthenticated API. Export CSV/Excel from the portal and upload in Step 2 (supports 10,000+ rows in 300-row chunks).`,
      });
    }

    // Fetch a batch of English-taught Bachelor & Master programmes from DAAD Germany API
    const daadUrl = `https://www2.daad.de/deutschland/studienangebote/international-programmes/api/solr/en/search.json?degree%5B%5D=1&degree%5B%5D=2&lang%5B%5D=2&limit=${limit}&offset=${offset}&display=list`;

    const res = await fetch(daadUrl, {
      headers: {
        'User-Agent': 'Orbis/2026',
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

    await logSecurityEvent({
      event: 'WEB_SYNC_EXECUTED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/sync-web',
      details: { source: 'daad', insertedCount, offset },
    });

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
