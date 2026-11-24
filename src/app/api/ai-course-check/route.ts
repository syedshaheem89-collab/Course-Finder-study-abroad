import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseId,
      programName,
      universityName,
      country,
      degreeLevel,
      courseUrl,
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

    if (!programName || !universityName) {
      return NextResponse.json(
        { success: false, error: 'programName and universityName are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY is not configured on the server.',
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

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { success: false, error: `Gemini API error (${geminiRes.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const geminiJson = await geminiRes.json();
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
      .filter((w: any) => w?.uri)
      .slice(0, 3);

    const min12th = Number(parsed.min12thPercent) || (isUg ? 60 : 55);
    const minDegree = Number(parsed.minDegreePercent) || (isUg ? min12th : 60);
    const minIelts = Number(parsed.minIelts) || 6.0;
    const englishPolicy = parsed.englishPolicy || 'IELTS_TOEFL';
    const officialUrl =
      parsed.officialUrl && /^https?:\/\//i.test(parsed.officialUrl) ? parsed.officialUrl : undefined;

    // Optionally persist verified rules back to Supabase so future searches reflect it
    if (saveToDb && courseId) {
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

        const coursePatch: Record<string, any> = {};
        if (parsed.tuitionFeesEur && Number(parsed.tuitionFeesEur) > 0) {
          coursePatch.tuition_fees_eur = Math.round(Number(parsed.tuitionFeesEur));
        }
        if (Array.isArray(parsed.intakes) && parsed.intakes.length > 0) {
          coursePatch.intake_months = parsed.intakes;
        }
        if (officialUrl) {
          coursePatch.course_url = officialUrl;
        }
        if (Object.keys(coursePatch).length > 0) {
          await supabase.from('courses').update(coursePatch).eq('id', courseId);
        }
      } catch (dbErr) {
        console.error('Non-fatal DB update error during AI check:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      verifiedAt: new Date().toISOString(),
      data: {
        min12thPercent: min12th,
        minDegreePercent: minDegree,
        minIelts,
        englishPolicy,
        tuitionFeesEur: parsed.tuitionFeesEur ? Number(parsed.tuitionFeesEur) : null,
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
