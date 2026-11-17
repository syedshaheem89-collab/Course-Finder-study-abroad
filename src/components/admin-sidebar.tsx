'use client';

import Link from 'next/link';
import {
  Compass,
  LayoutDashboard,
  Database,
  TableProperties,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  LogOut,
  ChevronLeft,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from './theme-provider';

export default function AdminSidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 glass-panel border-r border-slate-200 dark:border-white/10 min-h-screen flex flex-col justify-between p-4 sticky top-0">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-white">GlobalCourse</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Data Control Hub</p>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-all cursor-pointer"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
            Management
          </span>
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-cyan-500 bg-slate-200/50 dark:bg-white/5 border border-slate-300/60 dark:border-white/5 transition-all"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-500" />
            <span>Dashboard Overview</span>
          </Link>
          <a
            href="#country-rules"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all"
          >
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <span>Country & Language Rules</span>
          </a>
          <a
            href="#data-hub"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all"
          >
            <Database className="w-4 h-4 text-indigo-500" />
            <span>Data Ingestion Hub</span>
          </a>
          <a
            href="#course-manager"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all"
          >
            <TableProperties className="w-4 h-4 text-purple-500" />
            <span>Course Manager</span>
          </a>
        </div>
      </div>

      {/* Footer controls */}
      <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-white/5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Student Portal</span>
        </Link>
        <div className="p-2.5 rounded-xl bg-slate-200/40 dark:bg-white/5 border border-slate-300/60 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-[10px]">
              AD
            </div>
            <div className="text-[11px] leading-tight">
              <span className="text-slate-800 dark:text-white font-medium block">Administrator</span>
              <span className="text-slate-500 text-[10px]">Supabase Production</span>
            </div>
          </div>
          <LogOut className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 cursor-pointer" />
        </div>
      </div>
    </aside>
  );
}
