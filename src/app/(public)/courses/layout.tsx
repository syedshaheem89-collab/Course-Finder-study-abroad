import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: 'All Study Abroad Programmes (2026) — Public, Private & Tuition Directory',
  description:
    'Filter accredited Bachelor, Master, MBA & PG Diploma courses by Public or Private sector, country, tuition ceiling in EUR or INR, MOI acceptance, and 2026 post-study stay-back visas.',
  alternates: {
    canonical: '/courses',
  },
  openGraph: {
    title: 'Programme Directory (2026) — Compare Public & Private Universities Abroad',
    description:
      'Compare admission cutoffs, MOI English waivers, 2026 show money, and post-study stay-back durations across 32+ countries with instant Excel export.',
    url: `${SITE_URL}/courses`,
    images: [{ url: '/images/dest-germany.jpg', width: 1200, height: 675 }],
  },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
