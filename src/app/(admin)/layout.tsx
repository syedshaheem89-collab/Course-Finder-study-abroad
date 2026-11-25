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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7]">
        <div className="w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 shadow-sm flex items-center justify-center text-[#0071E3]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-[13px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
          Verifying Admin Security Session &amp; 2FA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">
      <AdminSidebar adminUser={adminUser} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-[15px] text-[#1D1D1F] dark:text-white lg:hidden">
              {brandName}
            </span>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759] inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              2FA Protected
            </span>
            <span className="hidden md:inline-flex text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#A1A1A6]">
              Supabase Live
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[12px] font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Open Course Finder</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="lg:hidden p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#A1A1A6] cursor-pointer"
              title="Toggle appearance"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleLogout}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#FFEBE9] text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30] text-xs font-medium cursor-pointer"
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
