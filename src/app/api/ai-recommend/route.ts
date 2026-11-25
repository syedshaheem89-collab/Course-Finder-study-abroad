import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { callGroqFreeJson } from '@/lib/groq-client';
import { calculateMatchScore } from '@/lib/match-calculator';
import { normalizeCourseType, pteToIelts } from '@/lib/course-utils';
import { expandSearchTerms, matchesSmartSearch } from '@/lib/search-synonyms';
import { getCountryVisaIntel, resolveOfficialStayBackYears } from '@/lib/country-visa-intel';
import { normalizeCountryName } from '@/lib/countries';
import { getCuratedFallbackCourses } from '@/lib/country-curated-fallback';
import { sanitizeHttpUrl, sanitizeSearchQuery } from '@/lib/security/validation';
import { getSiteSettingsServer } from '@/lib/site-settings-server';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  SectorFilter,
  UniversitySector,
} from '@/lib/university-classification';

export interface AiRecommendationItem {
  course_id: string;
  program_name: string;
  university_name: string;
  country: string;
  degree_level: string;
  category: string;
  institution_type?: UniversitySector;
  is_priority_university?: boolean;
  priority_rank?: number | null;
  tuition_fees_eur: number;
  duration_months: number;
  intake_months: string[];
  stay_back_visa_years: number;
  average_graduate_salary: number;
  min_ielts: number;
  english_policy: string;
  match_score: number;
  fit_score: number;
  admission_chance: 'High' | 'Good' | 'Stretch';
  why_it_fits: string;
  rationale: string;
  course_url: string;
  is_verified_db: boolean;
  roi_ratio: number;
  settlement_probability_percent: number;
}

function getCountrySearchVariants(country: string): string[] {
  const lower = country.toLowerCase();
  if (lower === 'united kingdom' || lower === 'uk') return ['United Kingdom', 'UK'];
  if (lower === 'usa' || lower === 'united states') return ['USA', 'United States', 'US'];
  if (lower === 'united arab emirates' || lower === 'uae') return ['United Arab Emirates', 'UAE'];
  return [country];
}

function mapLevelToCourseType(targetLevel: string): string | undefined {
  const l = targetLevel.toLowerCase();
  if (!l) return undefined;
  if (l.includes('undergraduate') || l.includes('bachelor')) return 'Undergraduate';
  if (l.includes('pg diploma')) return 'PG Diploma';
  if (l.includes('master') || l.includes('mba') || l.includes('phd')) return 'Masters';
  return undefined;
}

