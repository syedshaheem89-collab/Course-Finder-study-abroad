import { NextRequest, NextResponse } from 'next/server';
import { getCountryVisaIntel } from '@/lib/country-visa-intel';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country = '', universities = [] } = body as {
      country?: string;
      universities?: string[];
    };

    const uniqueUnis = Array.from(new Set(universities.map((u) => String(u).trim()).filter(Boolean))).slice(0, 40);
    const baseline = getCountryVisaIntel(country);
    const apiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!apiKey && !groqKey) {
      return NextResponse.json({
        success: true,
        source: 'baseline',
        stayBackYears: baseline.stayBackYears,
        bachelorStayBackYears: baseline.bachelorStayBackYears ?? baseline.stayBackYears,
        avgSalaryEur: baseline.avgSalaryEur,
        visaSummary: baseline.visaSummary,
        universityUrls: {},
      });
    }

    const prompt = `You are a study abroad data intelligence assistant.
Target Country: ${country || 'Europe'}
Universities: ${uniqueUnis.join(', ') || 'General'}

Return strictly valid JSON with:
1. "stayBackYears": number (current post-study work / job-seeker visa duration in years for international Master/PhD graduates in ${country || 'this country'}, e.g. 1, 1.5, 2, 3)
2. "bachelorStayBackYears": number (current post-study stay-back in years for Bachelor graduates in ${country || 'this country'}; e.g. 0.33 for 4 months in Latvia, 1 for Ireland, 2 for UK)
3. "avgSalaryEur": number (realistic annual entry-level graduate salary in EUR in ${country || 'this country'})
4. "visaSummary": string (1 concise sentence about current stay-back visa & tuition/fee policy for international students in ${country || 'this country'})
5. "universityUrls": object mapping each university name from the list above to its real official English website URL (https://...). Only include URLs you are confident are real.`;

    let rawText = '';
    let usedSource = 'gemini-ai';

    if (apiKey) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );
      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }

    if (!rawText && groqKey) {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        rawText = groqData?.choices?.[0]?.message?.content || '';
        usedSource = 'groq-free-ai';
      }
    }

    if (!rawText) {
      return NextResponse.json({
        success: true,
        source: 'baseline',
        stayBackYears: baseline.stayBackYears,
        bachelorStayBackYears: baseline.bachelorStayBackYears ?? baseline.stayBackYears,
        avgSalaryEur: baseline.avgSalaryEur,
        visaSummary: baseline.visaSummary,
        universityUrls: {},
      });
    }

    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      success: true,
      source: usedSource,
      stayBackYears: Number(parsed.stayBackYears) || baseline.stayBackYears,
      bachelorStayBackYears:
        parsed.bachelorStayBackYears !== undefined
          ? Number(parsed.bachelorStayBackYears)
          : baseline.bachelorStayBackYears ?? baseline.stayBackYears,
      avgSalaryEur: Number(parsed.avgSalaryEur) || baseline.avgSalaryEur,
      visaSummary: parsed.visaSummary || baseline.visaSummary,
      universityUrls: parsed.universityUrls && typeof parsed.universityUrls === 'object' ? parsed.universityUrls : {},
    });
  } catch (err: any) {
    const baseline = getCountryVisaIntel();
    return NextResponse.json({
      success: true,
      source: 'baseline',
      stayBackYears: baseline.stayBackYears,
      avgSalaryEur: baseline.avgSalaryEur,
      visaSummary: baseline.visaSummary,
      universityUrls: {},
      note: err?.message,
    });
  }
}
