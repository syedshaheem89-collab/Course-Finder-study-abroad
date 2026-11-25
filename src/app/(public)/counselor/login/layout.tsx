import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Sign In',
  description: 'Staff counselor access portal.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CounselorLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
