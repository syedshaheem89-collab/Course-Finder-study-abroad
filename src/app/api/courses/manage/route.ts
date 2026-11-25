import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { isValidUuid } from '@/lib/security/validation';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';
import { invalidateUniversitiesCache } from '@/lib/universities-cache';

// GET: Fetch universities with course counts for Admin University Manager
export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode !== 'universities') {
      return NextResponse.json({ success: false, error: 'Unsupported mode' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await (supabase.from('universities') as any)
      .select('id, name, country, courses(count)')
      .order('name')
      .limit(5000);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const universities = (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      country: u.country,
      course_count: Array.isArray(u.courses) && u.courses[0] ? Number(u.courses[0].count) || 0 : 0,
    }));

    return NextResponse.json({ success: true, universities });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Edit/Update an existing course or university
export async function PUT(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const supabase = createServerSupabaseClient();

    if (body.type === 'university') {
      const { id, name, country } = body;
      if (!id || !isValidUuid(String(id)) || !name) {
        return NextResponse.json({ success: false, error: 'Valid University ID and name are required' }, { status: 400 });
      }
      const { error } = await (supabase.from('universities') as any)
        .update({ name: String(name).trim().slice(0, 200), ...(country ? { country: String(country).trim().slice(0, 100) } : {}) })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      invalidateUniversitiesCache();
      await logSecurityEvent({
        event: 'UNIVERSITY_UPDATED',
        severity: 'INFO',
        actorEmail: auth.session.email,
        actorId: auth.session.uid,
        ip,
        userAgent: ua,
        path: '/api/courses/manage',
        details: { id, name: String(name).trim() },
      });
      return NextResponse.json({ success: true, message: 'University updated successfully in Supabase' });
    }

    const { id, tuition_fees_eur, program_name, category, eligibility_rules } = body;

    if (!id || !isValidUuid(String(id))) {
      return NextResponse.json({ success: false, error: 'Valid Course ID is required' }, { status: 400 });
    }

    const safeTuition = Math.max(0, Number(tuition_fees_eur) || 0);

    // 1. Update course details
    const { error: courseError } = await supabase
      .from('courses')
      .update({
        tuition_fees_eur: safeTuition,
        program_name: program_name ? String(program_name).trim().slice(0, 250) : undefined,
        category: category ? String(category).trim().slice(0, 120) : undefined,
      })
      .eq('id', id);

    if (courseError) {
      return NextResponse.json({ success: false, error: courseError.message }, { status: 500 });
    }

    // 2. Update eligibility rules if provided
    if (eligibility_rules) {
      const clampPct = (v: any) => Math.min(100, Math.max(0, Number(v) || 0));
      const clampIelts = (v: any) => Math.min(9, Math.max(0, Number(v) || 0));
      await supabase
        .from('eligibility_rules')
        .upsert(
          {
            course_id: id,
            min_12th_percent: clampPct(eligibility_rules.min_12th_percent),
            min_degree_percent: clampPct(eligibility_rules.min_degree_percent),
            min_ielts: clampIelts(eligibility_rules.min_ielts),
            interview_required: Boolean(eligibility_rules.interview_required),
          },
          { onConflict: 'course_id' }
        );
    }

    await logSecurityEvent({
      event: 'COURSE_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/courses/manage',
      details: { courseId: id },
    });

    return NextResponse.json({ success: true, message: 'Course updated successfully in Supabase' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Bulk update eligibility rules (min_degree_percent, min_12th_percent, min_ielts) for multiple courses
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const { ids, min_degree_percent, min_12th_percent, min_ielts } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Course IDs array is required' }, { status: 400 });
    }

    const validIds = ids.map((x: any) => String(x).trim()).filter(isValidUuid);
    if (validIds.length !== ids.length) {
      return NextResponse.json({ success: false, error: 'One or more invalid Course IDs.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const clampPct = (v: any) => Math.min(100, Math.max(0, Number(v) || 0));
    const clampIelts = (v: any) => Math.min(9, Math.max(0, Number(v) || 0));

    const rowsToUpsert = validIds.map((courseId: string) => {
      const record: Record<string, any> = { course_id: courseId };
      if (min_degree_percent !== undefined) record.min_degree_percent = clampPct(min_degree_percent);
      if (min_12th_percent !== undefined) record.min_12th_percent = clampPct(min_12th_percent);
      if (min_ielts !== undefined) record.min_ielts = clampIelts(min_ielts);
      return record;
    });

    for (let i = 0; i < rowsToUpsert.length; i += 200) {
      const chunk = rowsToUpsert.slice(i, i + 200);
      const { error } = await supabase
        .from('eligibility_rules')
        .upsert(chunk, { onConflict: 'course_id' });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    await logSecurityEvent({
      event: 'COURSES_BULK_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/courses/manage',
      details: { count: validIds.length },
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${validIds.length} courses in Supabase`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Delete courses OR entire universities (with all their courses) from Supabase
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const universityId = searchParams.get('university_id');
    const universityIdsParam = searchParams.get('university_ids');

    const supabase = createServerSupabaseClient();

    // Delete entire university / universities and all their courses
    if (universityId || universityIdsParam) {
      const uniIds = universityIdsParam
        ? universityIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
        : [universityId!.trim()];

      if (uniIds.length === 0 || !uniIds.every(isValidUuid)) {
        return NextResponse.json({ success: false, error: 'Valid University ID(s) required' }, { status: 400 });
      }

      for (let i = 0; i < uniIds.length; i += 50) {
        const chunk = uniIds.slice(i, i + 50);
        const { error: coursesDelErr } = await supabase
          .from('courses')
          .delete()
          .in('university_id', chunk);

        if (coursesDelErr) {
          return NextResponse.json({ success: false, error: coursesDelErr.message }, { status: 500 });
        }

        const { error: uniDelErr } = await supabase
          .from('universities')
          .delete()
          .in('id', chunk);

        if (uniDelErr) {
          return NextResponse.json({ success: false, error: uniDelErr.message }, { status: 500 });
        }
      }

      invalidateUniversitiesCache();

      await logSecurityEvent({
        event: 'UNIVERSITIES_DELETED',
        severity: 'WARN',
        actorEmail: auth.session.email,
        actorId: auth.session.uid,
        ip,
        userAgent: ua,
        path: '/api/courses/manage',
        details: { count: uniIds.length },
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${uniIds.length} ${uniIds.length === 1 ? 'university' : 'universities'} and all associated courses`,
      });
    }

    if (idsParam) {
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0 || !ids.every(isValidUuid)) {
        return NextResponse.json({ success: false, error: 'Valid Course IDs required' }, { status: 400 });
      }
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase.from('courses').delete().in('id', chunk);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }
      await logSecurityEvent({
        event: 'COURSES_BULK_DELETED',
        severity: 'WARN',
        actorEmail: auth.session.email,
        actorId: auth.session.uid,
        ip,
        userAgent: ua,
        path: '/api/courses/manage',
        details: { count: ids.length },
      });
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} courses` });
    }

    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ success: false, error: 'Valid Course ID is required' }, { status: 400 });
    }

    // Cascading delete will remove associated eligibility_rules
    const { error } = await supabase.from('courses').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await logSecurityEvent({
      event: 'COURSE_DELETED',
      severity: 'WARN',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/courses/manage',
      details: { courseId: id },
    });

    return NextResponse.json({ success: true, message: 'Course deleted successfully from Supabase' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
