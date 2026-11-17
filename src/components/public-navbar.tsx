'use client';

import Link from 'next/link';
import { Compass, Shield, Globe, Sun, Moon, ClipboardList } from 'lucide-react';
import { useTheme } from './theme-provider';

export default function PublicNavbar() {
  const { theme, toggleTheme, brandName } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0b0e17]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#0a3154] dark:bg-sky-600 flex items-center justify-center shadow-sm">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              {brandName}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300">
              2026
            </span>
          </div>
        </Link>

        {/* Clean Simple Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-cyan-400 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/courses"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
            All Programmes
          </Link>
          <Link
            href="/#enquiry-form"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Enquiry Form
          </Link>
          <Link
            href="/admin"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            Admin Portal
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-sky-500/40 transition-all cursor-pointer text-xs font-medium"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0a3154] hover:bg-[#0d416e] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
