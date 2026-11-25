'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  TableProperties,
  ShieldAlert,
  ShieldCheck,
  Globe,
  ClipboardList,
  Newspaper,
  Home,
  LogOut,
  Sun,
  Moon,
  Edit3,
  Check,
} from 'lucide-react';
import { useTheme } from './theme-provider';

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin';
}

interface AdminSidebarProps {
  adminUser?: AdminUserSummary | null;
  onLogout?: () => void;
}

function SidebarNavLinks() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';

  const navItems = [
    {
      id: 'overview',
      label: 'Overview & Analytics',
      href: '/admin?tab=overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'rules',
      label: 'Country & Language Rules',
      href: '/admin?tab=rules',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'ingestion',
      label: 'Excel, PDF & Web Sync',
      href: '/admin?tab=ingestion',
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: 'courses',
      label: 'Course Manager',
      href: '/admin?tab=courses',
      icon: <TableProperties className="w-4 h-4" />,
    },
    {
      id: 'security',
      label: 'Security & Accounts',
      href: '/admin?tab=security',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] px-3 block mb-1.5">
        Workspace
      </span>
      {navItems.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors ${
              isActive
                ? 'font-semibold text-[#0071E3] dark:text-[#2997FF] bg-[#0071E3]/10 dark:bg-[#2997FF]/15'
                : 'font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
            }`}
          >
            <span className={isActive ? 'text-[#0071E3] dark:text-[#2997FF]' : 'text-[#86868B]'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function AdminSidebar({ adminUser, onLogout }: AdminSidebarProps) {
  const { theme, toggleTheme, brandName, setBrandName } = useTheme();
  const [isEditingBrand, setIsEditingBrand] = useState<boolean>(false);
  const [tempBrand, setTempBrand] = useState<string>(brandName);
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const initials =
    (adminUser?.name || 'AD')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'AD';

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
    <aside className="w-64 bg-white dark:bg-[#1C1C1E] border-r border-black/[0.06] dark:border-white/10 min-h-screen hidden lg:flex flex-col justify-between p-4 sticky top-0 transition-colors">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="min-w-0 flex-1">
            {isEditingBrand ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempBrand}
                  onChange={(e) => setTempBrand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveBrand()}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  autoFocus
                />
                <button
                  onClick={saveBrand}
                  className="p-1 text-[#1D7A39] cursor-pointer"
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
                <span className="font-semibold text-[15px] tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                  {brandName}
                </span>
                <Edit3 className="w-3 h-3 text-[#86868B] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            )}
            <p className="text-[11px] text-[#6E6E73] dark:text-[#86868B]">
              Admin Control Center
            </p>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-[#6E6E73] dark:text-[#A1A1A6] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors cursor-pointer ml-1"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* White-Label Portal Name Editor */}
        <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[#6E6E73] dark:text-[#86868B] uppercase tracking-wider">
              Portal Brand Name
            </span>
            {savedToast && (
              <span className="text-[10px] font-medium text-[#1D7A39] dark:text-[#34C759] flex items-center gap-0.5">
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
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
            <button
              onClick={saveBrand}
              className="px-3 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[11px] font-medium cursor-pointer shrink-0 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Workspace Navigation */}
        <Suspense fallback={<div className="text-xs text-[#86868B] px-3">Loading menu...</div>}>
          <SidebarNavLinks />
        </Suspense>

        {/* Course Finder Direct Access */}
        <div className="space-y-1 pt-3 border-t border-black/[0.06] dark:border-white/10">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] px-3 block mb-1.5">
            Course Finder Access
          </span>
          <Link
            href="/courses"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:bg-[#0071E3]/10 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>Course Finder Directory</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >
            <Home className="w-4 h-4 text-[#86868B]" />
            <span>Course Finder Home</span>
          </Link>
          <Link
            href="/enquiry"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-[#86868B]" />
            <span>Student Enquiry Form</span>
          </Link>
          <Link
            href="/news"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >
            <Newspaper className="w-4 h-4 text-[#86868B]" />
            <span>Daily Study News</span>
          </Link>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 space-y-2.5">
        <div className="p-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] flex items-center justify-center font-semibold text-[11px] shrink-0">
            {initials}
          </div>
          <div className="text-[11px] leading-tight min-w-0 flex-1">
            <span className="text-[#1D1D1F] dark:text-white font-semibold block truncate">
              {adminUser?.name || 'Admin'}
            </span>
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] text-[10px] block truncate">
              {adminUser?.email || 'Verified Session'}
            </span>
            <span className="text-[#1D7A39] dark:text-[#34C759] text-[10px] font-medium inline-flex items-center gap-1 mt-0.5">
              {adminUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'} · 2FA Active
            </span>
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-medium text-[#C41E1E] dark:text-[#FF3B30] bg-[#FFEBE9] hover:bg-[#FFDCD9] dark:bg-[#FF3B30]/15 dark:hover:bg-[#FF3B30]/25 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
