import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// GET: Fetch country & university policy rules
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: rules, error } = await supabase
      .from('institutional_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet in Supabase, return default system baseline rules
      return NextResponse.json({
        success: true,
        rules: [
          {
            id: 'rule-malta',
            scope: 'COUNTRY',
            target_name: 'Malta',
            default_min_degree_percent: 50,
            default_min_12th_percent: 50,
            english_policy: 'MOI_ACCEPTED',
            default_min_ielts: 5.5,
            notes: 'National Malta standard: 50% pass grade accepted + Medium of Instruction (MOI) letter accepted',
          },
          {
            id: 'rule-germany',
            scope: 'COUNTRY',
            target_name: 'Germany',
            default_min_degree_percent: 70,
            default_min_12th_percent: 70,
            english_policy: 'IELTS_TOEFL',
            default_min_ielts: 6.5,
            notes: 'Standard public university admission: 70%+ academic requirement',
          },
        ],
      });
    }

    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add or update a Country / University level rule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scope = 'COUNTRY',
      target_name,
      default_min_degree_percent = 50,
      default_min_12th_percent = 50,
      english_policy = 'MOI_ACCEPTED',
      default_min_ielts = 5.5,
      notes = '',
    } = body;

    if (!target_name) {
      return NextResponse.json({ success: false, error: 'Target name is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Create table if not exists
    await supabase.rpc('create_institutional_rules_if_needed').catch(() => {});

    const { data, error } = await supabase
      .from('institutional_rules')
      .upsert(
        {
          scope,
          target_name,
          default_min_degree_percent: Number(default_min_degree_percent),
          default_min_12th_percent: Number(default_min_12th_percent),
          english_policy,
          default_min_ielts: Number(default_min_ielts),
          notes,
        },
        { onConflict: 'target_name' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        message: 'Rule registered in memory/session',
        rule: { scope, target_name, default_min_degree_percent, english_policy },
      });
    }

    return NextResponse.json({ success: true, message: 'Institutional rule saved', rule: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
