import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/security/session';
import { normalizeCountryName } from '@/lib/countries';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, student_name, email, phone, background_profile, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to aggregate market intelligence' },
        { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
      );
    }

    const rows = data || [];
    const events: any[] = [];
    const leads: any[] = [];

    for (const row of rows) {
      if (row.email === '__analytics_event__') {
        events.push(row);
      } else {
        leads.push(row);
      }
    }

    let totalSearches = 0;
    let totalCourseViews = 0;
    let hotLeads = 0;
    let basicLeads = 0;
    let loanDemandCount = 0;
    let moiDemandCount = 0;

    const countryMap = new Map<string, { searches: number; leads: number }>();
    const courseCounts = new Map<string, number>();
    const universityCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const budgetCounts = new Map<string, number>();
    const englishCounts = new Map<string, number>();
    const intakeCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    const incMap = (map: Map<string, number>, rawKey: string, amount = 1) => {
      const clean = String(rawKey || '').trim();
      if (!clean) return;
      map.set(clean, (map.get(clean) || 0) + amount);
    };

    const ensureCountry = (rawCountry: string) => {
      const normalized = normalizeCountryName(rawCountry);
      if (!normalized) return null;
      if (!countryMap.has(normalized)) {
        countryMap.set(normalized, { searches: 0, leads: 0 });
      }
      return normalized;
    };

    // Build last 14 days daily map
    const dailyMap = new Map<string, { searches: number; leads: number }>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { searches: 0, leads: 0 });
    }

    for (const ev of events) {
      const bp = (ev.background_profile || {}) as Record<string, any>;
      const type = String(bp.event_type || '');
      const dayKey = String(ev.created_at || '').slice(0, 10);

      if (type === 'search' || type === 'country_select' || type === 'ai_recommend') {
        totalSearches++;
        if (dailyMap.has(dayKey)) {
          dailyMap.get(dayKey)!.searches++;
        }
      } else if (type === 'course_view') {
        totalCourseViews++;
      }

      const cKey = bp.country ? ensureCountry(String(bp.country)) : null;
      if (cKey) {
        countryMap.get(cKey)!.searches++;
      }

      if (bp.query) incMap(courseCounts, String(bp.query).toLowerCase());
      if (bp.subject) incMap(courseCounts, String(bp.subject));
      if (bp.course_name) incMap(courseCounts, String(bp.course_name));

      if (type === 'course_view' && bp.university_name) {
        incMap(universityCounts, String(bp.university_name));
      }

      if (bp.city) incMap(cityCounts, String(bp.city));
      if (bp.budget_tier) {
        incMap(budgetCounts, String(bp.budget_tier));
        if (String(bp.budget_tier).toLowerCase().includes('loan')) loanDemandCount++;
      }
      if (bp.english_status) {
        incMap(englishCounts, String(bp.english_status));
        if (String(bp.english_status).toLowerCase().includes('moi')) moiDemandCount++;
      }
      if (bp.intake) incMap(intakeCounts, String(bp.intake));
      if (bp.device_type) incMap(deviceCounts, String(bp.device_type));

      const src = bp.utm_source || bp.referrer || 'Direct';
      incMap(sourceCounts, String(src));
    }

    for (const lead of leads) {
      const bp = (lead.background_profile || {}) as Record<string, any>;
      const dayKey = String(lead.created_at || '').slice(0, 10);
      if (dailyMap.has(dayKey)) {
        dailyMap.get(dayKey)!.leads++;
      }

      if (bp.lead_tier === 'hot_qualified') hotLeads++;
      else basicLeads++;

      const cKey = bp.preferred_destination ? ensureCountry(String(bp.preferred_destination)) : null;
      if (cKey) {
        countryMap.get(cKey)!.leads++;
      }

      if (bp.course) incMap(courseCounts, String(bp.course));
      else if (bp.search_context) incMap(courseCounts, String(bp.search_context));

      const city = bp.place || bp.city;
      if (city) incMap(cityCounts, String(city));

      if (bp.budget_tier) {
        incMap(budgetCounts, String(bp.budget_tier));
        if (String(bp.budget_tier).toLowerCase().includes('loan') || bp.needs_education_loan) {
          loanDemandCount++;
        }
      } else if (bp.budget) {
        const bNum = Number(bp.budget);
        if (bNum > 0 && bNum <= 5000) incMap(budgetCounts, 'Under €5,000 (Low / Free)');
        else if (bNum > 5000 && bNum <= 12000) incMap(budgetCounts, '€5,000 – €12,000');
        else if (bNum > 12000 && bNum <= 20000) incMap(budgetCounts, '€12,000 – €20,000');
        else if (bNum > 20000) incMap(budgetCounts, '€20,000+');
      }

      const engStatus =
        bp.english_status ||
        (bp.tests?.ielts
          ? 'IELTS'
          : bp.tests?.pte
          ? 'PTE'
          : String(bp.tests?.other_language || '').toLowerCase().includes('moi')
          ? 'MOI (No IELTS)'
          : '');
      if (engStatus) {
        incMap(englishCounts, String(engStatus));
        if (String(engStatus).toLowerCase().includes('moi')) moiDemandCount++;
      }

      if (bp.target_intake) incMap(intakeCounts, String(bp.target_intake));
      if (bp.device_type) incMap(deviceCounts, String(bp.device_type));
      if (bp.utm_source || bp.referrer) {
        incMap(sourceCounts, String(bp.utm_source || bp.referrer));
      } else {
        incMap(sourceCounts, 'Direct');
      }
    }

    const totalLeads = leads.length;
    const denominator = Math.max(totalSearches, totalLeads, 1);
    const conversionRate =
      totalSearches > 0 ? Math.min(100, Number(((totalLeads / denominator) * 100).toFixed(1))) : totalLeads > 0 ? 100 : 0;

    const topCountries = Array.from(countryMap.entries())
      .map(([country, counts]) => {
        const totalTouch = Math.max(counts.searches, counts.leads, 1);
        return {
          country,
          searches: counts.searches,
          leads: counts.leads,
          score: counts.searches + counts.leads * 2,
          conversionRate: counts.searches > 0
            ? Math.min(100, Number(((counts.leads / totalTouch) * 100).toFixed(1)))
            : counts.leads > 0 ? 100 : 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const toSortedList = (map: Map<string, number>, limit = 12) =>
      Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const trendSeries = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      searches: v.searches,
      leads: v.leads,
    }));

    return NextResponse.json(
      {
        success: true,
        kpis: {
          totalSearches,
          totalCourseViews,
          totalLeads,
          hotLeads,
          basicLeads,
          conversionRate,
          loanDemandCount,
          moiDemandCount,
        },
        topCountries,
        topCourses: toSortedList(courseCounts, 15),
        topUniversities: toSortedList(universityCounts, 10),
        topCities: toSortedList(cityCounts, 12),
        budgetBreakdown: toSortedList(budgetCounts, 8),
        englishBreakdown: toSortedList(englishCounts, 8),
        intakeBreakdown: toSortedList(intakeCounts, 6),
        deviceBreakdown: toSortedList(deviceCounts, 4),
        sourceBreakdown: toSortedList(sourceCounts, 10),
        trendSeries,
      },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to aggregate analytics summary' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }
}
