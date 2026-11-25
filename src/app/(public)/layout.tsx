'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import PublicNavbar from '@/components/public-navbar';
import { useTheme } from '@/components/theme-provider';

const FOOTER_COLUMNS = [
  {
    title: 'Top Study Destinations',
    links: [
      { href: '/study-in/united-kingdom', label: 'Study in United Kingdom' },
      { href: '/study-in/germany', label: 'Study in Germany' },
      { href: '/study-in/sweden', label: 'Study in Sweden' },
      { href: '/study-in/ireland', label: 'Study in Ireland' },
      { href: '/study-in/canada', label: 'Study in Canada' },
      { href: '/study-in/australia', label: 'Study in Australia' },
    ],
  },
  {
    title: 'European Study Hubs',
    links: [
      { href: '/study-in/netherlands', label: 'Study in Netherlands' },
      { href: '/study-in/poland', label: 'Study in Poland' },
      { href: '/study-in/malta', label: 'Study in Malta' },
      { href: '/study-in/france', label: 'Study in France' },
      { href: '/study-in/denmark', label: 'Study in Denmark' },
      { href: '/study-in/latvia', label: 'Study in Latvia' },
    ],
  },
  {
    title: 'Programme Directory',
    links: [
      { href: '/courses', label: 'All Programmes (2026)' },
      { href: '/courses?sector=Public', label: 'Public Universities' },
      { href: '/courses?sector=Private', label: 'Private Universities' },
      { href: '/courses?subject=Computer%20Science%20%26%20AI', label: 'Computer Science & AI' },
      { href: '/courses?subject=Business%20%26%20Management', label: 'Business, MBA & Finance' },
      { href: '/courses?subject=Engineering', label: 'Engineering & Technology' },
    ],
  },
  {
    title: 'Admissions & Guides',
    links: [
      { href: '/enquiry', label: 'Free Eligibility Shortlist', highlight: true },
      { href: '/news', label: '2026 Visa & Stay-Back News' },
      { href: '/study-in/finland', label: 'Study in Finland' },
      { href: '/study-in/italy', label: 'Study in Italy (DSU Aid)' },
      { href: '/study-in/spain', label: 'Study in Spain' },
      { href: '/counselor/login', label: 'Sign In' },
    ],
  },
] as const;

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

      <footer className="bg-[#F5F5F7] dark:bg-black border-t border-black/[0.08] dark:border-white/10 pt-8 md:pt-12 pb-10 mt-12 md:mt-16 text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          {/* Desktop Multi-Column Directory Footer */}
          <div className="hidden md:grid md:grid-cols-4 gap-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-2.5">
                <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {col.title}
                </h3>
                <ul className="space-y-2 text-[12px]">
                  {col.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          'highlight' in item && item.highlight
                            ? 'font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline'
                            : 'hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors'
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Mobile Apple.com Collapsible Accordion Directory */}
          <div className="md:hidden divide-y divide-black/[0.08] dark:divide-white/10 border-y border-black/[0.08] dark:border-white/10">
            {FOOTER_COLUMNS.map((col) => (
              <details key={col.title} className="group py-3">
                <summary className="flex items-center justify-between text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer list-none">
                  <span>{col.title}</span>
                  <ChevronDown className="w-4 h-4 text-[#86868B] group-open:rotate-180 transition-transform" />
                </summary>
                <ul className="pt-2.5 pb-1 space-y-2 text-[13px]">
                  {col.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          'highlight' in item && item.highlight
                            ? 'block py-0.5 font-medium text-[#0066CC] dark:text-[#2997FF]'
                            : 'block py-0.5 text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#0066CC] dark:hover:text-[#2997FF]'
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <div className="pt-2 md:pt-6 md:border-t md:border-black/[0.08] md:dark:border-white/10 space-y-3">
            <p className="text-[11px] leading-relaxed text-[#86868B]">
              Editorial Note: Post-study work stay-back permits, Sperrkonto, Migrationsverket, UKVI, and IND 2026 financial-proof figures are compiled from official national immigration guidance for planning clarity. Always verify final intake deadlines and embassy requirements on your chosen university’s official admissions page.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px]">
              <p className="font-normal">
                Copyright © 2026 {brandName}. All rights reserved.
              </p>
              <span className="text-[#86868B] text-center sm:text-right">
                Accredited Global Course Finder · 2026 Tuition, MOI &amp; Stay-Back Benchmarks
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
