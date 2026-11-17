'use client';

import Link from 'next/link';
import { Compass, Sparkles, Shield, Globe, Sun, Moon } from 'lucide-react';
import { useTheme } from './theme-provider';

export default function PublicNavbar() {
  const { theme, toggleTheme, brandName } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#0b0e17]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/25 group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                {brandName}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                2026
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              Study Abroad &amp; Admissions
            </p>
          </div>
        </Link>

        {/* Center Pill Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-white/10 shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Explore Courses
          </Link>
          <a
            href="#ai-wizard"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-purple-400" />
            AI Advisor
          </a>
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Shield className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            Admin Portal
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-cyan-500/40 transition-all cursor-pointer text-xs font-medium"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          <a
            href="#ai-wizard"
            className="neon-btn-cyan px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Match</span>
          </a>

          <Link
            href="/admin"
            className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
