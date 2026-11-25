import { NextRequest, NextResponse } from 'next/server';
import { sanitizeHttpUrl } from '@/lib/security/validation';

export interface StudyAbroadUpdate {
  country: string;
  title: string;
  summary: string;
  tag: 'Visa & Stay-Back' | 'Tuition & Fees' | 'Eligibility' | 'Scholarships';
}

export interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  country: string;
}

const FALLBACK_UPDATES: StudyAbroadUpdate[] = [
  {
    country: 'Germany',
    title: 'Sperrkonto & 18-Month Job-Seeker Visa',
    summary: 'Blocked account proof is €11,904/yr (€992/mo); APS certificate required for India/Vietnam/China; 18-month stay-back after graduation.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'United Kingdom',
    title: 'Graduate Route Stay-Back Transition (2026–2027)',
    summary: '18-month standard Graduate Route for Bachelor/Master applications from 1 Jan 2027 (2 yrs on/before 31 Dec 2026; 3 yrs PhD). Monthly living funds £1,529 London / £1,171 outside.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Sweden',
    title: '12-Month Job-Seeker & Migrationsverket Funds',
    summary: 'Sweden offers 12 months (1 year) post-study permit to seek work or start a business (12–18 months PhD); 2026 maintenance proof is SEK 10,656/month.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Ireland',
    title: 'Stamp 1G Graduate Scheme (Master 2 Yr)',
    summary: 'Level 9/10 Master & PhD graduates receive up to 24 months under Stamp 1G (Honours Bachelor: 12 months); visa financial proof €10,000/year.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Canada',
    title: 'PGWP Field Rules & Living Cost Proof',
    summary: 'Up to 3-year PGWP for eligible Bachelor/Master/PhD degrees; study permit living proof CAD 22,895/yr (rising to CAD 23,448/yr from 1 Sept 2026).',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Australia',
    title: 'Subclass 485 Post-Study Work & GS Proof',
    summary: 'Temporary Graduate visa grants 2 years for Bachelor & Coursework Masters (3 yrs Research Masters/PhD); Genuine Student financial benchmark is AUD 29,710/yr.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Netherlands',
    title: 'IND Zoekjaar Orientation Year (12 Months)',
    summary: '1-year Zoekjaar post-study work permit; 2026 IND monthly living funds benchmark is €1,130.77/month (€13,569.24/year).',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'France',
    title: 'RECE / APS Stay-Back & Master Rules',
    summary: '12-month RECE job-search permit standard across French Master programmes (2-year Master extension under bilateral India-France rules).',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Poland',
    title: 'NAWA Tuition & 9-Month Graduate Permit',
    summary: 'Public tuition from €2,000–€5,000/yr; full-time English degree graduates qualify for a 9-month post-study stay-back permit to seek employment.',
    tag: 'Tuition & Fees',
  },
  {
    country: 'Malta',
    title: '9-Month Job Search & 70% Tuition Rebate',
    summary: 'MQF Level 5–7 graduates qualify for a 9-month post-study employment extension and Get Qualified up to 70% income tax credit.',
    tag: 'Scholarships',
  },
  {
    country: 'Latvia',
    title: 'AIC Verification & 4–9 Month Permit',
    summary: 'Latvian universities require AIC degree verification; graduates qualify for a 4-month (Bachelor) or 9-month (Master/PhD) job-search permit.',
    tag: 'Eligibility',
  },
  {
    country: 'Denmark',
    title: '3-Year Job-Seeking Permit & SIRI Funds',
    summary: 'State-approved Bachelor, Master & PhD graduates receive an automatic 3-year job-seeking residence permit; 2026 SIRI proof DKK 7,426/month.',
    tag: 'Visa & Stay-Back',
  },
];

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseRssItems(xml: string, countryLabel: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (const block of itemMatches.slice(0, 24)) {
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '';

    const fullTitle = decodeXmlEntities(rawTitle.trim());
    const source = decodeXmlEntities(rawSource.trim()) || 'Education News';
    const cleanTitle = fullTitle.endsWith(` - ${source}`)
      ? fullTitle.slice(0, -(` - ${source}`.length)).trim()
      : fullTitle;

    const safeLink = sanitizeHttpUrl(rawLink.trim());
    if (cleanTitle && safeLink) {
      items.push({
        title: cleanTitle,
        link: safeLink,
        pubDate: pubDate.trim(),
        source,
        country: countryLabel,
      });
    }
  }
  return items;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = (searchParams.get('country') || '').trim();

    const searchQuery = country && country !== 'All'
      ? `study abroad international students "${country}" visa OR university OR tuition`
      : 'study abroad international students visa university tuition';

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;

    let articles: NewsArticle[] = [];
    try {
      const rssRes = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Orbis/2026' },
        cache: 'no-store',
      });
      if (rssRes.ok) {
        const xml = await rssRes.text();
        articles = parseRssItems(xml, country && country !== 'All' ? country : 'Global');
        articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      }
    } catch {
      // Non-fatal: continue with policy updates if RSS fetch fails
    }

    return NextResponse.json(
      {
        success: true,
        fetchedAt: new Date().toISOString(),
        country: country || 'All',
        articles,
        updates: FALLBACK_UPDATES,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      country: 'All',
      articles: [],
      updates: FALLBACK_UPDATES,
      error: err?.message,
    });
  }
}
