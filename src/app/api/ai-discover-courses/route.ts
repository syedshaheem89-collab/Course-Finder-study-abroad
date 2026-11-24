import { NextRequest, NextResponse } from 'next/server';
import { callGroqFreeJson } from '@/lib/groq-client';
import { getCountryVisaIntel } from '@/lib/country-visa-intel';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      country = '',
      query = '',
      courseTypes = [],
    } = body as {
      country?: string;
      query?: string;
      courseTypes?: string[];
    };

    const targetCountry = (country || query || '').trim();
    if (!targetCountry) {
      return NextResponse.json({ success: false, error: 'Country or search query is required' }, { status: 400 });
    }

    const intel = getCountryVisaIntel(country || undefined);
    const levelHint = courseTypes.length > 0 ? courseTypes.join(', ') : 'Bachelor and Master';

    const prompt = `You are a study-abroad university & course database assistant.
The user is searching for study programmes in:
Country / Query: "${country ? `${country}${query ? ` - ${query}` : ''}` : query}"
Preferred Level: ${levelHint}

Return strictly a valid JSON object with key "courses" containing an array of 6 real, well-known accredited universities and programmes matching this request:
{
  "courses": [
    {
      "program_name": string (real programme title),
      "university_name": string (real university name),
      "country": string (exact country name, e.g. "Poland"),
      "degree_level": "Bachelor" | "Master",
      "category": "Computer Science & AI" | "Data Science" | "Engineering" | "Business & Management",
      "duration_months": number (e.g. 36 or 24),
      "tuition_fees_eur": number (realistic annual international tuition in EUR),
      "intake_months": string[] (e.g. ["October", "February"]),
      "course_url": string (real official university website URL starting with https://),
      "stay_back_visa_years": number (post-study stay-back in years for this degree level, e.g. 0.75 for 9 months in Poland),
      "average_graduate_salary": number (realistic annual graduate salary in EUR),
      "min_12th_percent": number,
      "min_degree_percent": number,
      "min_ielts": number,
      "english_requirement_type": "IELTS_TOEFL" | "MOI_ACCEPTED"
    }
  ]
}`;

    const content = await callGroqFreeJson(prompt);
    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'AI discovery is temporarily unavailable (check GROQ_API_KEY).',
      }, { status: 503 });
    }

    const parsed = JSON.parse(content);
    const rawList: any[] = Array.isArray(parsed.courses) ? parsed.courses : [];

    const courses = rawList.map((item, idx) => ({
      id: `ai-${Date.now()}-${idx}`,
      university_id: `ai-uni-${idx}`,
      program_name: String(item.program_name || 'International Degree Programme'),
      degree_level: String(item.degree_level || 'Master'),
      category: String(item.category || 'Business & Management'),
      duration_months: Number(item.duration_months) || 24,
      tuition_fees_eur: Number(item.tuition_fees_eur) || 3500,
      intake_months: Array.isArray(item.intake_months) && item.intake_months.length > 0 ? item.intake_months : ['September'],
      course_url: item.course_url && /^https?:\/\//i.test(item.course_url) ? item.course_url : 'https://study-abroad.edu',
      stay_back_visa_years: Number(item.stay_back_visa_years) || intel.stayBackYears,
      average_graduate_salary: Number(item.average_graduate_salary) || intel.avgSalaryEur,
      created_at: new Date().toISOString(),
      is_ai_discovered: true,
      university: {
        id: `ai-uni-${idx}`,
        name: String(item.university_name || 'Accredited University'),
        country: String(item.country || country || 'Global'),
        global_ranking: 250,
        campus_locations: [String(item.country || country || 'Global')],
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
    }));

    return NextResponse.json({ success: true, courses });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to discover courses' },
      { status: 500 }
    );
  }
}
