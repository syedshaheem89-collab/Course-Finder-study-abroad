'use client';

import PublicNavbar from '@/components/public-navbar';
import { useTheme } from '@/components/theme-provider';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { brandName } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <PublicNavbar />
      <div className="flex-1">{children}</div>
      <footer className="bg-white dark:bg-[#0b0e17] border-t border-slate-200 dark:border-white/10 py-8 mt-16 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            © 2026 {brandName} — Global Study Abroad Course Finder &amp; AI Admissions Intelligence
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Live Country Eligibility Rules • MOI &amp; Waiver Support • Post-Study Work Visa Analytics
          </p>
        </div>
      </footer>
    </div>
  );
}
