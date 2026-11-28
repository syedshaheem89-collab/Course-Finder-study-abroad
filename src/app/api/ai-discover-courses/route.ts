import { NextRequest, NextResponse } from 'next/server';
import { callGroqFreeJson } from '@/lib/groq-client';
import { getCountryVisaIntel, resolveOfficialStayBackYears } from '@/lib/country-visa-intel';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { getSiteSettingsServer } from '@/lib/site-settings-server';
import { searchCuratedCatalogue } from '@/lib/country-curated-fallback';
import { normalizeCountryName } from '@/lib/countries';
import { normalizeCourseType } from '@/lib/course-utils';
import { matchesSmartSearch } from '@/lib/search-synonyms';
import {
  diversifyGlobalCourses,
  extractExplicitCountryFromQuery,
  isExplicitUniversityQuery,
} from '@/lib/course-diversity';
import {
  applyUniversityDiversityCap,
  sortCoursesBySearchEngineRank,
} from '@/lib/course-search-ranker';
import {
  getCourseVerificationCache,
  isUsableVerifiedSnapshot,
  makeCourseVerifyKey,
} from '@/lib/course-verification-cache';
import { extractDomainHost } from '@/lib/live-course-verifier';
import {
  resolveUniversityDomainFree,
  searchDomainSitemapCourses,
} from '@/lib/sitemap-course-matcher';
import {
  matchesTeachingLanguageFilter,
  normalizeTeachingLanguage,
  extractLanguageProficiency,
} from '@/lib/teaching-language';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  matchesSubjectGroup,
  SectorFilter,
  UniversitySector,
} from '@/lib/university-classification';
import {
  buildExpertCounselorPromptDirectives,
  getStatutoryPublicTuition,
} from '@/lib/expert-country-rules';
import { fetchStudyinfoFinlandCourses } from '@/lib/external-search-agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      country: rawCountry = '',
      query: rawQuery = '',
      subject: rawSubject = '',
      intake: rawIntake = 'all',
      maxTuition: rawMaxTuition = 100000,
      courseTypes: rawCourseTypes = [],
      sector: rawSector = 'all',
      language: rawLanguage = 'all',
      excludeUniversities: rawExclude = [],
    } = body as {
      country?: string;
      query?: string;
      subject?: string;
      intake?: string;
      maxTuition?: number;
      courseTypes?: string[];
      sector?: string;
      language?: string;
      excludeUniversities?: string[];
    };

    const normalizedDest = normalizeCountryName(String(rawCountry || '').trim());
    const country = normalizedDest || String(rawCountry || '').trim().slice(0, 80);
    const query = String(rawQuery || '').trim().slice(0, 150);
    const subject = String(rawSubject || '').trim().slice(0, 80);
    const intake = String(rawIntake || 'all').trim().slice(0, 40);
    const maxTuition = Number(rawMaxTuition || 100000);
    const courseTypes = Array.isArray(rawCourseTypes)
      ? rawCourseTypes.slice(0, 6).map((t) => String(t).trim().slice(0, 50)).filter(Boolean)
      : [];
    const sectorFilter: SectorFilter =
      String(rawSector).toLowerCase() === 'public'
        ? 'Public'
        : String(rawSector).toLowerCase() === 'private'
        ? 'Private'
        : 'all';
    const languageFilter = String(rawLanguage || 'all').trim().slice(0, 40);
    const excludeSet = new Set(
      Array.isArray(rawExclude)
        ? rawExclude.slice(0, 50).map((u) => String(u).trim().toLowerCase()).filter(Boolean)
        : []
    );

    const targetCountry = (country || query || subject || '').trim();
    if (!targetCountry) {
      return NextResponse.json({ success: false, error: 'Country or search query is required' }, { status: 400 });
    }

    const [{ priorityUniversities }, verifiedCache] = await Promise.all([
      getSiteSettingsServer(),
      getCourseVerificationCache(),
    ]);
    const verifiedByUrl = new Map<string, (typeof verifiedCache)[string]>();
    for (const snap of Object.values(verifiedCache)) {
      if (snap?.officialUrl) {
        verifiedByUrl.set(snap.officialUrl.toLowerCase(), snap);
      }
    }
    const overlayVerified = (c: any) => {
      const key = makeCourseVerifyKey(c.university?.country, c.university?.name, c.program_name);
      const snap =
        verifiedCache[key] ||
        (c.course_url ? verifiedByUrl.get(String(c.course_url).toLowerCase()) : undefined);
      if (!snap || !isUsableVerifiedSnapshot(snap)) return c;
      const matchedTitle =
        snap.matchedProgramName &&
        snap.matchedProgramName.trim().toLowerCase() !== String(c.program_name || '').trim().toLowerCase()
          ? snap.matchedProgramName.trim()
          : undefined;
      return {
        ...c,
        ...(matchedTitle ? { original_program_name: c.program_name, program_name: matchedTitle } : {}),
        course_url: snap.officialUrl || c.course_url,
        tuition_fees_eur:
          snap.tuitionFeesEur !== null && snap.tuitionFeesEur !== undefined
            ? snap.tuitionFeesEur
            : c.tuition_fees_eur,
        verified_meta: {
          verifiedAt: snap.verifiedAt,
          consensusStatus: snap.consensusStatus,
          providersUsed: snap.providersUsed,
          verifiedDomain: snap.verifiedDomain,
          officialUrl: snap.officialUrl,
          searchProvider: snap.searchProvider,
          subjectRequirements: snap.subjectRequirements,
          summary: snap.summary,
          sources: snap.sources,
          teachingLanguage: snap.teachingLanguage,
          languageProficiency: snap.languageProficiency,
          originalTuitionAmount: snap.originalTuitionAmount,
          originalTuitionCurrency: snap.originalTuitionCurrency,
          tuitionQuote: snap.tuitionQuote,
          academicYear: snap.academicYear,
          matchedProgramName: matchedTitle,
          feeVerified: Boolean(snap.tuitionFeesEur !== null && snap.tuitionFeesEur !== undefined),
          ...(snap.feeSource ? { feeSource: snap.feeSource } : {}),
          extractorVersion: snap.extractorVersion || 1,
        },
      };
    };
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
        ? `Prioritize including matching programmes from these partner universities FIRST ONLY IF that university genuinely offers a matching programme (use the university's exact real official course title, e.g. "MSc Global Public Health" if that is what it offers; NEVER invent a programme name if a partner university does not offer it — move to the next partner or accredited university with a real official course URL): ${countryPriorityNames.join(', ')}.`
        : '';

    const shouldDiversifyGlobal = !country && !extractExplicitCountryFromQuery(query);
    const diversityDirective = shouldDiversifyGlobal
      ? 'Include at most 1 programme per university and at most 2 programmes per country across diverse destinations.'
      : '';
    const queryAlignmentDirective = query
      ? `CRITICAL: Every returned "program_name" MUST directly match "${query}" (e.g. if "${query}" is Nursing, return real Nursing programmes, not unrelated Business courses).`
      : '';
    const countryAlignmentDirective = country
      ? `CRITICAL: Every returned course MUST be at a real accredited university in "${country}" ("country": "${country}").`
      : '';
    const levelAlignmentDirective =
      courseTypes.length === 1 && courseTypes[0] === 'Undergraduate'
        ? 'CRITICAL: ONLY return Bachelor / Undergraduate degrees ("degree_level": "Bachelor").'
        : courseTypes.length === 1 && courseTypes[0] === 'Masters'
        ? 'CRITICAL: ONLY return Master / MBA degrees ("degree_level": "Master" or "MBA").'
        : courseTypes.includes('UG Diploma') && !courseTypes.includes('PG Diploma')
        ? 'CRITICAL: ONLY return Undergraduate Diplomas / HNDs ("degree_level": "UG Diploma", e.g. Diploma / Higher National Diploma MQF Level 4/5).'
        : courseTypes.includes('PG Diploma') && !courseTypes.includes('UG Diploma')
        ? 'CRITICAL: ONLY return Postgraduate Diplomas ("degree_level": "PG Diploma", e.g. Postgraduate Diploma / PGDip MQF Level 7).'
        : courseTypes.includes('UG Diploma') || courseTypes.includes('PG Diploma')
        ? 'CRITICAL: ONLY return UG Diploma / HND ("degree_level": "UG Diploma") or Postgraduate Diploma ("degree_level": "PG Diploma") programmes.'
        : '';
    const languageAlignmentDirective =
      languageFilter && languageFilter.toLowerCase() !== 'all'
        ? `CRITICAL: Prioritize returning real accredited programmes whose official teaching language is ${languageFilter} (include "teaching_language": "${languageFilter}" and any required proficiency such as "${languageFilter} B2" in "language_proficiency" when non-English).`
        : 'Always accurately specify each programme\'s real teaching language ("teaching_language": "English" | "Italian" | "German" | "Polish" | "French" | "Spanish" | "Dutch" | "Swedish" | "Japanese" | "Korean" | "Bilingual") and required local language level in "language_proficiency" (e.g. "German B2" for Austria/Germany Nursing, "Italian B2" for Italian-taught Italy degrees, or null if English-only).';

    const expertCountryDirectives = country
      ? buildExpertCounselorPromptDirectives({ country, degreeLevel: levelHint })
      : '';

    const prompt = `You are a 20-year senior international study-abroad counselor and university course database assistant.
The user is searching for study programmes in:
Country / Query: "${country ? `${country}${query ? ` - ${query}` : ''}` : query || subject}"
${subject ? `Subject Group: ${subject}` : ''}
Preferred Level: ${levelHint}
Institution Type Requirement: ${sectorDirective}
${country ? `2026 Official Stay-Back Reference: ${intel.visaSummary}` : ''}
${expertCountryDirectives ? `${expertCountryDirectives}` : ''}
${queryAlignmentDirective}
${countryAlignmentDirective}
${levelAlignmentDirective}
${languageAlignmentDirective}
${priorityDirective}
${diversityDirective}
${excludeDirective}

Return strictly a valid JSON object with key "courses" containing an array of 15 real, well-known accredited universities and programmes matching this request:
{
  "courses": [
    {
      "program_name": string (real programme title),
      "university_name": string (real university name),
      "country": string (exact country name, e.g. "Poland"),
      "institution_type": "Public" | "Private",
      "degree_level": "Bachelor" | "Master" | "MBA" | "UG Diploma" | "PG Diploma" | "Certificate",
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
      "english_requirement_type": "IELTS_TOEFL" | "MOI_ACCEPTED",
      "teaching_language": "English" | "Italian" | "German" | "Polish" | "French" | "Spanish" | "Dutch" | "Swedish" | "Japanese" | "Korean" | "Bilingual",
      "language_proficiency": string | null
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
        const heuristicSector = classifyUniversityType(uniName, itemCountry, undefined, priorityUniversities);
        const resolvedSector: UniversitySector =
          prioMatch.rule?.sector_override === 'Public' ||
          prioMatch.rule?.sector_override === 'Private'
            ? prioMatch.rule.sector_override
            : heuristicSector;

        const slug = itemCountry.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const uniSlug = uniName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const courseId = `ai-${slug}-${uniSlug}-${idx}`;

        return {
          id: courseId,
          university_id: `ai-uni-${slug}-${uniSlug}`,
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
          stay_back_visa_years: resolveOfficialStayBackYears(
            itemCountry,
            String(item.degree_level || 'Master'),
            String(item.program_name || ''),
            item.stay_back_visa_years !== undefined ? Number(item.stay_back_visa_years) : undefined,
            String(item.category || '')
          ),
          average_graduate_salary: Number(item.average_graduate_salary) || intel.avgSalaryEur,
          created_at: new Date().toISOString(),
          is_ai_discovered: true,
          institution_type: resolvedSector,
          is_priority_university: prioMatch.isPriority,
          priority_rank: prioMatch.isPriority ? prioMatch.rank : null,
          priority_note: prioMatch.rule?.note || null,
          university: {
            id: `ai-uni-${slug}-${uniSlug}`,
            name: uniName,
            country: itemCountry,
            global_ranking: 250,
            campus_locations: [itemCountry],
          },
          eligibility_rules: {
            id: `ai-rule-${slug}-${idx}`,
            course_id: courseId,
            min_12th_percent: Number(item.min_12th_percent) || 55,
            min_degree_percent: Number(item.min_degree_percent) || 55,
            min_ielts: Number(item.min_ielts) || 6.0,
            min_toefl: 85,
            interview_required: false,
            work_experience_months: 0,
            english_requirement_type: item.english_requirement_type || 'IELTS_TOEFL',
          },
          ...(normalizeTeachingLanguage(item.teaching_language)
            ? {
                teaching_language: normalizeTeachingLanguage(item.teaching_language)!,
                language_proficiency:
                  String(item.language_proficiency || '').trim() ||
                  extractLanguageProficiency(item.teaching_language) ||
                  undefined,
              }
            : {}),
        };
      })
      .filter((c) => {
        if (country && c.university.country.toLowerCase() !== country.toLowerCase()) return false;
        if (sectorFilter !== 'all' && c.institution_type !== sectorFilter) return false;
        if (courseTypes.length > 0 && !courseTypes.includes(normalizeCourseType(c as any))) return false;
        if (subject && !matchesSubjectGroup(c, subject)) return false;
        if (query && !matchesSmartSearch(c as any, query)) return false;
        if (
          languageFilter &&
          languageFilter.toLowerCase() !== 'all' &&
          !matchesTeachingLanguageFilter(c as any, languageFilter)
        ) {
          return false;
        }
        if (
          intake &&
          intake !== 'all' &&
          !c.intake_months.some((m: string) => m.toLowerCase().includes(intake.toLowerCase()))
        ) {
          return false;
        }
        if (!Number.isNaN(maxTuition) && maxTuition < 100000 && c.tuition_fees_eur > maxTuition) {
          return false;
        }
        if (excludeSet.has(c.university.name.toLowerCase())) return false;
        return true;
      });

    // 0-Credit Official Sitemap Grounding FIRST (surfaces exact live university titles & URLs before AI guessing)
    const sitemapGroundedCourses: any[] = [];
    if (country && (query || subject)) {
      try {
        const countryCurated = searchCuratedCatalogue({
          country,
          sector: sectorFilter,
          priorityUniversities,
        });
        const candidateUnisMap = new Map<string, { name: string; domainHint: string }>();
        for (const p of priorityUniversities) {
          if (
            p.country &&
            p.country.toLowerCase() === country.toLowerCase() &&
            !excludeSet.has(p.university_name.toLowerCase()) &&
            !candidateUnisMap.has(p.university_name.toLowerCase())
          ) {
            const matchCur = countryCurated.find(
              (c) => (c.university?.name || '').toLowerCase() === p.university_name.toLowerCase()
            );
            candidateUnisMap.set(p.university_name.toLowerCase(), {
              name: p.university_name,
              domainHint: extractDomainHost(matchCur?.course_url),
            });
          }
        }
        for (const c of countryCurated) {
          const uName = c.university?.name || '';
          if (!uName || excludeSet.has(uName.toLowerCase()) || candidateUnisMap.has(uName.toLowerCase())) continue;
          candidateUnisMap.set(uName.toLowerCase(), {
            name: uName,
            domainHint: extractDomainHost(c.course_url),
          });
          if (candidateUnisMap.size >= 5) break;
        }

        const targetUnis = Array.from(candidateUnisMap.values()).slice(0, 5);
        if (targetUnis.length > 0) {
          const sitemapSearchPromise = Promise.all(
            targetUnis.map(async (u) => {
              const domain = u.domainHint || (await resolveUniversityDomainFree(u.name, country));
              if (!domain) return [];
              const hits = await searchDomainSitemapCourses(domain, query || subject, courseTypes, 3);
              return hits.map((h) => ({ uniName: u.name, domain, ...h }));
            })
          );
          const timedResults = await Promise.race([
            sitemapSearchPromise,
            new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 4500)),
          ]);
          const seenSitemapUrls = new Set<string>();
          for (const group of timedResults) {
            if (!Array.isArray(group)) continue;
            for (let i = 0; i < group.length; i++) {
              const hit = group[i];
              if (!hit?.url || seenSitemapUrls.has(hit.url)) continue;
              seenSitemapUrls.add(hit.url);
              const prioMatch = getPriorityUniversityMatch(hit.uniName, country, priorityUniversities);
              const sector = classifyUniversityType(hit.uniName, country, undefined, priorityUniversities);
              if (sectorFilter !== 'all' && sector !== sectorFilter) continue;
              const slug = country.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const uniSlug = hit.uniName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
              const courseId = `sm-${slug}-${uniSlug}-${seenSitemapUrls.size}`;
              const statutoryPublic = getStatutoryPublicTuition(country, hit.uniName, sector);
              const candCourse = {
                id: courseId,
                university_id: `sm-uni-${slug}-${uniSlug}`,
                program_name: hit.title,
                degree_level: hit.degreeLevel,
                category: subject || 'Computer Science & AI',
                duration_months: hit.degreeLevel === 'Bachelor' ? 36 : 24,
                tuition_fees_eur:
                  statutoryPublic !== null
                    ? statutoryPublic.tuitionEur
                    : sector === 'Public'
                    ? /germany|norway|austria/i.test(country)
                      ? 1500
                      : 4500
                    : 8500,
                intake_months: ['September', 'October'],
                course_url: hit.url,
                stay_back_visa_years: resolveOfficialStayBackYears(
                  country,
                  hit.degreeLevel,
                  hit.title,
                  undefined,
                  subject || 'Computer Science & AI'
                ),
                average_graduate_salary: intel.avgSalaryEur,
                created_at: new Date().toISOString(),
                is_ai_discovered: false,
                is_sitemap_grounded: true,
                institution_type: sector,
                is_priority_university: prioMatch.isPriority,
                priority_rank: prioMatch.isPriority ? prioMatch.rank : null,
                priority_note: prioMatch.rule?.note || null,
                university: {
                  id: `sm-uni-${slug}-${uniSlug}`,
                  name: hit.uniName,
                  country,
                  global_ranking: 200,
                  campus_locations: [country],
                },
                eligibility_rules: {
                  id: `sm-rule-${slug}-${seenSitemapUrls.size}`,
                  course_id: courseId,
                  min_12th_percent: 60,
                  min_degree_percent: 60,
                  min_ielts: 6.0,
                  min_toefl: 85,
                  interview_required: false,
                  work_experience_months: 0,
                  english_requirement_type: 'IELTS_TOEFL',
                },
              };
              if (courseTypes.length > 0 && !courseTypes.includes(normalizeCourseType(candCourse as any))) continue;
              if (
                languageFilter &&
                languageFilter.toLowerCase() !== 'all' &&
                !matchesTeachingLanguageFilter(candCourse as any, languageFilter)
              ) {
                continue;
              }
              sitemapGroundedCourses.push(candCourse);
            }
          }
        }

        // Optional 0-Credit National Study Registry lookup for Finland (Studyinfo.fi)
        if (country.toLowerCase() === 'finland' && !excludeSet.has('studyinfo')) {
          const studyinfoHits = await fetchStudyinfoFinlandCourses(
            query || subject,
            courseTypes,
            3
          );
          for (let i = 0; i < studyinfoHits.length; i++) {
            const hit = studyinfoHits[i];
            if (excludeSet.has(hit.universityName.toLowerCase())) continue;
            const sector = classifyUniversityType(hit.universityName, country, undefined, priorityUniversities);
            if (sectorFilter !== 'all' && sector !== sectorFilter) continue;
            const courseId = `fi-studyinfo-${i}-${hit.programName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`;
            const candCourse = {
              id: courseId,
              university_id: `fi-uni-${hit.universityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`,
              program_name: hit.programName,
              degree_level: hit.degreeLevel,
              category: subject || 'Computer Science & AI',
              duration_months: hit.degreeLevel === 'Bachelor' ? 36 : 24,
              tuition_fees_eur: 10000,
              intake_months: ['September'],
              course_url: hit.courseUrl,
              stay_back_visa_years: resolveOfficialStayBackYears(
                country,
                hit.degreeLevel,
                hit.programName,
                undefined,
                subject || 'Computer Science & AI'
              ),
              average_graduate_salary: intel.avgSalaryEur,
              created_at: new Date().toISOString(),
              is_ai_discovered: false,
              is_sitemap_grounded: true,
              institution_type: sector,
              teaching_language: hit.teachingLanguage,
              university: {
                id: `fi-uni-${hit.universityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`,
                name: hit.universityName,
                country: 'Finland',
                global_ranking: 200,
                campus_locations: ['Finland'],
              },
              eligibility_rules: {
                id: `fi-rule-${i}`,
                course_id: courseId,
                min_12th_percent: 60,
                min_degree_percent: 60,
                min_ielts: 6.0,
                min_toefl: 85,
                interview_required: false,
                work_experience_months: 0,
                english_requirement_type: 'IELTS_TOEFL',
              },
            };
            if (courseTypes.length > 0 && !courseTypes.includes(normalizeCourseType(candCourse as any))) continue;
            if (
              languageFilter &&
              languageFilter.toLowerCase() !== 'all' &&
              !matchesTeachingLanguageFilter(candCourse as any, languageFilter)
            ) {
              continue;
            }
            sitemapGroundedCourses.push(candCourse);
          }
        }
      } catch {
        // Non-fatal sitemap grounding
      }
    }

    // Supplement from deterministic Global Curated Catalogue when AI results are scarce or unconfigured
    const groundedUniLevelKeys = new Set(
      sitemapGroundedCourses.map(
        (c) => `${String(c.university?.name || '').toLowerCase()}::${normalizeCourseType(c as any)}`
      )
    );
    const filteredMappedAi = mappedFromAi.filter(
      (c) => !groundedUniLevelKeys.has(`${c.university.name.toLowerCase()}::${normalizeCourseType(c as any)}`)
    );
    const courses = [...sitemapGroundedCourses, ...filteredMappedAi];
    if (courses.length < 15) {
      const curated = searchCuratedCatalogue({
        country,
        q: query,
        subject,
        types: courseTypes,
        sector: sectorFilter,
        intake,
        maxTuition,
        priorityUniversities,
      });

      const seenKeys = new Set(
        courses.map((c) => `${c.university.name}::${c.program_name}`.toLowerCase())
      );

      for (const item of curated) {
        if (!shouldDiversifyGlobal && courses.length >= 15) break;
        if (excludeSet.has((item.university?.name || '').toLowerCase())) continue;
        const key = `${item.university?.name || ''}::${item.program_name}`.toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        courses.push(item as any);
      }
    }

    if (shouldDiversifyGlobal && !(query && isExplicitUniversityQuery(query, courses))) {
      const { items: diversified, countryCount } = diversifyGlobalCourses(courses, {
        maxPerUniversity: 1,
        maxPerCountry: 2,
        q: query,
        subject,
      });
      return NextResponse.json({
        success: true,
        courses: diversified.slice(0, 15),
        diversified: true,
        countryCount,
      });
    }

    const overlaid = courses.map(overlayVerified);
    const rankedCourses = sortCoursesBySearchEngineRank(overlaid, query || subject);
    const finalCourses =
      query && isExplicitUniversityQuery(query, rankedCourses)
        ? rankedCourses
        : applyUniversityDiversityCap(rankedCourses, 2);
    return NextResponse.json({
      success: true,
      courses: finalCourses.slice(0, 15),
      diversified: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to discover courses' },
      { status: 500 }
    );
  }
}
