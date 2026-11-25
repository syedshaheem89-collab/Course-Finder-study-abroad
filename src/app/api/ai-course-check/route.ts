import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { callGroqFreeJson } from '@/lib/groq-client';
import { requireAdminSession } from '@/lib/security/session';
import { isValidUuid, sanitizeHttpUrl } from '@/lib/security/validation';
import { isGenericUniversityUrl } from '@/lib/student-guides';

async function verifyReachableCourseUrl(rawUrl?: string): Promise<string | undefined> {
  const safe = rawUrl ? sanitizeHttpUrl(rawUrl) : null;
  if (!safe || isGenericUniversityUrl(safe).isGeneric) return undefined;
  try {
    let res = await fetch(safe, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Orbis/2026' },
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(safe, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Orbis/2026' },
      });
    }
    if (res.status < 400) {
      const finalUrl = sanitizeHttpUrl(res.url || safe);
      if (finalUrl && !isGenericUniversityUrl(finalUrl).isGeneric) return finalUrl;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseId,
      programName: rawProgramName,
      universityName: rawUniversityName,
      country: rawCountry,
      degreeLevel: rawDegreeLevel,
      courseUrl: rawCourseUrl,
      saveToDb = false,
    } = body as {
      courseId?: string;
      programName: string;
      universityName: string;
      country: string;
      degreeLevel?: string;
      courseUrl?: string;
      saveToDb?: boolean;
    };

    const programName = String(rawProgramName || '').trim().slice(0, 200);
    const universityName = String(rawUniversityName || '').trim().slice(0, 200);
    const country = String(rawCountry || '').trim().slice(0, 80);
    const degreeLevel = rawDegreeLevel ? String(rawDegreeLevel).trim().slice(0, 60) : undefined;
    const courseUrl = rawCourseUrl ? sanitizeHttpUrl(String(rawCourseUrl)) || undefined : undefined;

    if (!programName || !universityName) {
      return NextResponse.json(
        { success: false, error: 'programName and universityName are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
    const hasAnyKey = Boolean(
      apiKey || process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim()
    );
    if (!hasAnyKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI verification key is configured on the server.',
        },
        { status: 503 }
      );
    }

    const isUg =
      (degreeLevel || '').toLowerCase().includes('bachelor') ||
      (degreeLevel || '').toLowerCase().includes('undergraduate') ||
      (degreeLevel || '').toLowerCase().includes('ug');

    const prompt = `Search the official university website and current 2026 international student admission pages for:
University: ${universityName} (${country})
Programme: ${programName} (${degreeLevel || 'Degree'})
${courseUrl && !courseUrl.includes('study-abroad.edu') ? `Known URL: ${courseUrl}` : ''}

Find the latest international student entry requirements, tuition fees, and intakes.
Return ONLY a valid JSON object (no markdown fences) with these exact keys:
{
  "min12thPercent": number (minimum 12th/high-school % for international students, e.g. 55, 60, 75, 85),
  "minDegreePercent": number (minimum bachelor % if postgraduate, e.g. 55, 60, 70; or same as min12thPercent if undergraduate),
  "minIelts": number (minimum IELTS overall band, e.g. 5.5, 6.0, 6.5, 7.0),
  "englishPolicy": "IELTS_TOEFL" | "MOI_ACCEPTED" | "WAIVED",
  "tuitionFeesEur": number | null (annual international tuition converted to EUR, or null if unknown),
  "intakes": string[] (e.g. ["September", "January"]),
  "subjectRequirements": string (concise note on specific subjects, portfolio, work exp, or interview required),
  "officialUrl": string (the real official university/course URL found),
  "summary": string (1-2 concise sentences explaining the latest official international entry criteria)
}`;

    let geminiJson: any = null;
    let sawQuota429 = false;
    let verifiedSource: 'live-web-search' | 'ai-knowledge' | 'baseline' = 'baseline';

    const attempts = [
      { model: 'gemini-2.5-flash', useSearch: true },
      { model: 'gemini-2.0-flash', useSearch: true },
      { model: 'gemini-2.5-flash', useSearch: false },
    ];

    if (apiKey) {
      for (const attempt of attempts) {
        try {
          const reqBody: any = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          };
          if (attempt.useSearch) {
            reqBody.tools = [{ google_search: {} }];
          }

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify(reqBody),
            }
          );

          if (res.ok) {
            geminiJson = await res.json();
            verifiedSource = attempt.useSearch ? 'live-web-search' : 'ai-knowledge';
            break;
          }
          if (res.status === 429) sawQuota429 = true;
        } catch {
          // Try next model
        }
      }
    }

    let groqErr = '';
    if (!geminiJson) {
      const content = await callGroqFreeJson(prompt);
      if (content) {
        geminiJson = {
          candidates: [{ content: { parts: [{ text: content }] }, groundingMetadata: { groundingChunks: [] } }],
        };
        verifiedSource = 'ai-knowledge';
      } else {
        groqErr = 'AI search temporarily unavailable';
      }
    }

    if (!geminiJson) {
      // Smart deterministic fallback when Google AI Studio key has 0 free quota
      const lowerProg = programName.toLowerCase();
      const lowerUni = universityName.toLowerCase();
      const lowerCtry = country.toLowerCase();

      const isTopTier =
        lowerUni.includes('imperial') ||
        lowerUni.includes('oxford') ||
        lowerUni.includes('cambridge') ||
        lowerUni.includes('eth') ||
        lowerUni.includes('tum') ||
        lowerUni.includes('rwth') ||
        lowerUni.includes('edinburgh') ||
        lowerUni.includes('ucl') ||
        lowerUni.includes('manchester') ||
        lowerUni.includes('kings') ||
        lowerUni.includes("king's");

      const min12th = isTopTier ? 85 : lowerCtry === 'germany' ? 70 : isUg ? 55 : 55;
      const minDegree = isTopTier ? 75 : lowerCtry === 'germany' ? 65 : 55;
      const minIelts = isTopTier ? 7.0 : lowerCtry === 'germany' ? 6.5 : 6.0;
      const subjNote = lowerProg.includes('engineer') || lowerProg.includes('comput')
        ? 'Mathematics / Science background recommended.'
        : lowerProg.includes('design') || lowerProg.includes('art') || lowerProg.includes('arch')
        ? 'Portfolio submission may be required.'
        : 'Standard academic transcripts & SOP/LOR required.';

      const searchFallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(`${universityName} ${programName} international entry requirements`)}`;

      return NextResponse.json({
        success: true,
        verifiedAt: new Date().toISOString(),
        data: {
          min12thPercent: min12th,
          minDegreePercent: minDegree,
          minIelts,
          englishPolicy: lowerCtry === 'latvia' || lowerCtry === 'malta' ? 'MOI_ACCEPTED' : 'IELTS_TOEFL',
          tuitionFeesEur: null,
          intakes: ['September', 'February'],
          subjectRequirements: subjNote,
          officialUrl: searchFallbackUrl,
          summary: sawQuota429
            ? `Smart baseline applied (${groqErr || 'AI quota limit'}). Verify exact cutoffs on the official university page.`
            : `Smart baseline applied for ${universityName} (${groqErr || 'offline'}). Verify exact cutoffs on the official university page.`,
          sources: [{ title: `Search ${universityName} Official Requirements`, uri: searchFallbackUrl }],
        },
      });
    }
    const rawText: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: 'AI did not return structured JSON.' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const groundingChunks =
      geminiJson?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { title: string; uri: string }[] = groundingChunks
      .map((c: any) => c.web)
      .filter((w: any) => w?.uri && !String(w.uri).includes('google.com/search'))
      .slice(0, 4);

    const min12th = Number(parsed.min12thPercent) || (isUg ? 60 : 55);
    const minDegree = Number(parsed.minDegreePercent) || (isUg ? min12th : 60);
    const minIelts = Number(parsed.minIelts) || 6.0;
    const englishPolicy = parsed.englishPolicy || 'IELTS_TOEFL';

    const candidateUrl =
      (await verifyReachableCourseUrl(parsed.officialUrl ? String(parsed.officialUrl) : undefined)) ||
      (await verifyReachableCourseUrl(
        sources.find((s) => !String(s.uri).includes('vertexaisearch'))?.uri
      ));
    const officialUrl = candidateUrl;

    // Optionally persist verified rules back to Supabase ONLY for authenticated admins
    if (saveToDb && courseId && isValidUuid(courseId)) {
      const adminAuth = await requireAdminSession(req);
      if (adminAuth.ok) {
        try {
          const supabase = createServerSupabaseClient();
          await supabase.from('eligibility_rules').upsert(
            {
              course_id: courseId,
              min_12th_percent: min12th,
              min_degree_percent: minDegree,
              min_ielts: minIelts,
              english_requirement_type: englishPolicy,
            },
            { onConflict: 'course_id' }
          );

          const { data: existingCourse } = await supabase
            .from('courses')
            .select('raw_excel_data')
            .eq('id', courseId)
            .single();

          const coursePatch: Record<string, any> = {
            raw_excel_data: {
              ...(existingCourse?.raw_excel_data && typeof existingCourse.raw_excel_data === 'object'
                ? existingCourse.raw_excel_data
                : {}),
              'Last Live Verified': new Date().toISOString(),
            },
          };
          if (parsed.tuitionFeesEur !== null && parsed.tuitionFeesEur !== undefined && Number(parsed.tuitionFeesEur) >= 0) {
            coursePatch.tuition_fees_eur = Math.round(Number(parsed.tuitionFeesEur));
          }
          if (Array.isArray(parsed.intakes) && parsed.intakes.length > 0) {
            coursePatch.intake_months = parsed.intakes;
          }
          if (officialUrl) {
            coursePatch.course_url = officialUrl;
          }
          await supabase.from('courses').update(coursePatch).eq('id', courseId);
        } catch (dbErr) {
          console.error('Non-fatal DB update error during AI check:', dbErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      verifiedAt: new Date().toISOString(),
      verifiedSource,
      data: {
        min12thPercent: min12th,
        minDegreePercent: minDegree,
        minIelts,
        englishPolicy,
        tuitionFeesEur:
          parsed.tuitionFeesEur !== null && parsed.tuitionFeesEur !== undefined
            ? Number(parsed.tuitionFeesEur)
            : null,
        intakes: Array.isArray(parsed.intakes) ? parsed.intakes : [],
        subjectRequirements: parsed.subjectRequirements || '',
        officialUrl,
        summary: parsed.summary || '',
        sources,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'AI web verification failed' },
      { status: 500 }
    );
  }
}
