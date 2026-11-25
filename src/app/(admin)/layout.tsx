'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminSidebar, { AdminUserSummary } from '@/components/admin-sidebar';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon, Globe, ShieldCheck, LogOut, Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { theme, toggleTheme, brandName } = useTheme();
  const [adminUser, setAdminUser] = useState<AdminUserSummary | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (!d?.authenticated || !d?.user) {
          router.replace('/admin/login');
          return;
        }
        setAdminUser(d.user);
        setCheckingAuth(false);
      })
      .catch(() => {
        if (active) router.replace('/admin/login');
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed to login even on network error
    }
    router.replace('/admin/login');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#07090e] text-slate-700 dark:text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-semibold tracking-wide">
          Verifying Admin Security Session &amp; 2FA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <AdminSidebar adminUser={adminUser} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 bg-white/85 dark:bg-[#0b0e17]/85 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-sm text-slate-900 dark:text-white lg:hidden">
              {brandName}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              2FA Protected
            </span>
            <span className="hidden md:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
              Supabase Live
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/courses"
              className="neon-btn-cyan inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Open Course Finder</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="lg:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <button
              onClick={handleLogout}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-xs font-bold cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
