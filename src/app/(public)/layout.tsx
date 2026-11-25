'use client';

import Link from 'next/link';
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

      <footer className="bg-[#F5F5F7] dark:bg-black border-t border-black/[0.08] dark:border-white/10 pt-12 pb-10 mt-16 text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Apple-Style Multi-Column Directory Footer (SEO Internal Links) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-2.5">
              <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Top Study Destinations
              </h3>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link href="/study-in/united-kingdom" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in United Kingdom
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/germany" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Germany
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/sweden" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Sweden
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/ireland" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Ireland
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/canada" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Canada
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/australia" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Australia
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                European Study Hubs
              </h3>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link href="/study-in/netherlands" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Netherlands
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/poland" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Poland
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/malta" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Malta
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/france" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in France
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/denmark" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Denmark
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/latvia" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Latvia
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Programme Directory
              </h3>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link href="/courses" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    All Programmes (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/courses?sector=Public" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Public Universities
                  </Link>
                </li>
                <li>
                  <Link href="/courses?sector=Private" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Private Universities
                  </Link>
                </li>
                <li>
                  <Link href="/courses?subject=Computer%20Science%20%26%20AI" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Computer Science &amp; AI
                  </Link>
                </li>
                <li>
                  <Link href="/courses?subject=Business%20%26%20Management" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Business, MBA &amp; Finance
                  </Link>
                </li>
                <li>
                  <Link href="/courses?subject=Engineering" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Engineering &amp; Technology
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Admissions &amp; Guides
              </h3>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link href="/enquiry" className="font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline">
                    Free Eligibility Shortlist
                  </Link>
                </li>
                <li>
                  <Link href="/news" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    2026 Visa &amp; Stay-Back News
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/finland" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Finland
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/italy" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Italy (DSU Aid)
                  </Link>
                </li>
                <li>
                  <Link href="/study-in/spain" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Study in Spain
                  </Link>
                </li>
                <li>
                  <Link href="/counselor/login" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
                    Team Sign In
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-black/[0.08] dark:border-white/10 space-y-3">
            <p className="text-[11px] leading-relaxed text-[#86868B]">
              Editorial Note: Post-study work stay-back permits, Sperrkonto, Migrationsverket, UKVI, and IND 2026 financial-proof figures are compiled from official national immigration guidance for planning clarity. Always verify final intake deadlines and embassy requirements on your chosen university’s official admissions page.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px]">
              <p className="font-normal">
                Copyright © 2026 {brandName}. All rights reserved.
              </p>
              <span className="text-[#86868B]">
                Accredited Global Directory · 2026 Stay-Back &amp; Show-Money Benchmarks
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