function deriveAdmissionChance(score: number): 'High' | 'Good' | 'Stretch' {
  if (score >= 82) return 'High';
  if (score >= 68) return 'Good';
  return 'Stretch';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawDest =
      String(body.preferred_destination || '').trim() ||
      (Array.isArray(body.target_countries) ? String(body.target_countries[0] || '').trim() : '');
    const preferredDestination = normalizeCountryName(rawDest) || '';

    const rawSector = String(body.sector || 'all').trim().toLowerCase();
    const sectorFilter: SectorFilter =
      rawSector === 'public' ? 'Public' : rawSector === 'private' ? 'Private' : 'all';

    const targetLevel = String(body.target_level || '').trim().slice(0, 60);
    const coursePreference = String(body.course_preference || body.course_category || '').trim().slice(0, 150);
    const budgetEur = Math.min(500_000, Math.max(0, Number(body.budget_eur) || 0));

    const twelfthPercent =
      body.twelfth_percent !== undefined && body.twelfth_percent !== ''
        ? Math.min(100, Math.max(0, Number(body.twelfth_percent) || 0))
        : undefined;
    const plus2Stream = String(body.plus2_stream || '').trim().slice(0, 80);

    const bachelorDegree = String(body.bachelor_degree || '').trim().slice(0, 100);
    const bachelorPercent =
      body.bachelor_percent !== undefined && body.bachelor_percent !== ''
        ? Math.min(100, Math.max(0, Number(body.bachelor_percent) || 0))
        : body.degree_percent !== undefined && body.degree_percent !== ''
        ? Math.min(100, Math.max(0, Number(body.degree_percent) || 0))
        : undefined;
    const backlogs = Math.min(50, Math.max(0, Number(body.backlogs) || 0));
    const masterPercent =
      body.master_percent !== undefined && body.master_percent !== ''
        ? Math.min(100, Math.max(0, Number(body.master_percent) || 0))
        : undefined;

    const rawIelts = Number(body.ielts_score || body.english_score || 0) || 0;
    const rawPte = Number(body.pte_score || 0) || 0;
    const effectiveIelts = Math.min(9, Math.max(0, Math.max(rawIelts, pteToIelts(rawPte))));
    const greGmat = String(body.gre_gmat || '').trim().slice(0, 60);
    const otherLanguage = String(body.other_language || '').trim().slice(0, 100);
    const hasMoi =
      otherLanguage.toLowerCase().includes('moi') ||
      otherLanguage.toLowerCase().includes('medium of instruction');

    const workExpMonths = Math.min(600, Math.max(0, Number(body.work_experience_months) || 0));
    const studyGapYears = Math.min(30, Math.max(0, Number(body.study_gap_years) || 0));
    const age = body.age ? Math.min(80, Math.max(15, Number(body.age) || 0)) : undefined;
    const maritalStatus = String(body.marital_status || '').trim().slice(0, 30);
    const targetIntake = String(body.target_intake || '').trim().slice(0, 60);
    const specificEnquiry = String(body.specific_enquiry || body.career_goal || '').trim().slice(0, 300);

    const [{ priorityUniversities }, supabase] = await Promise.all([
      getSiteSettingsServer(),
      Promise.resolve(createServerSupabaseClient()),
    ]);

    // Only select existing Supabase eligibility_rules columns!
    const innerCourseSelect = `
      id,
      university_id,
      program_name,
      degree_level,
      duration_months,
      tuition_fees_eur,
      intake_months,
      course_url,
      stay_back_visa_years,
      average_graduate_salary,
      category,
      university:universities!inner (
        id,
        name,
        country,
        global_ranking
      ),
      eligibility_rules (
        id,
        course_id,
        min_12th_percent,
        min_degree_percent,
        min_ielts,
        min_toefl,
        interview_required,
        work_experience_months
      )
    `;

    // Step A: Targeted Supabase lookup using !inner join + Admin Priority universities
    let rawDbCourses: any[] = [];
    const seenIds = new Set<string>();

    const appendRows = (rows: any[] | null | undefined) => {
      if (!Array.isArray(rows)) return;
      for (const r of rows) {
        if (r?.id && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          rawDbCourses.push(r);
        }
      }
    };

    const relevantPrioRules = priorityUniversities.filter(
      (r) => !preferredDestination || r.country.toLowerCase() === preferredDestination.toLowerCase()
    );

    const lvlClause = (() => {
      const l = targetLevel.toLowerCase();
      if (!l) return null;
      if (l.includes('mba')) return 'degree_level.ilike.%mba%,program_name.ilike.%mba%,degree_level.ilike.%master%';
      if (l.includes('master') || l.includes('phd')) return 'degree_level.ilike.%master%,degree_level.ilike.%postgraduate%,program_name.ilike.%msc%';
      if (l.includes('pg diploma')) return 'degree_level.ilike.%pg diploma%,program_name.ilike.%pg diploma%,program_name.ilike.%postgraduate diploma%';
      if (l.includes('undergraduate') || l.includes('bachelor')) return 'degree_level.ilike.%bachelor%,degree_level.ilike.%undergraduate%';
      return null;
    })();

    // Fetch Admin Priority university courses first so they are always in candidate pool
    if (relevantPrioRules.length > 0) {
      const prioUniOr = relevantPrioRules
        .slice(0, 15)
        .map((r) => sanitizeSearchQuery(r.university_name))
        .filter((n) => n.length >= 3)
        .map((n) => `name.ilike.%${n}%`)
        .join(',');
      if (prioUniOr) {
        let qPrio = (supabase.from('courses') as any)
          .select(innerCourseSelect)
          .or(prioUniOr, { foreignTable: 'universities' })
          .limit(60);
        if (preferredDestination) {
          const countryOrClause = getCountrySearchVariants(preferredDestination)
            .map((v) => `country.ilike.${v}`)
            .join(',');
          qPrio = qPrio.or(countryOrClause, { foreignTable: 'universities' });
        }
        const { data: prioCourseRows } = await qPrio;
        appendRows(prioCourseRows);
      }
    }

    if (preferredDestination) {
      const variants = getCountrySearchVariants(preferredDestination);
      const countryOrClause = variants.map((v) => `country.ilike.${v}`).join(',');

      // 1. Focused title search + degree level inside the chosen country
      if (coursePreference) {
        const terms = expandSearchTerms(coursePreference)
          .map((t) => sanitizeSearchQuery(t))
          .filter((t) => t.length >= 2)
          .slice(0, 4);

        if (terms.length > 0) {
          const titleClauses = terms.map((t) => `program_name.ilike.%${t}%`).join(',');
          let qTitle = (supabase.from('courses') as any)
            .select(innerCourseSelect)
            .or(countryOrClause, { foreignTable: 'universities' })
            .or(titleClauses)
            .order('average_graduate_salary', { ascending: false })
            .limit(150);
          if (lvlClause) qTitle = qTitle.or(lvlClause);
          const { data: titleRows } = await qTitle;
          appendRows(titleRows);

          if (rawDbCourses.length < 20) {
            const { data: anyLevelTitleRows } = await (supabase.from('courses') as any)
              .select(innerCourseSelect)
              .or(countryOrClause, { foreignTable: 'universities' })
              .or(titleClauses)
              .order('average_graduate_salary', { ascending: false })
              .limit(100);
            appendRows(anyLevelTitleRows);
          }
        }
      }

      // 2. Broad country + target level fetch if needed
      if (rawDbCourses.length < 24) {
        let broadQuery = (supabase.from('courses') as any)
          .select(innerCourseSelect)
          .or(countryOrClause, { foreignTable: 'universities' })
          .order('average_graduate_salary', { ascending: false })
          .limit(160);

        if (lvlClause) broadQuery = broadQuery.or(lvlClause);
        if (budgetEur > 0) {
          broadQuery = broadQuery.lte('tuition_fees_eur', Math.round(budgetEur * 1.35));
        }

        const { data: broadRows } = await broadQuery;
        appendRows(broadRows);

        if (rawDbCourses.length < 12 && (budgetEur > 0 || lvlClause)) {
          const { data: noBudgetRows } = await (supabase.from('courses') as any)
            .select(innerCourseSelect)
            .or(countryOrClause, { foreignTable: 'universities' })
            .order('tuition_fees_eur', { ascending: true })
            .limit(120);
          appendRows(noBudgetRows);
        }
      }
    } else {
      if (coursePreference) {
        const terms = expandSearchTerms(coursePreference)
          .map((t) => sanitizeSearchQuery(t))
          .filter((t) => t.length >= 2)
          .slice(0, 4);
        if (terms.length > 0) {
          const titleClauses = terms.map((t) => `program_name.ilike.%${t}%`).join(',');
          const { data: subjGlobal } = await (supabase.from('courses') as any)
            .select(innerCourseSelect)
            .or(titleClauses)
            .order('average_graduate_salary', { ascending: false })
            .limit(150);
          appendRows(subjGlobal);
        }
      }

      if (rawDbCourses.length < 24) {
        let globalQuery = (supabase.from('courses') as any)
          .select(innerCourseSelect)
          .order('average_graduate_salary', { ascending: false })
          .limit(160);
        if (budgetEur > 0) {
          globalQuery = globalQuery.lte('tuition_fees_eur', Math.round(budgetEur * 1.35));
        }
        const { data: globalCourses } = await globalQuery;
        appendRows(globalCourses);
      }
    }

    // Score, classify Public/Private & rank DB candidates
    const mappedLevel = mapLevelToCourseType(targetLevel);
    const expandedQueryTerms = coursePreference ? expandSearchTerms(coursePreference) : [];
    const scoredDb = rawDbCourses
      .map((c: any) => {
        const normalized = {
          ...c,
          eligibility_rules: Array.isArray(c.eligibility_rules) ? c.eligibility_rules[0] : c.eligibility_rules,
        };
        const uniName = normalized.university?.name || '';
        const uniCountry = normalized.university?.country || '';
        const sector = classifyUniversityType(uniName, uniCountry, undefined, priorityUniversities);
        const prioMatch = getPriorityUniversityMatch(uniName, uniCountry, priorityUniversities);

        const courseType = normalizeCourseType(normalized);
        const baseAcademicFit = calculateMatchScore(
          normalized.eligibility_rules,
          {
            twelfth_percent: twelfthPercent,
            degree_percent: bachelorPercent,
            ielts_score: effectiveIelts || undefined,
            has_moi: hasMoi,
            work_experience_months: workExpMonths,
          },
          mappedLevel || courseType
        );
        let score = Math.round(baseAcademicFit * 0.78);

        if (expandedQueryTerms.length > 0) {
          const lowerTitle = String(normalized.program_name || '').toLowerCase();
          if (expandedQueryTerms.some((t) => lowerTitle.includes(t))) {
            score += 18;
          } else if (matchesSmartSearch(normalized, coursePreference)) {
            score += 3;
          } else {
            score -= 18;
          }
        } else {
          score += 10;
        }

        if (targetLevel) {
          const lowerTarget = targetLevel.toLowerCase();
          const lowerTitle = String(normalized.program_name || '').toLowerCase();
          const lowerDeg = String(normalized.degree_level || '').toLowerCase();
          if (lowerTarget === 'mba') {
            score += lowerTitle.includes('mba') || lowerDeg.includes('mba') ? 10 : -22;
          } else if (mappedLevel) {
            score += courseType === mappedLevel ? 8 : -26;
          }
        }

        if (budgetEur > 0) {
          if ((normalized.tuition_fees_eur || 0) <= budgetEur) {
            score += 5;
          } else if ((normalized.tuition_fees_eur || 0) > budgetEur * 1.25) {
            score -= 15;
          }
        }

        if (targetIntake && Array.isArray(normalized.intake_months)) {
          const intakeToken = targetIntake.toLowerCase().split(/[\s/]+/)[0];
          if (
            intakeToken &&
            normalized.intake_months.some((m: string) => m.toLowerCase().includes(intakeToken))
          ) {
            score += 4;
          }
        }

        if (backlogs > 5) score -= 8;
        else if (backlogs > 2) score -= 3;
        if (studyGapYears > 5) score -= 5;
        if (prioMatch.isPriority) score += 25;

        const clampedScore = Math.min(99, Math.max(48, Math.round(score)));
        return {
          course: normalized,
          score: clampedScore,
          courseType,
          sector,
          isPriority: prioMatch.isPriority,
          priorityRank: prioMatch.rank,
        };
      })
      .filter((entry) => sectorFilter === 'all' || entry.sector === sectorFilter);

    scoredDb.sort((a, b) => {
      const pDiff = (a.isPriority ? 0 : 1) - (b.isPriority ? 0 : 1);
      if (pDiff !== 0) return pDiff;
      if (a.isPriority && b.isPriority && a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return b.score - a.score;
    });

    const topDbCandidates = scoredDb.slice(0, 25);
    const destIntel = getCountryVisaIntel(preferredDestination || undefined, targetLevel || undefined);

    // Step B: Multi-provider AI Hybrid Matcher / Country Discovery
    const studentProfileSummary = {
      preferred_destination: preferredDestination || 'Any Best-Fit Country',
      institution_type_preference: sectorFilter === 'all' ? 'Both Public & Private' : `${sectorFilter} Universities Only`,
      target_degree_level: targetLevel || 'Best Fit (based on academics)',
      course_interest: coursePreference || 'Open to high-demand programmes',
      budget_eur: budgetEur || 'Flexible / Not specified',
      plus2_twelfth_percent: twelfthPercent ?? 'Not provided',
      plus2_stream: plus2Stream || 'Not provided',
      bachelor_degree: bachelorDegree || 'Not provided',
      bachelor_percent: bachelorPercent ?? 'Not provided',
      backlogs,
      masters_percent: masterPercent ?? 'Not provided',
      ielts_equivalent: effectiveIelts || 'Not provided',
      pte_score: rawPte || 'Not provided',
      gre_gmat: greGmat || 'Not provided',
      other_language_or_moi: otherLanguage || 'Not provided',
      work_experience_months: workExpMonths,
      study_gap_years: studyGapYears,
      age: age ?? 'Not provided',
      marital_status: maritalStatus || 'Not provided',
      target_intake: targetIntake || 'Any upcoming intake',
      specific_enquiry: specificEnquiry || 'None',
    };

    const compactCatalog = topDbCandidates.map((item) => {
      const resolvedCountry = item.course.university?.country || preferredDestination || 'Global';
      return {
        course_id: item.course.id,
        program_name: item.course.program_name,
        university_name: item.course.university?.name || 'Accredited University',
        country: resolvedCountry,
        institution_type: item.sector,
        is_priority_partner: item.isPriority,
        degree_level: item.course.degree_level,
        category: item.course.category || 'General',
        tuition_fees_eur: item.course.tuition_fees_eur || 0,
        duration_months: item.course.duration_months || 24,
        intake_months: item.course.intake_months || ['September'],
        stay_back_visa_years: resolveOfficialStayBackYears(
          resolvedCountry,
          item.course.degree_level,
          item.course.program_name,
          item.course.stay_back_visa_years,
          item.course.category
        ),
        average_graduate_salary: item.course.average_graduate_salary || destIntel.avgSalaryEur,
        min_ielts: item.course.eligibility_rules?.min_ielts ?? 6.0,
        english_policy: hasMoi ? 'MOI_ACCEPTED' : 'IELTS_TOEFL',
        course_url: item.course.course_url,
        precomputed_score: item.score,
      };
    });

    const prioPartnerHint =
      relevantPrioRules.length > 0
        ? `ADMIN PRIORITY PARTNER UNIVERSITIES (must rank FIRST when eligible): ${relevantPrioRules
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 12)
            .map((p) => `#${p.rank} ${p.university_name} (${p.country})`)
            .join(', ')}.`
        : '';

    const sectorRuleText =
      sectorFilter === 'all'
        ? 'Include a balanced mix of Public and Private accredited universities.'
        : `CRITICAL RULE: Include ONLY ${sectorFilter.toUpperCase()} universities ("institution_type": "${sectorFilter}").`;

    const hasEnoughDb = Boolean(preferredDestination && topDbCandidates.length >= 6);
    const destinationDirective = preferredDestination
      ? hasEnoughDb
        ? `CRITICAL RULE: The student selected "${preferredDestination}". ALL 12 recommendations MUST have "country": "${preferredDestination}". ${sectorRuleText} ${prioPartnerHint} Prioritize items from VERIFIED_CATALOGUE first (keeping their exact course_id and "is_verified_db": true, especially priority partners). Supplement up to 12 total with real, well-known accredited English-taught programmes in "${preferredDestination}" (use course_id "ai-rec-N" and "is_verified_db": false).`
        : `CRITICAL RULE: The student explicitly selected "${preferredDestination}". Return 12 REAL, well-known accredited universities and English-taught programmes EXCLUSIVELY in "${preferredDestination}" ("country": "${preferredDestination}") tailored to the student's marks, backlogs, language score/MOI, budget, work experience, and subject preference. ${sectorRuleText} ${prioPartnerHint} Use any matching VERIFIED_CATALOGUE rows first, and provide realistic annual tuition in EUR and real official university URLs starting with https://.`
      : `Suggest the 12 BEST-FITTING international programmes matching the student's marks, budget, backlogs, and language scores across verified destinations. ${sectorRuleText} ${prioPartnerHint} Prefer VERIFIED_CATALOGUE items when they fit well (keeping their exact course_id and "is_verified_db": true), or supplement with real accredited programmes up to 12.`;

    const aiPrompt = `You are a senior international admissions & visa counselor for Orbis (The Global Course Finder).

STUDENT PROFILE:
${JSON.stringify(studentProfileSummary, null, 2)}

${preferredDestination ? `2026 VISA & STAY-BACK BASELINE (${preferredDestination}): ${destIntel.visaSummary}\n` : ''}${compactCatalog.length > 0 ? `VERIFIED_CATALOGUE (use exact course_id when choosing from this list):\n${JSON.stringify(compactCatalog, null, 2)}` : 'VERIFIED_CATALOGUE: [] (No local rows for this destination — use your knowledge of real accredited universities in the chosen country)'}

${destinationDirective}

Evaluate eligibility strictly and return strictly valid JSON with exactly 12 recommendations following this schema:
{
  "eligibility_verdict": "2-3 concise sentences summarizing strengths, risks (backlogs/gap/budget/IELTS), and overall admission outlook.",
  "country_strategy": "1-2 concise sentences explaining why this destination's tuition, MOI/IELTS rules, and post-study visa fit this student.",
  "recommendations": [
    {
      "course_id": "exact UUID from VERIFIED_CATALOGUE or ai-rec-0",
      "program_name": "string",
      "university_name": "string",
      "country": "string",
      "institution_type": "Public | Private",
      "degree_level": "Master | Bachelor | MBA | PG Diploma | PhD",
      "category": "string",
      "tuition_fees_eur": 8500,
      "duration_months": 24,
      "intake_months": ["September", "February"],
      "stay_back_visa_years": 1.5,
      "average_graduate_salary": 42000,
      "min_ielts": 6.0,
      "english_policy": "IELTS_TOEFL | MOI_ACCEPTED | WAIVED",
      "match_score": 88,
      "admission_chance": "High | Good | Stretch",
      "why_it_fits": "1-2 personalized sentences explaining why this specific course suits this student's marks, budget, and goals.",
      "course_url": "https://...",
      "is_verified_db": true
    }
  ]
}`;

    const dbById = new Map<string, any>();
    topDbCandidates.forEach((item) => {
      dbById.set(String(item.course.id), item.course);
    });

    let aiRecommendations: AiRecommendationItem[] = [];
    let eligibilityVerdict = '';
    let countryStrategy = '';

    const rawAiJson = await callGroqFreeJson(aiPrompt);
    if (rawAiJson) {
      try {
        const parsed = JSON.parse(rawAiJson);
        eligibilityVerdict = String(parsed.eligibility_verdict || '').trim();
        countryStrategy = String(parsed.country_strategy || '').trim();

        const rawList: any[] = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
        aiRecommendations = rawList
          .slice(0, 12)
          .map((item, idx) => {
            const matchedDb = item.course_id ? dbById.get(String(item.course_id)) : undefined;
            const resolvedCountry =
              preferredDestination ||
              normalizeCountryName(String(item.country || matchedDb?.university?.country || '')) ||
              'Germany';
            const resolvedLevel = String(item.degree_level || matchedDb?.degree_level || targetLevel || 'Master');
            const cIntel = getCountryVisaIntel(resolvedCountry, resolvedLevel);

            const uniName = String(item.university_name || matchedDb?.university?.name || 'Accredited University').trim();
            const prioMatch = getPriorityUniversityMatch(uniName, resolvedCountry, priorityUniversities);
            const rawItemSec = String(item.institution_type || '').trim();
            const heuristicSec = classifyUniversityType(uniName, resolvedCountry, undefined, priorityUniversities);
            const resolvedSector: UniversitySector =
              prioMatch.rule?.sector_override === 'Public' ||
              prioMatch.rule?.sector_override === 'Private'
                ? prioMatch.rule.sector_override
                : rawItemSec === 'Public' || rawItemSec === 'Private'
                ? (rawItemSec as UniversitySector)
                : heuristicSec;

            const tuition = Number(item.tuition_fees_eur ?? matchedDb?.tuition_fees_eur);
            const safeTuition =
              Number.isFinite(tuition) && tuition >= 0 ? Math.min(200_000, Math.round(tuition)) : 5000;

            const salary = Number(item.average_graduate_salary ?? matchedDb?.average_graduate_salary) || cIntel.avgSalaryEur;
            const safeSalary = Math.min(300_000, Math.max(12_000, Math.round(salary)));

            const rawStayBack = Number(item.stay_back_visa_years ?? matchedDb?.stay_back_visa_years);
            const resolvedProgName = String(item.program_name || matchedDb?.program_name || 'International Degree Programme').trim();
            const resolvedCat = String(item.category || matchedDb?.category || coursePreference || 'Interdisciplinary Studies');
            const safeStayBack = resolveOfficialStayBackYears(
              resolvedCountry,
              resolvedLevel,
              resolvedProgName,
              Number.isFinite(rawStayBack) && rawStayBack >= 0 ? Math.min(6, rawStayBack) : undefined,
              resolvedCat
            );

            const rawMatch = Number(item.match_score) || 88 - idx * 2;
            const matchScore = Math.min(99, Math.max(50, Math.round(rawMatch)));

            const rawChance = String(item.admission_chance || '').trim();
            const admissionChance: 'High' | 'Good' | 'Stretch' =
              rawChance === 'High' || rawChance === 'Good' || rawChance === 'Stretch'
                ? rawChance
                : deriveAdmissionChance(matchScore);

            const cleanUrl =
              sanitizeHttpUrl(String(item.course_url || matchedDb?.course_url || '')) ||
              `https://www.google.com/search?q=${encodeURIComponent(`${uniName} ${item.program_name || ''} ${resolvedCountry}`)}`;

            const whyItFits =
              String(item.why_it_fits || '').trim() ||
              `Strong match for your profile in ${resolvedCountry} (${resolvedSector}) with ~€${safeTuition.toLocaleString()} annual tuition and ${safeStayBack} yr post-study stay-back.`;

            const roiRatio = Number(((safeSalary / (Math.max(safeTuition, 2000) + 12000)) * 2.5).toFixed(1));

            return {
              course_id: matchedDb ? String(matchedDb.id) : `ai-rec-${Date.now()}-${idx}`,
              program_name: String(item.program_name || matchedDb?.program_name || 'International Degree Programme').trim(),
              university_name: uniName,
              country: resolvedCountry,
              degree_level: resolvedLevel,
              category: String(item.category || matchedDb?.category || coursePreference || 'Interdisciplinary Studies'),
              institution_type: resolvedSector,
              is_priority_university: prioMatch.isPriority,
              priority_rank: prioMatch.isPriority ? prioMatch.rank : null,
              tuition_fees_eur: safeTuition,
              duration_months: Number(item.duration_months ?? matchedDb?.duration_months) || 24,
              intake_months:
                Array.isArray(item.intake_months) && item.intake_months.length > 0
                  ? item.intake_months.map((m: any) => String(m)).slice(0, 4)
                  : Array.isArray(matchedDb?.intake_months) && matchedDb.intake_months.length > 0
                  ? matchedDb.intake_months
                  : ['September', 'February'],
              stay_back_visa_years: safeStayBack,
              average_graduate_salary: safeSalary,
              min_ielts: Number(item.min_ielts ?? matchedDb?.eligibility_rules?.min_ielts) || 6.0,
              english_policy: String(
                item.english_policy || (hasMoi ? 'MOI_ACCEPTED' : 'IELTS_TOEFL')
              ),
              match_score: matchScore,
              fit_score: matchScore,
              admission_chance: admissionChance,
              why_it_fits: whyItFits,
              rationale: whyItFits,
              course_url: cleanUrl,
              is_verified_db: Boolean(matchedDb || item.is_verified_db === true),
              roi_ratio: Math.max(roiRatio, 2.5),
              settlement_probability_percent: Math.min(96, Math.max(70, matchScore)),
            };
          })
          .filter((r) => sectorFilter === 'all' || r.institution_type === sectorFilter);
      } catch {
        aiRecommendations = [];
      }
    }

    // Step C: Deterministic DB + Curated Country Fallback (guarantees 10-12+ options reliably!)
    if (aiRecommendations.length === 0) {
      aiRecommendations = topDbCandidates.slice(0, 12).map(({ course: c, score, sector, isPriority, priorityRank }, idx) => {
        const cCountry =
          preferredDestination || normalizeCountryName(c.university?.country || '') || 'United Kingdom';
        const cIntel = getCountryVisaIntel(cCountry, c.degree_level);
        const tuition = Number(c.tuition_fees_eur) || 0;
        const salary = Number(c.average_graduate_salary) || cIntel.avgSalaryEur;
        const stayBack = resolveOfficialStayBackYears(
          cCountry,
          c.degree_level,
          c.program_name,
          c.stay_back_visa_years !== undefined ? Number(c.stay_back_visa_years) : undefined,
          c.category
        );
        const matchScore = Math.min(99, Math.max(52, score - Math.floor(idx / 2)));
        const uniName = c.university?.name || 'Accredited Institution';
        const why = `${uniName} (${sector} · ${cCountry}) matches your academic background${
          budgetEur > 0 ? ` and €${budgetEur.toLocaleString()} budget` : ''
        } with ${stayBack} year(s) post-study stay-back.`;
        const roiRatio = Number(((salary / (Math.max(tuition, 2000) + 12000)) * 2.5).toFixed(1));

        return {
          course_id: String(c.id),
          program_name: c.program_name,
          university_name: uniName,
          country: cCountry,
          degree_level: c.degree_level || targetLevel || 'Master',
          category: c.category || 'General',
          institution_type: sector,
          is_priority_university: isPriority,
          priority_rank: isPriority ? priorityRank : null,
          tuition_fees_eur: tuition,
          duration_months: Number(c.duration_months) || 24,
          intake_months: Array.isArray(c.intake_months) && c.intake_months.length > 0 ? c.intake_months : ['September'],
          stay_back_visa_years: stayBack,
          average_graduate_salary: salary,
          min_ielts: Number(c.eligibility_rules?.min_ielts) || 6.0,
          english_policy: hasMoi ? 'MOI_ACCEPTED' : 'IELTS_TOEFL',
          match_score: matchScore,
          fit_score: matchScore,
          admission_chance: deriveAdmissionChance(matchScore),
          why_it_fits: why,
          rationale: why,
          course_url: sanitizeHttpUrl(c.course_url || '') || 'https://study-abroad.edu',
          is_verified_db: true,
          roi_ratio: Math.max(roiRatio, 2.5),
          settlement_probability_percent: Math.min(95, Math.max(72, matchScore)),
        };
      });
    }

    // Supplement with curated accredited programmes whenever fewer than 10 options matched
    if (aiRecommendations.length < 10) {
      const targetCuratedCountry = preferredDestination || 'United Kingdom';
      const curated = getCuratedFallbackCourses({
        country: targetCuratedCountry,
        targetLevel,
        coursePreference,
        budgetEur,
        twelfthPercent,
        bachelorPercent,
        effectiveIelts,
        hasMoi,
        backlogs,
        sector: sectorFilter,
        priorityUniversities,
        maxResults: 12,
      });
      const existingTitles = new Set(
        aiRecommendations.map((r) => `${r.university_name}::${r.program_name}`.toLowerCase())
      );
      for (const item of curated) {
        if (aiRecommendations.length >= 12) break;
        const k = `${item.university_name}::${item.program_name}`.toLowerCase();
        if (!existingTitles.has(k)) {
          existingTitles.add(k);
          aiRecommendations.push(item);
        }
      }
    }

    // Final sort keeping Admin Priority Universities first
    aiRecommendations.sort((a, b) => {
      const pDiff = (a.is_priority_university ? 0 : 1) - (b.is_priority_university ? 0 : 1);
      if (pDiff !== 0) return pDiff;
      if (a.is_priority_university && b.is_priority_university) {
        return (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999);
      }
      return (b.match_score || 0) - (a.match_score || 0);
    });

    if (!eligibilityVerdict) {
      const scoreSummary = [
        bachelorPercent ? `Bachelor: ${bachelorPercent}%` : null,
        twelfthPercent ? `12th: ${twelfthPercent}%` : null,
        effectiveIelts ? `IELTS eq.: ${effectiveIelts}` : hasMoi ? 'MOI Available' : null,
        backlogs > 0 ? `Backlogs: ${backlogs}` : null,
        budgetEur > 0 ? `Budget: €${budgetEur.toLocaleString()}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      eligibilityVerdict = `Evaluated your profile (${
        scoreSummary || 'standard entry criteria'
      }) for ${
        preferredDestination || 'top international universities'
      }. Ranked ${aiRecommendations.length} tailored programmes by eligibility fit, tuition budget, and graduate stay-back ROI.`;
    }

    if (!countryStrategy) {
      countryStrategy = destIntel.visaSummary;
    }

    return NextResponse.json({
      success: true,
      destination: preferredDestination || 'Global Best Fit',
      eligibility_verdict: eligibilityVerdict,
      country_strategy: countryStrategy,
      visa_summary: destIntel.visaSummary,
      recommendations: aiRecommendations.slice(0, 12),
    });
  } catch (error: any) {
    console.error('Error in /api/ai-recommend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI recommendations' },
      { status: 500 }
    );
  }
}
