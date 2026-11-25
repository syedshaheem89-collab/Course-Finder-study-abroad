'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from './theme-provider';
import { setStaffAnalyticsBypass } from '@/lib/analytics-tracker';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'All Programmes' },
  { href: '/news', label: 'Daily News' },
  { href: '/enquiry', label: 'Enquiry Form' },
];

const HEADER_DESTINATIONS = [
  'United Kingdom',
  'Germany',
  'Sweden',
  'Ireland',
  'Netherlands',
  'Australia',
  'Canada',
  'Poland',
  'Malta',
];

export default function PublicNavbar() {
  const { theme, toggleTheme, brandName } = useTheme();
  const pathname = usePathname();
  const [destMenuOpen, setDestMenuOpen] = useState(false);
  const [staffState, setStaffState] = useState<{
    isStaff: boolean;
    isAdmin: boolean;
    name: string;
  }>({ isStaff: false, isAdmin: false, name: '' });

  useEffect(() => {
    setDestMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const isStaff = Boolean(d?.isStaff || d?.authenticated);
        const isAdmin = Boolean(d?.isAdmin);
        setStaffAnalyticsBypass(isStaff);
        setStaffState({
          isStaff,
          isAdmin,
          name: String(d?.user?.name || ''),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  const handleStaffSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    } finally {
      setStaffAnalyticsBypass(false);
      window.location.href = '/courses';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/85 dark:bg-black/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
        {/* Clean Editorial Wordmark */}
        <Link href="/" className="flex items-baseline gap-2 shrink-0 group">
          <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:opacity-80 transition-opacity">
            {brandName}
          </span>
          <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#86868B]">
            2026
          </span>
        </Link>

        {/* Plain Text Navigation + Apple-style Destinations Dropdown */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[13px] transition-colors ${
                  isActive
                    ? 'font-medium text-[#1D1D1F] dark:text-white'
                    : 'font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#0066CC] dark:hover:text-[#2997FF]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDestMenuOpen((p) => !p)}
            className={`text-[13px] inline-flex items-center gap-1 transition-colors cursor-pointer ${
              destMenuOpen
                ? 'font-medium text-[#0066CC] dark:text-[#2997FF]'
                : 'font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            <span>Destinations</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${destMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </nav>

        {/* Subtle Theme Toggle + Staff Pill + Primary CTA Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {staffState.isStaff && !staffState.isAdmin && (
            <button
              type="button"
              onClick={handleStaffSignOut}
              title={`Signed in as ${staffState.name || 'Counselor'} (click to sign out)`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer"
            >
              <span>{staffState.name ? `${staffState.name.split(' ')[0]} · ` : ''}Counselor · Sign Out</span>
              <LogOut className="w-3 h-3 text-[#6E6E73]" />
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} appearance`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} appearance`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <Link
            href="/enquiry"
            className="px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[12px] font-medium transition-colors"
          >
            {staffState.isStaff ? 'AI Quick Check' : 'Student Enquiry'}
          </Link>
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <div className="md:hidden border-t border-black/[0.05] dark:border-white/[0.08] px-4 py-2 flex items-center justify-around gap-2 overflow-x-auto no-scrollbar">
        {NAV_LINKS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[12px] whitespace-nowrap px-2 py-0.5 transition-colors ${
                isActive
                  ? 'font-semibold text-[#1D1D1F] dark:text-white'
                  : 'font-normal text-[#6E6E73] dark:text-[#A1A1A6]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {staffState.isStaff && !staffState.isAdmin && (
          <button
            type="button"
            onClick={handleStaffSignOut}
            className="text-[11px] font-medium text-[#0071E3] whitespace-nowrap px-2 py-0.5 cursor-pointer"
          >
            Sign Out
          </button>
        )}
      </div>
      {/* Apple Store-Style Destinations Flyout Panel */}
      {destMenuOpen && (
        <div
          className="hidden md:block border-t border-black/[0.06] dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
          onMouseLeave={() => setDestMenuOpen(false)}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-3 gap-8">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block mb-3">
                Top Study Destinations
              </span>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {HEADER_DESTINATIONS.map((country) => (
                  <Link
                    key={country}
                    href={`/courses?country=${encodeURIComponent(country)}`}
                    onClick={() => setDestMenuOpen(false)}
                    className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                  >
                    {country}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block mb-3">
                University Type
              </span>
              <div className="space-y-2.5 flex flex-col">
                <Link
                  href="/courses?sector=Public"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                >
                  Public Universities
                </Link>
                <Link
                  href="/courses?sector=Private"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                >
                  Private Universities
                </Link>
                <Link
                  href="/courses"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                >
                  Full Global Directory
                </Link>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block mb-3">
                Quick Tools
              </span>
              <div className="space-y-2.5 flex flex-col">
                <Link
                  href="/enquiry"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline"
                >
                  Student Qualification Enquiry →
                </Link>
                <Link
                  href="/news"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                >
                  2026 Visa &amp; Stay-Back Briefs
                </Link>
                <Link
                  href="/counselor/login"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[13px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                >
                  Team Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
