import type { Metadata } from 'next';
import { DEFAULT_BRAND_NAME, SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: '2026 Study Abroad Visa & Stay-Back Newsroom',
  description:
    'Read verified 2026 student visa policy briefs, post-study work rules, Sperrkonto & living funds benchmarks, and global higher education updates.',
  keywords: [
    'study abroad visa news 2026',
    'post study work visa updates 2026',
    'UK Graduate Route changes',
    'Germany Sperrkonto 2026',
    'Sweden 12 month stay back',
  ],
  alternates: {
    canonical: '/news',
  },
  openGraph: {
    type: 'website',
    siteName: DEFAULT_BRAND_NAME,
    title: '2026 Study Abroad Visa & Stay-Back Newsroom',
    description:
      'Follow 2026 financial-proof thresholds, post-study stay-back rules, MOI policies, and scholarship schemes across 15 destinations.',
    url: `${SITE_URL}/news`,
    images: [{ url: '/images/help-guide.jpg', width: 1200, height: 800 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `2026 Study Abroad Visa & Stay-Back Newsroom | ${DEFAULT_BRAND_NAME}`,
    description:
      'Verified 2026 immigration briefs, post-study work permits, and international higher-education headlines.',
    images: ['/images/help-guide.jpg'],
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Visa & Policy Newsroom', item: `${SITE_URL}/news` },
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
