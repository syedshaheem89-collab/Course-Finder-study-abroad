'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  LayoutDashboard,
  Database,
  TableProperties,
  ShieldAlert,
  ChevronLeft,
  Sun,
  Moon,
  Edit3,
  Check,
  Sparkles
} from 'lucide-react';
import { useTheme } from './theme-provider';

export default function AdminSidebar() {
  const { theme, toggleTheme, brandName, setBrandName } = useTheme();
  const [isEditingBrand, setIsEditingBrand] = useState<boolean>(false);
  const [tempBrand, setTempBrand] = useState<string>(brandName);
  const [savedToast, setSavedToast] = useState<boolean>(false);

  useEffect(() => {
    setTempBrand(brandName);
  }, [brandName]);

  const saveBrand = () => {
    if (tempBrand.trim()) {
      setBrandName(tempBrand.trim());
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    }
    setIsEditingBrand(false);
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#0b0e17] border-r border-slate-200 dark:border-white/10 min-h-screen hidden lg:flex flex-col justify-between p-4 sticky top-0 transition-colors">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-cyan-500 rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={saveBrand}
                    className="p-1 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    title="Save name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 group cursor-pointer"
                  onClick={() => setIsEditingBrand(true)}
                  title="Click to rename portal"
                >
                  <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                    {brandName}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 transition-colors shrink-0" />
                </div>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Admin Control Hub
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 transition-all cursor-pointer ml-1"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
            )}
          </button>
        </div>

        {/* White-Label Portal Name Editor */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
              Portal Brand Name
            </span>
            {savedToast && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempBrand}
              onChange={(e) => setTempBrand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveBrand()}
              placeholder="Your brand name..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={saveBrand}
              className="neon-btn-cyan px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
            >
              Save
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block mb-1.5">
            Workspace
          </span>
          <a
            href="#overview"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 transition-all"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Overview &amp; Analytics</span>
          </a>
          <a
            href="#country-rules"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <span>Country &amp; Language Rules</span>
          </a>
          <a
            href="#data-hub"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Excel, PDF &amp; Web Sync</span>
          </a>
          <a
            href="#course-manager"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
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
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>View Public Website</span>
        </Link>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
            AD
          </div>
          <div className="text-[11px] leading-tight">
            <span className="text-slate-900 dark:text-white font-semibold block">Admin Superuser</span>
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Supabase Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
