import { NextRequest, NextResponse } from 'next/server';
import { sanitizeHttpUrl } from '@/lib/security/validation';
import { getLivePolicyStore } from '@/lib/live-policy-store';

export interface StudyAbroadUpdate {
  country: string;
  title: string;
  summary: string;
  tag: 'Visa & Stay-Back' | 'Tuition & Fees' | 'Eligibility' | 'Scholarships';
  sourceUrl?: string;
  sourceName?: string;
  publishedAt?: string;
  isLive?: boolean;
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
  {
    country: 'Bulgaria',
    title: 'EU Tuition from €3,000 & 9-Month Extension',
    summary: 'Bulgarian Public universities offer EU-accredited AI, Engineering & Medicine tracks; non-EU graduates qualify for up to 9 months post-study job search.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Spain',
    title: '24-Month Stay-Back Under RD 1155/2024',
    summary: 'EQF Level 6+ Bachelor, Master & PhD graduates qualify for a 24-month residence authorization to seek work or start a business; IPREM proof ~€7,200/yr.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'United Arab Emirates',
    title: '60–120 Day Job Seeker & Golden Visa',
    summary: 'No automatic 1-year PSW; graduates apply for 60, 90, or 120-day (4-month) Job Seeker Visas, or 5-yr Green / 10-yr Golden Visa for top-tier graduates.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'South Korea',
    title: 'D-10 Job-Seeker Ceiling Up to 2–3 Years',
    summary: 'International graduates qualify for D-10 job-seeker extensions in 6–12 month increments up to 2–3 years before transitioning to E-7 skilled sponsorship.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Georgia',
    title: 'D3 Study Visa & Direct Work Permit Rules',
    summary: 'Georgia has no automatic post-study stay-back visa; graduates must secure an employer-sponsored Work Residence Permit before their D3 TRC expires.',
    tag: 'Visa & Stay-Back',
  },
  {
    country: 'Albania',
    title: 'Bologna ECTS & 9-Month Job-Search Permit',
    summary: 'Tirana degrees start from €1,900/yr with MOI waivers; Law No. 79/2021 grants eligible graduates a 9-month post-study permit transitioning to a Unique Permit.',
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
      ? `study abroad international students "${country}" ("post-study" OR "stay back" OR visa OR university OR tuition) when:30d`
      : 'study abroad international students ("post-study" OR "stay back" OR visa OR tuition) when:30d';

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;

    const [rssOutcome, liveStore] = await Promise.all([
      (async () => {
        try {
          const rssRes = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Orbis/2026' },
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
          });
          if (rssRes.ok) {
            const xml = await rssRes.text();
            const parsed = parseRssItems(xml, country && country !== 'All' ? country : 'Global');
            parsed.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            return parsed;
          }
        } catch {
          // Non-fatal: continue with policy updates if RSS fetch fails
        }
        return [] as NewsArticle[];
      })(),
      getLivePolicyStore(false),
    ]);

    const articles = rssOutcome;
    const liveUpdates: StudyAbroadUpdate[] = (liveStore.policyUpdates || []).map((u) => ({
      country: u.country,
      title: u.title,
      summary: u.summary,
      tag: u.tag,
      sourceUrl: u.sourceUrl,
      sourceName: u.sourceName,
      publishedAt: u.publishedAt,
      isLive: true,
    }));

    const seenKeys = new Set(liveUpdates.map((u) => `${u.country.toLowerCase()}::${u.title.toLowerCase()}`));
    const mergedUpdates: StudyAbroadUpdate[] = [
      ...liveUpdates,
      ...FALLBACK_UPDATES.filter((u) => !seenKeys.has(`${u.country.toLowerCase()}::${u.title.toLowerCase()}`)),
    ];

    return NextResponse.json(
      {
        success: true,
        fetchedAt: new Date().toISOString(),
        lastAutoSyncAt: liveStore.lastAutoSyncAt,
        country: country || 'All',
        articles,
        updates: mergedUpdates,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
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
