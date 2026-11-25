import { NextRequest, NextResponse } from 'next/server';
import { callGroqFreeJson } from '@/lib/groq-client';
import { getCountryVisaIntel } from '@/lib/country-visa-intel';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { getSiteSettingsServer } from '@/lib/site-settings-server';
import { getCuratedFallbackCourses } from '@/lib/country-curated-fallback';
import { normalizeCountryName } from '@/lib/countries';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  SectorFilter,
  UniversitySector,
} from '@/lib/university-classification';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      country: rawCountry = '',
      query: rawQuery = '',
      courseTypes: rawCourseTypes = [],
      sector: rawSector = 'all',
      excludeUniversities: rawExclude = [],
    } = body as {
      country?: string;
      query?: string;
      courseTypes?: string[];
      sector?: string;
      excludeUniversities?: string[];
    };

    const normalizedDest = normalizeCountryName(String(rawCountry || '').trim());
    const country = normalizedDest || String(rawCountry || '').trim().slice(0, 80);
    const query = String(rawQuery || '').trim().slice(0, 150);
    const courseTypes = Array.isArray(rawCourseTypes)
      ? rawCourseTypes.slice(0, 6).map((t) => String(t).trim().slice(0, 50))
      : [];
    const sectorFilter: SectorFilter =
      String(rawSector).toLowerCase() === 'public'
        ? 'Public'
        : String(rawSector).toLowerCase() === 'private'
        ? 'Private'
        : 'all';
    const excludeSet = new Set(
      Array.isArray(rawExclude)
        ? rawExclude.slice(0, 50).map((u) => String(u).trim().toLowerCase()).filter(Boolean)
        : []
    );

    const targetCountry = (country || query || '').trim();
    if (!targetCountry) {
      return NextResponse.json({ success: false, error: 'Country or search query is required' }, { status: 400 });
    }

    const { priorityUniversities } = await getSiteSettingsServer();
    const intel = getCountryVisaIntel(country || undefined);
    const levelHint = courseTypes.length > 0 ? courseTypes.join(', ') : 'Bachelor and Master';

    const countryPriorityNames = priorityUniversities
      .filter((p) => !country || p.country.toLowerCase() === country.toLowerCase())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10)
      .map((p) => `${p.university_name} (${p.country})`);

    const sectorDirective =
      sectorFilter === 'Public'
        ? 'ONLY include PUBLIC / state-funded universities.'
        : sectorFilter === 'Private'
        ? 'ONLY include PRIVATE / independent universities or business schools.'
        : 'Include a diverse mix of both PUBLIC and PRIVATE accredited universities.';

    const excludeDirective =
      excludeSet.size > 0
        ? `Do NOT repeat these already-shown universities: ${Array.from(excludeSet).slice(0, 20).join(', ')}.`
        : '';

    const priorityDirective =
      countryPriorityNames.length > 0
        ? `Prioritize including matching programmes from these partner universities FIRST if relevant: ${countryPriorityNames.join(', ')}.`
        : '';

    const prompt = `You are a study-abroad university & course database assistant.
The user is searching for study programmes in:
Country / Query: "${country ? `${country}${query ? ` - ${query}` : ''}` : query}"
Preferred Level: ${levelHint}
Institution Type Requirement: ${sectorDirective}
${priorityDirective}
${excludeDirective}

Return strictly a valid JSON object with key "courses" containing an array of 15 real, well-known accredited universities and English-taught programmes matching this request:
{
  "courses": [
    {
      "program_name": string (real programme title),
      "university_name": string (real university name),
      "country": string (exact country name, e.g. "Poland"),
      "institution_type": "Public" | "Private",
      "degree_level": "Bachelor" | "Master" | "MBA",
      "category": "Computer Science & AI" | "Data Science" | "Engineering" | "Business & Management" | "Healthcare & Life Sciences",
      "duration_months": number (e.g. 36 or 24 or 12),
      "tuition_fees_eur": number (realistic annual international tuition in EUR),
      "intake_months": string[] (e.g. ["October", "February"]),
      "course_url": string (real official university website URL starting with https://),
      "stay_back_visa_years": number (post-study stay-back in years for this degree level),
      "average_graduate_salary": number (realistic annual graduate salary in EUR),
      "min_12th_percent": number,
      "min_degree_percent": number,
      "min_ielts": number,
      "english_requirement_type": "IELTS_TOEFL" | "MOI_ACCEPTED"
    }
  ]
}`;

    const content = await callGroqFreeJson(prompt);
    let rawList: any[] = [];
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.courses)) {
          rawList = parsed.courses;
        }
      } catch {
        rawList = [];
      }
    }

    const mappedFromAi = rawList
      .map((item, idx) => {
        const uniName = String(item.university_name || 'Accredited University').trim();
        const itemCountry =
          normalizeCountryName(String(item.country || country || '')) ||
          country ||
          'Global';
        const prioMatch = getPriorityUniversityMatch(uniName, itemCountry, priorityUniversities);
        const rawSec = String(item.institution_type || '').trim();
        const heuristicSector = classifyUniversityType(uniName, itemCountry, undefined, priorityUniversities);
        const resolvedSector: UniversitySector =
          prioMatch.rule?.sector_override === 'Public' ||
          prioMatch.rule?.sector_override === 'Private'
            ? prioMatch.rule.sector_override
            : rawSec === 'Public' || rawSec === 'Private'
            ? (rawSec as UniversitySector)
            : heuristicSector;

        return {
          id: `ai-${Date.now()}-${idx}`,
          university_id: `ai-uni-${idx}`,
          program_name: String(item.program_name || 'International Degree Programme').trim(),
          degree_level: String(item.degree_level || 'Master'),
          category: String(item.category || 'Business & Management'),
          duration_months: Number(item.duration_months) || 24,
          tuition_fees_eur: Number(item.tuition_fees_eur) ?? 3500,
          intake_months:
            Array.isArray(item.intake_months) && item.intake_months.length > 0
              ? item.intake_months
              : ['September'],
          course_url: sanitizeHttpUrl(String(item.course_url || '')) || 'https://study-abroad.edu',
          stay_back_visa_years: Number(item.stay_back_visa_years) || intel.stayBackYears,
          average_graduate_salary: Number(item.average_graduate_salary) || intel.avgSalaryEur,
          created_at: new Date().toISOString(),
          is_ai_discovered: true,
          institution_type: resolvedSector,
          is_priority_university: prioMatch.isPriority,
          priority_rank: prioMatch.isPriority ? prioMatch.rank : null,
          priority_note: prioMatch.rule?.note || null,
          university: {
            id: `ai-uni-${idx}`,
            name: uniName,
            country: itemCountry,
            global_ranking: 250,
            campus_locations: [itemCountry],
          },
          eligibility_rules: {
            id: `ai-rule-${idx}`,
            course_id: `ai-${Date.now()}-${idx}`,
            min_12th_percent: Number(item.min_12th_percent) || 55,
            min_degree_percent: Number(item.min_degree_percent) || 55,
            min_ielts: Number(item.min_ielts) || 6.0,
            min_toefl: 85,
            interview_required: false,
            work_experience_months: 0,
            english_requirement_type: item.english_requirement_type || 'IELTS_TOEFL',
          },
        };
      })
      .filter((c) => {
        if (sectorFilter !== 'all' && c.institution_type !== sectorFilter) return false;
        if (excludeSet.has(c.university.name.toLowerCase())) return false;
        return true;
      });

    // Guarantee rich (>6) results even when LLMs are unconfigured/rate-limited or filtered
    let courses = [...mappedFromAi];
    if (courses.length < 10) {
      const curated = getCuratedFallbackCourses({
        country: country || 'United Kingdom',
        targetLevel: courseTypes[0],
        coursePreference: query,
        sector: sectorFilter,
        priorityUniversities,
        maxResults: 15,
      });

      const seenKeys = new Set(
        courses.map((c) => `${c.university.name}::${c.program_name}`.toLowerCase())
      );

      for (let i = 0; i < curated.length; i++) {
        if (courses.length >= 15) break;
        const item = curated[i];
        if (excludeSet.has(item.university_name.toLowerCase())) continue;
        const key = `${item.university_name}::${item.program_name}`.toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const prioMatch = getPriorityUniversityMatch(
          item.university_name,
          item.country,
          priorityUniversities
        );
        const courseId = `curated-${Date.now()}-${i}`;
        courses.push({
          id: courseId,
          university_id: `curated-uni-${i}`,
          program_name: item.program_name,
          degree_level: item.degree_level,
          category: item.category,
          duration_months: item.duration_months,
          tuition_fees_eur: item.tuition_fees_eur,
          intake_months: item.intake_months,
          course_url: item.course_url,
          stay_back_visa_years: item.stay_back_visa_years,
          average_graduate_salary: item.average_graduate_salary,
          created_at: new Date().toISOString(),
          is_ai_discovered: true,
          institution_type: item.institution_type || 'Public',
          is_priority_university: Boolean(item.is_priority_university || prioMatch.isPriority),
          priority_rank: item.priority_rank ?? (prioMatch.isPriority ? prioMatch.rank : null),
          priority_note: prioMatch.rule?.note || null,
          university: {
            id: `curated-uni-${i}`,
            name: item.university_name,
            country: item.country,
            global_ranking: 220,
            campus_locations: [item.country],
          },
          eligibility_rules: {
            id: `curated-rule-${i}`,
            course_id: courseId,
            min_12th_percent: item.min_12th_percent,
            min_degree_percent: item.min_degree_percent,
            min_ielts: item.min_ielts,
            min_toefl: 85,
            interview_required: false,
            work_experience_months: 0,
            english_requirement_type: item.english_policy,
          },
        });
      }
    }

    courses.sort((a, b) => {
      const pDiff = (a.is_priority_university ? 0 : 1) - (b.is_priority_university ? 0 : 1);
      if (pDiff !== 0) return pDiff;
      if (a.is_priority_university && b.is_priority_university) {
        return (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999);
      }
      return 0;
    });

    return NextResponse.json({ success: true, courses: courses.slice(0, 15) });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to discover courses' },
      { status: 500 }
    );
  }
}
