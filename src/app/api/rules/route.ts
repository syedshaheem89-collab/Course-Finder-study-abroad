import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';

// System baseline rules (also acts as runtime store if institutional_rules table isn't created in Supabase)
const rulesStore: any[] = [
  {
    id: 'rule-malta',
    scope: 'COUNTRY',
    target_name: 'Malta',
    default_min_degree_percent: 50,
    default_min_12th_percent: 50,
    just_pass_accepted: true,
    min_age: 18,
    max_age: 40,
    max_gap_years: 8,
    english_policy: 'MOI_ACCEPTED',
    default_min_ielts: 5.5,
    notes: 'National Malta standard: Just Pass / 50% accepted, MOI recognized, up to 8 yrs gap & age 40.',
  },
  {
    id: 'rule-germany',
    scope: 'COUNTRY',
    target_name: 'Germany',
    default_min_degree_percent: 70,
    default_min_12th_percent: 70,
    just_pass_accepted: false,
    min_age: 18,
    max_age: 35,
    max_gap_years: 4,
    english_policy: 'IELTS_TOEFL',
    default_min_ielts: 6.5,
    notes: 'Standard German university admission: 70%+ academic requirement, max 4 yrs gap.',
  },
  {
    id: 'rule-ireland',
    scope: 'COUNTRY',
    target_name: 'Ireland',
    default_min_degree_percent: 65,
    default_min_12th_percent: 65,
    just_pass_accepted: false,
    min_age: 18,
    max_age: 35,
    max_gap_years: 5,
    english_policy: 'IELTS_TOEFL',
    default_min_ielts: 6.5,
    notes: 'Standard Irish university requirement with 2-year Stamp 1G stay back.',
  },
];

// GET: Fetch country & university policy rules
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: rules, error } = await supabase
      .from('institutional_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !rules || rules.length === 0) {
      return NextResponse.json({ success: true, rules: rulesStore });
    }

    return NextResponse.json({ success: true, rules });
  } catch {
    return NextResponse.json({ success: true, rules: rulesStore });
  }
}

// POST: Add or update a Country / University level rule
export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const {
      scope = 'COUNTRY',
      target_name,
      default_min_degree_percent = 50,
      default_min_12th_percent = 50,
      just_pass_accepted = false,
      min_age = 18,
      max_age = 35,
      max_gap_years = 5,
      english_policy = 'MOI_ACCEPTED',
      default_min_ielts = 5.5,
      notes = '',
    } = body;

    const cleanTarget = String(target_name || '').trim().slice(0, 120);
    if (!cleanTarget) {
      return NextResponse.json({ success: false, error: 'Target name is required' }, { status: 400 });
    }

    const validScope = scope === 'UNIVERSITY' ? 'UNIVERSITY' : 'COUNTRY';
    const clampPct = (v: any) => Math.min(100, Math.max(0, Number(v) || 0));

    const newRule = {
      id: `rule-${cleanTarget.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      scope: validScope,
      target_name: cleanTarget,
      default_min_degree_percent: just_pass_accepted ? 35 : clampPct(default_min_degree_percent),
      default_min_12th_percent: just_pass_accepted ? 35 : clampPct(default_min_12th_percent),
      just_pass_accepted: Boolean(just_pass_accepted),
      min_age: Math.min(80, Math.max(15, Number(min_age) || 18)),
      max_age: Math.min(80, Math.max(18, Number(max_age) || 40)),
      max_gap_years: Math.min(30, Math.max(0, Number(max_gap_years) || 0)),
      english_policy: ['IELTS_TOEFL', 'MOI_ACCEPTED', 'WAIVED'].includes(english_policy) ? english_policy : 'MOI_ACCEPTED',
      default_min_ielts: Math.min(9, Math.max(0, Number(default_min_ielts) || 5.5)),
      notes: String(notes || '').slice(0, 500),
    };

    // Update runtime store
    const existingIdx = rulesStore.findIndex(
      (r) => r.target_name.toLowerCase() === cleanTarget.toLowerCase()
    );
    if (existingIdx >= 0) {
      rulesStore[existingIdx] = newRule;
    } else {
      rulesStore.unshift(newRule);
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('institutional_rules')
      .upsert(newRule, { onConflict: 'target_name' })
      .select('*')
      .single();

    await logSecurityEvent({
      event: 'RULE_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/rules',
      details: { scope: validScope, targetName: cleanTarget },
    });

    if (error) {
      return NextResponse.json({
        success: true,
        message: 'Rule saved successfully',
        rule: newRule,
      });
    }

    return NextResponse.json({ success: true, message: 'Institutional rule saved', rule: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
