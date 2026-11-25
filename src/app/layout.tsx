import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { BRAND_CONTACT, DEFAULT_BRAND_NAME, SITE_URL } from '@/lib/seo-content';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${DEFAULT_BRAND_NAME} — The Global Course Finder (2026)`,
    template: `%s | ${DEFAULT_BRAND_NAME}`,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32 48x48' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  description:
    'Compare accredited Public & Private study abroad programmes across 35+ countries with MOI waivers, tuition in EUR/INR, and 2026 stay-back rules.',
  keywords: [
    'study abroad course finder',
    'international university finder 2026',
    'MOI accepting universities Europe',
    'study in Germany free tuition',
    'UK Graduate Route 2026',
    'Sweden 12 month stay back visa',
    'public vs private universities abroad',
    'study abroad eligibility checker',
    'post study work visa 2026',
    'study abroad shortlist',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: DEFAULT_BRAND_NAME,
    title: `${DEFAULT_BRAND_NAME} — Study Abroad Programmes & 2026 Visa Rules`,
    description:
      'Compare Public & Private universities across 35+ countries with live academic cutoff matching, MOI waivers, living funds, and 2026 stay-back durations.',
    images: [
      {
        url: '/images/dest-uk.jpg',
        width: 1200,
        height: 675,
        alt: 'International university architecture and campus study hub',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${DEFAULT_BRAND_NAME} — Study Abroad Course Finder (2026)`,
    description:
      'Compare Public & Private universities across 35+ destinations with 2026 stay-back visas, MOI policies, and exportable shortlists.',
    images: ['/images/dest-uk.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: DEFAULT_BRAND_NAME,
    alternateName: 'Orbis — The Global Course Finder',
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon.png`,
    email: BRAND_CONTACT.email,
    telephone: '+91-9605272725',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND_CONTACT.address,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9605272725',
      email: BRAND_CONTACT.email,
      contactType: 'admissions support',
    },
    description:
      'Orbis — The Global Course Finder. International higher-education directory and eligibility matching platform covering Public and Private universities, tuition in EUR/INR, MOI policies, and 2026 post-study stay-back rules.',
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_BRAND_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/courses?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <body className="antialiased selection:bg-[#0071E3] selection:text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
