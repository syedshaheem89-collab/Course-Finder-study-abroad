'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, LogOut, ChevronDown, Search, X, ChevronRight } from 'lucide-react';
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

const QUICK_GUIDE_LINKS = [
  { href: '/study-in/united-kingdom', label: 'UK Guide' },
  { href: '/study-in/germany', label: 'Germany Guide' },
  { href: '/study-in/sweden', label: 'Sweden Guide' },
  { href: '/study-in/ireland', label: 'Ireland Guide' },
  { href: '/study-in/poland', label: 'Poland Guide' },
];

export default function PublicNavbar() {
  const { theme, toggleTheme, brandName } = useTheme();
  const pathname = usePathname();
  const [destMenuOpen, setDestMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffState, setStaffState] = useState<{
    isStaff: boolean;
    isAdmin: boolean;
    name: string;
  }>({ isStaff: false, isAdmin: false, name: '' });

  useEffect(() => {
    setDestMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-3">
        {/* Clean Editorial Wordmark */}
        <Link href="/" className="flex items-baseline gap-2 shrink-0 group">
          <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:opacity-80 transition-opacity">
            {brandName}
          </span>
          <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#86868B]">
            2026
          </span>
        </Link>

        {/* Desktop Plain Text Navigation + Apple-style Destinations Dropdown */}
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

        {/* Desktop Right Controls */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {staffState.isStaff && !staffState.isAdmin ? (
            <button
              type="button"
              onClick={handleStaffSignOut}
              title={`Signed in as ${staffState.name || 'Counselor'} (click to sign out)`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer"
            >
              <span>{staffState.name ? `${staffState.name.split(' ')[0]} · ` : ''}Counselor · Sign Out</span>
              <LogOut className="w-3 h-3 text-[#6E6E73]" />
            </button>
          ) : !staffState.isStaff ? (
            <Link
              href="/counselor/login"
              className="text-[12px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white px-2 py-1 transition-colors"
            >
              Team
            </Link>
          ) : null}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} appearance`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} appearance`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            href="/enquiry"
            className="px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[12px] font-medium transition-colors"
          >
            {staffState.isStaff ? 'AI Quick Check' : 'Student Enquiry'}
          </Link>
        </div>

        {/* Apple.com Ultra-Clean Single-Row Mobile Controls */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <Link
            href="/courses"
            aria-label="Search Programmes"
            className="p-2 rounded-full text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors"
          >
            <Search className="w-[18px] h-[18px]" />
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-full text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} appearance`}
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-full text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
                className="w-[18px] h-[18px]"
              >
                <line x1="2" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Desktop Apple Store-Style Destinations Flyout Panel */}
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
                Quick Tools &amp; Guides
              </span>
              <div className="space-y-2.5 flex flex-col">
                <Link
                  href="/enquiry"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline"
                >
                  Free 12-Course AI Shortlist →
                </Link>
                <Link
                  href="/news"
                  onClick={() => setDestMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors"
                >
                  2026 Visa &amp; Stay-Back Briefs
                </Link>
                <div className="pt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                  {QUICK_GUIDE_LINKS.map((g) => (
                    <Link
                      key={g.href}
                      href={g.href}
                      onClick={() => setDestMenuOpen(false)}
                      className="text-[#0066CC] dark:text-[#2997FF] hover:underline"
                    >
                      {g.label}
                    </Link>
                  ))}
                </div>
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

      {/* Mobile Full-Screen Frosted Apple Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-12 bottom-0 z-50 md:hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl overflow-y-auto px-6 py-6 space-y-7 border-t border-black/[0.06] dark:border-white/10">
          <nav className="flex flex-col space-y-3">
            {NAV_LINKS.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between py-1 text-[24px] font-semibold tracking-[-0.02em] transition-colors ${
                    isActive
                      ? 'text-[#0066CC] dark:text-[#2997FF]'
                      : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                  }`}
                >
                  <span>{item.label === 'Enquiry Form' && staffState.isStaff ? 'AI Quick Check' : item.label}</span>
                  <ChevronRight className="w-5 h-5 text-[#86868B]" />
                </Link>
              );
            })}
          </nav>

          <Link
            href="/enquiry"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[15px] font-medium flex items-center justify-center transition-colors"
          >
            {staffState.isStaff ? 'Open AI Quick Check' : 'Fill Qualification Enquiry'}
          </Link>

          <div className="space-y-3 pt-2 border-t border-black/[0.06] dark:border-white/10">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block">
              University Type
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/courses?sector=Public"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] text-center"
              >
                Public Universities
              </Link>
              <Link
                href="/courses?sector=Private"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] text-center"
              >
                Private Universities
              </Link>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-black/[0.06] dark:border-white/10">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block">
              Top Destinations
            </span>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {HEADER_DESTINATIONS.map((country) => (
                <Link
                  key={country}
                  href={`/courses?country=${encodeURIComponent(country)}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0066CC] dark:hover:text-[#2997FF]"
                >
                  {country}
                </Link>
              ))}
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              {QUICK_GUIDE_LINKS.map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[12px] font-medium text-[#0066CC] dark:text-[#2997FF]"
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
            {staffState.isStaff && !staffState.isAdmin ? (
              <>
                <span className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
                  Counselor Mode{staffState.name ? ` · ${staffState.name}` : ''}
                </span>
                <button
                  type="button"
                  onClick={handleStaffSignOut}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer"
                >
                  <span>Sign Out</span>
                  <LogOut className="w-3.5 h-3.5 text-[#6E6E73]" />
                </button>
              </>
            ) : !staffState.isStaff ? (
              <Link
                href="/counselor/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[13px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline"
              >
                Team Sign In →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
