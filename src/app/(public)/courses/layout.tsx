import type { Metadata } from 'next';
import { DEFAULT_BRAND_NAME, SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: 'Study Abroad Programmes (2026) — Public & Private',
  description:
    'Filter Public and Private study abroad programmes by country, tuition in EUR or INR, MOI waivers, academic cutoffs, and 2026 post-study stay-back visas.',
  keywords: [
    'study abroad programmes 2026',
    'public and private universities abroad',
    'MOI accepted courses Europe',
    'tuition free universities Germany',
    'study abroad course comparison',
  ],
  alternates: {
    canonical: '/courses',
  },
  openGraph: {
    type: 'website',
    siteName: DEFAULT_BRAND_NAME,
    title: 'Study Abroad Programmes (2026) — Public & Private',
    description:
      'Compare admission cutoffs, MOI English waivers, 2026 living funds, and post-study stay-back durations across 32+ countries.',
    url: `${SITE_URL}/courses`,
    images: [{ url: '/images/dest-germany.jpg', width: 1200, height: 675 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Study Abroad Programmes (2026) | ${DEFAULT_BRAND_NAME}`,
    description:
      'Filter accredited Public and Private universities by country, tuition, MOI waivers, and 2026 post-study stay-back.',
    images: ['/images/dest-germany.jpg'],
  },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Programme Directory', item: `${SITE_URL}/courses` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
