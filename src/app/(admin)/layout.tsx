'use client';

import Link from 'next/link';
import AdminSidebar from '@/components/admin-sidebar';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon, ChevronLeft } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, toggleTheme, brandName } = useTheme();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 bg-white/85 dark:bg-[#0b0e17]/85 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-900 dark:text-white lg:hidden">
              {brandName}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Database:
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Supabase Live
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Scraper Worker:</span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="lg:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <Link
              href="/"
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Public
            </Link>
          </div>
        </header>
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
