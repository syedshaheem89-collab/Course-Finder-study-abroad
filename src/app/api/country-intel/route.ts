import { NextRequest, NextResponse } from 'next/server';
import { getCountryVisaIntel } from '@/lib/country-visa-intel';
import {
  getLivingCostGuide,
  getCountryChecklist,
  hasBuiltInCountryGuide,
} from '@/lib/student-guides';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = (searchParams.get('country') || '').trim();
    const degreeLevel = (searchParams.get('degree') || '').trim();
    const forceAi = searchParams.get('refresh') === 'true';

    if (!country) {
      return NextResponse.json({ success: false, error: 'Country is required' }, { status: 400 });
    }

    const visaIntel = getCountryVisaIntel(country, degreeLevel);
    const livingGuide = getLivingCostGuide(country);
    const checklist = getCountryChecklist(country);

    // If we already have curated data and refresh isn't forced, return instantly
    if (hasBuiltInCountryGuide(country) && !forceAi) {
      return NextResponse.json(
        {
          success: true,
          source: 'curated',
          country,
          stayBackYears: visaIntel.stayBackYears,
          bachelorStayBackYears: visaIntel.bachelorStayBackYears ?? visaIntel.stayBackYears,
          avgSalaryEur: visaIntel.avgSalaryEur,
          visaSummary: visaIntel.visaSummary,
          showMoneyEur: livingGuide.amountEur,
          showMoneyNote: livingGuide.note,
          deadlineWindow: checklist.deadlineWindow,
          docs: checklist.docs,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        }
      );
    }

    // For ANY new/future country (e.g. Poland, Lithuania, Hungary, Japan, etc.), use Gemini AI automatically
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: 'fallback',
        country,
        stayBackYears: visaIntel.stayBackYears,
        bachelorStayBackYears: visaIntel.bachelorStayBackYears ?? visaIntel.stayBackYears,
        avgSalaryEur: visaIntel.avgSalaryEur,
        visaSummary: visaIntel.visaSummary,
        showMoneyEur: livingGuide.amountEur,
        showMoneyNote: livingGuide.note,
        deadlineWindow: checklist.deadlineWindow,
        docs: checklist.docs,
      });
    }

    const prompt = `Provide accurate 2026 international student visa & financial proof rules for: ${country}.
Return strictly valid JSON with:
1. "stayBackYears": number (Master/PhD post-study work/job-seeker visa duration in years, e.g. 0.75, 1, 1.5, 2, 3)
2. "bachelorStayBackYears": number (Bachelor graduate stay-back in years, e.g. 0.33 for 4 months, 0.75 for 9 months, 1, 2)
3. "avgSalaryEur": number (realistic annual entry-level graduate salary in EUR)
4. "visaSummary": string (1 concise sentence summarizing Bachelor vs Master stay-back visa rules in ${country})
5. "showMoneyEur": number (required annual visa financial proof / blocked account / bank balance in EUR equivalent)
6. "showMoneyNote": string (e.g. "Show Money: Blocked Account €X/yr" or "Show Money: Bank balance ~€X/yr")
7. "deadlineWindow": string (typical application deadline window for ${country})
8. "docs": array of 5 concise required visa/admission document strings for ${country}`;

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

    if (!geminiRes.ok) {
      return NextResponse.json({
        success: true,
        source: 'fallback',
        country,
        stayBackYears: visaIntel.stayBackYears,
        bachelorStayBackYears: visaIntel.bachelorStayBackYears ?? visaIntel.stayBackYears,
        avgSalaryEur: visaIntel.avgSalaryEur,
        visaSummary: visaIntel.visaSummary,
        showMoneyEur: livingGuide.amountEur,
        showMoneyNote: livingGuide.note,
        deadlineWindow: checklist.deadlineWindow,
        docs: checklist.docs,
      });
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    const isUg =
      degreeLevel.toLowerCase().includes('bachelor') ||
      degreeLevel.toLowerCase().includes('ug') ||
      degreeLevel.toLowerCase().includes('certificate');

    const masterStay = Number(parsed.stayBackYears) || visaIntel.stayBackYears;
    const bachStay =
      parsed.bachelorStayBackYears !== undefined
        ? Number(parsed.bachelorStayBackYears)
        : masterStay;

    return NextResponse.json(
      {
        success: true,
        source: 'gemini-ai',
        country,
        stayBackYears: isUg ? bachStay : masterStay,
        bachelorStayBackYears: bachStay,
        masterStayBackYears: masterStay,
        avgSalaryEur: Number(parsed.avgSalaryEur) || visaIntel.avgSalaryEur,
        visaSummary: parsed.visaSummary || visaIntel.visaSummary,
        showMoneyEur: Number(parsed.showMoneyEur) || livingGuide.amountEur,
        showMoneyNote: parsed.showMoneyNote || livingGuide.note,
        deadlineWindow: parsed.deadlineWindow || checklist.deadlineWindow,
        docs: Array.isArray(parsed.docs) && parsed.docs.length > 0 ? parsed.docs : checklist.docs,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed' }, { status: 500 });
  }
}
