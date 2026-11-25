import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: 'Free 30-Second Eligibility Check & 12-Course AI Shortlist',
  description:
    'Enter your +2/Bachelor percentages, backlogs, IELTS or MOI status, and budget to receive 12 tailored Public and Private university recommendations with verified 2026 stay-back data.',
  alternates: {
    canonical: '/enquiry',
  },
  openGraph: {
    title: 'Student Qualification Enquiry — Instant 12-Programme Shortlist',
    description:
      'Check admission fit and get 12 curated study abroad options matched to your exact marks, budget, and preferred country.',
    url: `${SITE_URL}/enquiry`,
    images: [{ url: '/images/help-counselor.jpg', width: 1200, height: 800 }],
  },
};

export default function EnquiryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
