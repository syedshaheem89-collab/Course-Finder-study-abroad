import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// GET: Fetch universities with course counts for Admin University Manager
export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const supabase = createServerSupabaseClient();

    if (body.type === 'university') {
      const { id, name, country } = body;
      if (!id || !name) {
        return NextResponse.json({ success: false, error: 'University ID and name are required' }, { status: 400 });
      }
      const { error } = await (supabase.from('universities') as any)
        .update({ name: name.trim(), ...(country ? { country: country.trim() } : {}) })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'University updated successfully in Supabase' });
    }

    const { id, tuition_fees_eur, program_name, category, eligibility_rules } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    // 1. Update course details
    const { error: courseError } = await supabase
      .from('courses')
      .update({
        tuition_fees_eur: Number(tuition_fees_eur),
        program_name: program_name || undefined,
        category: category || undefined,
      })
      .eq('id', id);

    if (courseError) {
      return NextResponse.json({ success: false, error: courseError.message }, { status: 500 });
    }

    // 2. Update eligibility rules if provided
    if (eligibility_rules) {
      await supabase
        .from('eligibility_rules')
        .upsert(
          {
            course_id: id,
            min_12th_percent: Number(eligibility_rules.min_12th_percent),
            min_degree_percent: Number(eligibility_rules.min_degree_percent),
            min_ielts: Number(eligibility_rules.min_ielts),
            interview_required: Boolean(eligibility_rules.interview_required),
          },
          { onConflict: 'course_id' }
        );
    }

    return NextResponse.json({ success: true, message: 'Course updated successfully in Supabase' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Bulk update eligibility rules (min_degree_percent, min_12th_percent, min_ielts) for multiple courses
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, min_degree_percent, min_12th_percent, min_ielts } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Course IDs array is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const rowsToUpsert = ids.map((courseId: string) => {
      const record: Record<string, any> = { course_id: courseId };
      if (min_degree_percent !== undefined) record.min_degree_percent = Number(min_degree_percent);
      if (min_12th_percent !== undefined) record.min_12th_percent = Number(min_12th_percent);
      if (min_ielts !== undefined) record.min_ielts = Number(min_ielts);
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

    return NextResponse.json({
      success: true,
      message: `Updated ${ids.length} courses in Supabase`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Delete courses OR entire universities (with all their courses) from Supabase
export async function DELETE(req: NextRequest) {
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

      if (uniIds.length === 0) {
        return NextResponse.json({ success: false, error: 'University ID(s) required' }, { status: 400 });
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

      return NextResponse.json({
        success: true,
        message: `Deleted ${uniIds.length} ${uniIds.length === 1 ? 'university' : 'universities'} and all associated courses`,
      });
    }

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase.from('courses').delete().in('id', chunk);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} courses` });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    // Cascading delete will remove associated eligibility_rules
    const { error } = await supabase.from('courses').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Course deleted successfully from Supabase' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
