import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Advisor sign-in portal for study abroad course research and eligibility checks.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CounselorLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
