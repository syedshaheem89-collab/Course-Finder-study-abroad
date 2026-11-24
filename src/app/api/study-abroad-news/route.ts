import { NextRequest, NextResponse } from 'next/server';

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

    if (cleanTitle && rawLink.trim()) {
      items.push({
        title: cleanTitle,
        link: rawLink.trim(),
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
        headers: { 'User-Agent': 'GlobalCourseAI/2026' },
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
