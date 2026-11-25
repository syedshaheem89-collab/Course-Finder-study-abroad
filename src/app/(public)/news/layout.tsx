import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: '2026 Study Abroad Newsroom — Visa, Stay-Back & Tuition Policy Updates',
  description:
    'Read verified 2026 student visa policy briefs, post-study work rules (UK Graduate Route, Sweden 12-mo permit, German Sperrkonto, Australian Subclass 485), and live global education headlines.',
  alternates: {
    canonical: '/news',
  },
  openGraph: {
    title: 'Newsroom & 2026 Visa Updates — International Higher Education Briefs',
    description:
      'Stay updated on 2026 financial-proof thresholds, post-study stay-back policies, MOI waivers, and national scholarship schemes across 12+ destinations.',
    url: `${SITE_URL}/news`,
    images: [{ url: '/images/help-guide.jpg', width: 1200, height: 800 }],
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
