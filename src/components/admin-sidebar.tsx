import Link from 'next/link';
import {
  Compass,
  LayoutDashboard,
  Database,
  TableProperties,
  Globe2,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  ChevronLeft
} from 'lucide-react';

export default function AdminSidebar() {
  return (
    <aside className="w-64 glass-panel border-r border-white/10 min-h-screen flex flex-col justify-between p-4 sticky top-0">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">AegisAbroad</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Data Control & Intake Hub</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Management
          </span>
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            <span>Dashboard Overview</span>
          </Link>
          <a
            href="#data-hub"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Data Ingestion Hub</span>
          </a>
          <a
            href="#course-manager"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <TableProperties className="w-4 h-4 text-purple-400" />
            <span>Course & Criteria Manager</span>
          </a>
        </div>

        {/* Pipelines Section */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Ingestion Pipelines
          </span>
          <a
            href="#excel-zone"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk Excel / CSV Loader</span>
          </a>
          <a
            href="#pdf-zone"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>AI Brochure PDF Reader</span>
          </a>
          <a
            href="#web-sync"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-sky-400" />
            <span>Web Scraper Sync</span>
          </a>
        </div>
      </div>

      {/* Footer controls */}
      <div className="pt-4 border-t border-white/10 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Student Portal</span>
        </Link>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
              AD
            </div>
            <div className="text-[11px] leading-tight">
              <span className="text-white font-medium block">Admin Superuser</span>
              <span className="text-slate-500">Supabase RLS</span>
            </div>
          </div>
          <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 cursor-pointer" />
        </div>
      </div>
    </aside>
  );
}
