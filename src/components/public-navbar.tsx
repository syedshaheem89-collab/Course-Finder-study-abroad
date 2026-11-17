import Link from 'next/link';
import { Compass, Sparkles, Shield, GraduationCap, Globe } from 'lucide-react';

export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
            <Compass className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                AegisAbroad
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                AI 2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Study Abroad Intelligence</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className="text-sm font-medium text-slate-200 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            Explore Courses
          </Link>
          <a
            href="#ai-wizard"
            className="text-sm font-medium text-slate-200 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            AI Recommender
          </a>
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            Admin Portal
          </Link>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <a
            href="#ai-wizard"
            className="neon-btn-cyan px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Profile Matcher</span>
          </a>
          <Link
            href="/admin"
            className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
