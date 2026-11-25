import type { Metadata } from 'next';
import { DEFAULT_BRAND_NAME, SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: 'Free Eligibility Check & 12-Course Shortlist',
  description:
    'Check your academic percentages, backlogs, English or MOI status, and budget for a personalised 12-programme shortlist with 2026 stay-back rules.',
  keywords: [
    'study abroad eligibility checker',
    'university course matcher 2026',
    'free study abroad shortlist',
    'MOI university eligibility',
  ],
  alternates: {
    canonical: '/enquiry',
  },
  openGraph: {
    type: 'website',
    siteName: DEFAULT_BRAND_NAME,
    title: 'Free Eligibility Check & 12-Course Shortlist',
    description:
      'Check admission fit and receive 12 curated study abroad programmes matched to your marks, budget, and preferred country.',
    url: `${SITE_URL}/enquiry`,
    images: [{ url: '/images/help-counselor.jpg', width: 1200, height: 800 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Free Eligibility Check & 12-Course Shortlist | ${DEFAULT_BRAND_NAME}`,
    description:
      'Match your 12th or Bachelor marks, English/MOI status, and budget to accredited universities abroad.',
    images: ['/images/help-counselor.jpg'],
  },
};

export default function EnquiryLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Eligibility Check', item: `${SITE_URL}/enquiry` },
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
