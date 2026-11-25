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
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">
      <PublicNavbar />
      <div className="flex-1">{children}</div>
      <footer className="bg-[#F5F5F7] dark:bg-black border-t border-black/[0.08] dark:border-white/10 py-10 mt-16 text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="font-normal">
            Copyright © 2026 {brandName}. All rights reserved.
          </p>
          <p className="text-[12px] text-[#86868B]">
            Global Course Directory · Live Country Rules · Post-Study Work Analytics
          </p>
        </div>
      </footer>
    </div>
  );
}
