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

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: 'baseline',
        stayBackYears: baseline.stayBackYears,
        avgSalaryEur: baseline.avgSalaryEur,
        visaSummary: baseline.visaSummary,
        universityUrls: {},
      });
    }

    const prompt = `You are a study abroad data intelligence assistant.
Target Country: ${country || 'Europe'}
Universities: ${uniqueUnis.join(', ') || 'General'}

Return strictly valid JSON with:
1. "stayBackYears": number (current post-study work / job-seeker visa duration in years for international graduates in ${country || 'this country'}, e.g. 1, 1.5, 2, 3)
2. "avgSalaryEur": number (realistic annual entry-level graduate salary in EUR in ${country || 'this country'})
3. "visaSummary": string (1 concise sentence about current stay-back visa & tuition/fee policy for international students in ${country || 'this country'})
4. "universityUrls": object mapping each university name from the list above to its real official English website URL (https://...). Only include URLs you are confident are real.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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

    if (!geminiRes.ok) {
      return NextResponse.json({
        success: true,
        source: 'baseline',
        stayBackYears: baseline.stayBackYears,
        avgSalaryEur: baseline.avgSalaryEur,
        visaSummary: baseline.visaSummary,
        universityUrls: {},
      });
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      success: true,
      source: 'gemini-ai',
      stayBackYears: Number(parsed.stayBackYears) || baseline.stayBackYears,
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
