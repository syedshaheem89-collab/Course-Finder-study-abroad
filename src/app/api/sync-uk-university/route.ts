import { NextRequest, NextResponse } from 'next/server';
import { callGroqFreeJson } from '@/lib/groq-client';
import { requireAdminSession } from '@/lib/security/session';
import { safeFetchExternal } from '@/lib/security/ssrf-guard';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';
import { resolveOfficialStayBackYears } from '@/lib/country-visa-intel';

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const {
      universityName = '',
      websiteUrl = '',
      degreeLevel = 'Master',
    } = body as {
      universityName?: string;
      websiteUrl?: string;
      degreeLevel?: string;
    };

    const safeUniName = String(universityName || '').trim().slice(0, 150);
    const cleanUrl = String(websiteUrl || '').trim();
    const safeDegree = String(degreeLevel || 'Master').trim().slice(0, 50);

    if (!safeUniName && !cleanUrl) {
      return NextResponse.json(
        { success: false, error: 'Please enter a UK University Name or Official Course Page URL.' },
        { status: 400 }
      );
    }

    let scrapedSnippet = '';
    if (cleanUrl) {
      try {
        const fetched = await safeFetchExternal(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GlobalCourseAI/2026)',
            Accept: 'text/html,application/xhtml+xml',
          },
          timeoutMs: 10_000,
          maxBytes: 3_000_000,
        });
        if (fetched.ok) {
          const html = fetched.buffer.toString('utf8');
          scrapedSnippet = stripHtmlToText(html).slice(0, 9000);
        }
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('blocked') || err?.message?.toLowerCase().includes('private') || err?.message?.toLowerCase().includes('internal')) {
          await logSecurityEvent({
            event: 'SSRF_OR_FETCH_BLOCKED',
            severity: 'CRITICAL',
            actorEmail: auth.session.email,
            actorId: auth.session.uid,
            ip,
            userAgent: ua,
            path: '/api/sync-uk-university',
            details: { targetUrl: cleanUrl.slice(0, 200), reason: err.message },
          });
          return NextResponse.json(
            { success: false, error: err.message },
            { status: 400 }
          );
        }
        // Non-fatal network error: continue with university name lookup
      }
    }

    const prompt = `Extract or list accredited ${safeDegree} programmes for international students from this UK university.
University Name: ${safeUniName || 'UK University'}
${cleanUrl ? `Official Page URL: ${cleanUrl}` : ''}
${scrapedSnippet ? `Extracted Official Page Text:\n${scrapedSnippet}` : ''}`;

    const promptSuffix = `

Return strictly a valid JSON object with key "courses" containing up to 15 programmes:
{
  "university": string (official UK university name),
  "courses": [
    {
      "program_name": string (exact programme title, e.g. "MSc Computer Science", "MBA International Business"),
      "degree_level": "Master" | "Bachelor" | "PG Diploma",
      "category": "Computer Science & AI" | "Data Science" | "Engineering" | "Business & Management",
      "duration_months": number (12 for standard UK full-time Masters, 24 with placement, 36 for Bachelor),
      "tuition_fees_eur": number (annual international tuition converted to EUR, e.g. 18500),
      "intake": string (e.g. "September, January"),
      "min_degree_percent": number (typical international cutoff, e.g. 55 or 60),
      "min_12th_percent": number,
      "min_ielts": number (e.g. 6.0 or 6.5),
      "course_url": string (official .ac.uk URL for this programme or university)
    }
  ]
}`;

    const content = await callGroqFreeJson(prompt + promptSuffix);
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'AI extraction failed. Check GROQ_API_KEY in Vercel.' },
        { status: 503 }
      );
    }

    const parsed = JSON.parse(content);
    const resolvedUni = String(parsed.university || safeUniName || 'UK University').trim();
    const rawCourses: any[] = Array.isArray(parsed.courses) ? parsed.courses : [];
    const safeFallbackUrl = sanitizeHttpUrl(cleanUrl);

    const rows = rawCourses.map((c, idx) => {
      const sanitizedCourseUrl = sanitizeHttpUrl(String(c.course_url || ''));
      return {
        id: `uk-direct-${Date.now()}-${idx}`,
        university: resolvedUni,
        country: 'United Kingdom',
        program_name: String(c.program_name || 'Postgraduate Programme').trim(),
        degree_level: String(c.degree_level || safeDegree),
        category: String(c.category || 'Business & Management'),
        duration_months: Number(c.duration_months) || 12,
        tuition_fees_eur: Number(c.tuition_fees_eur) || 18000,
        intake: String(c.intake || 'September, January'),
        stay_back_visa_years: resolveOfficialStayBackYears(
          'United Kingdom',
          String(c.degree_level || safeDegree),
          String(c.program_name || ''),
          undefined,
          String(c.category || '')
        ),
        average_graduate_salary: 38000,
        min_degree_percent: Number(c.min_degree_percent) || 55,
        min_12th_percent: Number(c.min_12th_percent) || 55,
        min_ielts: Number(c.min_ielts) || 6.0,
        interview_required: false,
        english_policy: 'IELTS_TOEFL' as const,
        course_url:
          sanitizedCourseUrl ||
          safeFallbackUrl ||
          `https://www.google.com/search?q=${encodeURIComponent(`${resolvedUni} ${c.program_name} uk`)}`,
        raw_excel_data: {
          'UK University': resolvedUni,
          'Source': safeFallbackUrl || 'Official .ac.uk Lookup',
          'Course Title': c.program_name,
          'Degree Level': c.degree_level || safeDegree,
          'Intakes': c.intake || 'September, January',
        },
      };
    });

    await logSecurityEvent({
      event: 'UK_UNI_SYNC_EXECUTED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/sync-uk-university',
      details: { university: resolvedUni, count: rows.length, usedLiveHtml: Boolean(scrapedSnippet) },
    });

    return NextResponse.json({
      success: true,
      university: resolvedUni,
      usedLiveHtml: Boolean(scrapedSnippet),
      rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to sync UK university' },
      { status: 500 }
    );
  }
}
