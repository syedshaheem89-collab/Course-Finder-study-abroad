import { NextResponse } from 'next/server';

export interface StudyAbroadUpdate {
  country: string;
  title: string;
  summary: string;
  tag: 'Visa & Stay-Back' | 'Tuition & Fees' | 'Eligibility' | 'Scholarships';
}

const FALLBACK_UPDATES: StudyAbroadUpdate[] = [
  {
    country: 'Germany',
    title: 'Sperrkonto & 18-Month Job-Seeker Visa',
    summary: 'Blocked account proof is ~€11,904/yr; APS certificate required for India/Vietnam/China; 18-month stay-back after graduation.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'United Kingdom',
    title: '2-Year Graduate Route & Visa Rules',
    summary: 'International graduates remain eligible for the 2-year Graduate Route post-study work visa (3 years for PhD).',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Latvia',
    title: 'AIC Verification & EU Residence Permit',
    summary: 'Latvian universities require AIC degree verification & interview; graduates qualify for a post-study job-seeking permit.',
    tag: 'Eligibility',
  },
  {
    country: 'Denmark',
    title: '3-Year Graduate Job-Seeking Permit',
    summary: 'Non-EU graduates from accredited Danish higher education programmes receive up to 3 years to find employment.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Australia',
    title: 'Genuine Student (GS) & Living Proof',
    summary: 'Australia replaced GTE with the Genuine Student (GS) requirement; financial capacity benchmark is AUD 29,710/yr.',
    tag: 'Tuition & Fees',
  },
  {
    country: 'Malta',
    title: 'Get Qualified 70% Tuition Tax Rebate',
    summary: 'MQF Level 5–7 graduates working in Malta can reclaim up to 70% of tuition fees as tax credits.',
    tag: 'Scholarships',
  },
];

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: true, source: 'curated', updates: FALLBACK_UPDATES },
        { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
      );
    }

    const prompt = `Provide 6 concise, practical 2026 study-abroad policy updates for international students & counselors covering major destinations (Germany, United Kingdom, Latvia, Denmark, Australia, Malta, Ireland). Focus on stay-back visa duration, tuition/blocked-account fees, and eligibility/APS/GS changes.
Return strictly a JSON array of objects with keys: "country", "title", "summary" (1 sentence), "tag" (one of "Visa & Stay-Back", "Tuition & Fees", "Eligibility", "Scholarships").`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { success: true, source: 'curated', updates: FALLBACK_UPDATES },
        { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
      );
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const parsed = JSON.parse(text);
    const updates = Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 8) : FALLBACK_UPDATES;

    return NextResponse.json(
      { success: true, source: 'gemini-ai', updates },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
    );
  } catch {
    return NextResponse.json(
      { success: true, source: 'curated', updates: FALLBACK_UPDATES },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
    );
  }
}
