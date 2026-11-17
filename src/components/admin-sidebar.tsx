'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  LayoutDashboard,
  Database,
  TableProperties,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  Sun,
  Moon,
  Edit3,
  Check
} from 'lucide-react';
import { useTheme } from './theme-provider';

export default function AdminSidebar() {
  const { theme, toggleTheme, brandName, setBrandName } = useTheme();
  const [isEditingBrand, setIsEditingBrand] = useState<boolean>(false);
  const [tempBrand, setTempBrand] = useState<string>(brandName);

  const saveBrand = () => {
    if (tempBrand.trim()) {
      setBrandName(tempBrand.trim());
    }
    setIsEditingBrand(false);
  };

  return (
    <aside className="w-64 glass-panel border-r border-slate-200 dark:border-white/10 min-h-screen flex flex-col justify-between p-4 sticky top-0">
      <div className="space-y-6">
        {/* Brand Header with Live Edit Access */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              {isEditingBrand ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempBrand}
                    onChange={(e) => setTempBrand(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveBrand()}
                    className="w-full bg-white dark:bg-slate-900 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white font-bold"
                    autoFocus
                  />
                  <button onClick={saveBrand} className="p-1 text-emerald-500 hover:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setIsEditingBrand(true)}>
                  <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-white truncate" title="Click to rename brand">
                    {brandName}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 transition-colors shrink-0" />
                </div>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Admin Control Hub</p>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-all cursor-pointer ml-1"
            title="Toggle Light / Dark mode"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
        </div>

        {/* Quick Rename Box in Admin Menu */}
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs">
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block mb-1">
            Portal Name (White-Label)
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempBrand}
              onChange={(e) => setTempBrand(e.target.value)}
              placeholder="e.g. EduPortal AI"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 font-semibold"
            />
            <button
              onClick={saveBrand}
              className="neon-btn-cyan px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
            >
              Save
            </button>
          </div>
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
