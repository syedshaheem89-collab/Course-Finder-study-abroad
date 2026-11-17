import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// PUT: Edit/Update an existing course and its eligibility rules
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tuition_fees_eur, program_name, category, eligibility_rules } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

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

// DELETE: Delete a course from Supabase
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

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
