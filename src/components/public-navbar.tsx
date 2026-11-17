'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Compass, Sparkles, Shield, Globe, Sun, Moon, Edit3, Check } from 'lucide-react';
import { useTheme } from './theme-provider';

export default function PublicNavbar() {
  const { theme, toggleTheme, brandName } = useTheme();

  return (
    <header className="sticky top-0 z-50 glass-panel border-b backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo - Powered by Dynamic brandName state */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
            <Compass className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 dark:from-white dark:via-slate-100 dark:to-cyan-300 bg-clip-text text-transparent">
                {brandName}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                2026
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Study Abroad & Admissions</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-cyan-500 transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4 text-cyan-500" />
            Explore Courses
          </Link>
          <a
            href="#ai-wizard"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-purple-500 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Advisor
          </a>
          <Link
            href="/admin"
            className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-amber-500 transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-amber-500" />
            Admin Portal
          </Link>
        </nav>

        {/* Theme Toggle & Actions */}
        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-200/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-cyan-500 transition-all cursor-pointer shadow-sm"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <a
            href="#ai-wizard"
            className="neon-btn-cyan px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Profile Matcher</span>
          </a>
          <Link
            href="/admin"
            className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 bg-slate-200/60 dark:bg-white/5 border border-slate-300 dark:border-white/10 transition-all"
          >
            Admin Ingestion
          </Link>
        </div>
      </div>
    </header>
  );
}
