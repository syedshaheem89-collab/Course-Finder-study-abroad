'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  GraduationCap,
  Building2,
  Users,
  ShieldCheck,
  LayoutDashboard,
  ShieldAlert,
  Database,
  TableProperties,
  BarChart3,
  Star,
} from 'lucide-react';
import DataIngestionHub from '@/components/data-ingestion-hub';
import CourseManager from '@/components/course-manager';
import CountryRulesManager from '@/components/country-rules-manager';
import AdminSecurityPanel from '@/components/admin-security-panel';
import AdminLeadsManager from '@/components/admin-leads-manager';
import AdminMarketAnalytics from '@/components/admin-market-analytics';
import AdminPriorityUniversities from '@/components/admin-priority-universities';
import { useTheme } from '@/components/theme-provider';

type AdminTab = 'overview' | 'leads' | 'analytics' | 'priority' | 'rules' | 'ingestion' | 'courses' | 'security';

function AdminDashboardContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab') as AdminTab | null;
  const activeTab: AdminTab =
    tabParam && ['overview', 'leads', 'analytics', 'priority', 'rules', 'ingestion', 'courses', 'security'].includes(tabParam)
      ? tabParam
      : 'overview';

  const [liveCourseCount, setLiveCourseCount] = useState<number | null>(null);
  const [liveUniCount, setLiveUniCount] = useState<number | null>(null);
  const [liveInquiriesCount, setLiveInquiriesCount] = useState<number | null>(null);
  const [liveTrendSeries, setLiveTrendSeries] = useState<{ date: string; searches: number; leads: number }[]>([]);
  const [liveTopCountries, setLiveTopCountries] = useState<{ country: string; searches: number; leads: number }[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const [metaRes, inqRes, analyticsRes] = await Promise.all([
          fetch('/api/courses?meta=true'),
          fetch('/api/inquiries', { cache: 'no-store' }),
          fetch('/api/analytics/summary', { cache: 'no-store' }),
        ]);
        const data = await metaRes.json();
        if (data.success) {
          setLiveCourseCount(data.totalCourses ?? 0);
          setLiveUniCount(Array.isArray(data.universities) ? data.universities.length : 0);
        }
        if (inqRes.ok) {
          const inqData = await inqRes.json();
          if (inqData.success && Array.isArray(inqData.inquiries)) {
            setLiveInquiriesCount(inqData.inquiries.length);
          }
        }
        if (analyticsRes.ok) {
          const aData = await analyticsRes.json();
          if (aData.success) {
            if (Array.isArray(aData.trendSeries)) setLiveTrendSeries(aData.trendSeries);
            if (Array.isArray(aData.topCountries)) setLiveTopCountries(aData.topCountries.slice(0, 6));
          }
        }
      } catch (e) {
        console.error('Stats fetch error:', e);
      }
    }
    loadStats();
  }, []);

  const isDark = theme === 'dark';

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'leads', label: 'Student Leads', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Market Intel', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'priority', label: 'Priority Unis', icon: <Star className="w-3.5 h-3.5" /> },
    { id: 'rules', label: 'Country Rules', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'ingestion', label: 'Excel, PDF & Sync', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'courses', label: 'Course Manager', icon: <TableProperties className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Security & Accounts', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  const handleTabChange = (id: AdminTab) => {
    router.push(`/admin?tab=${id}`);
  };

  return (
    <div className="space-y-8">
      {/* Header + Apple Segmented Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-[-0.025em]">
            {activeTab === 'overview' && 'Operations Dashboard'}
            {activeTab === 'leads' && 'Student Leads CRM'}
            {activeTab === 'analytics' && 'Market Intelligence & Demand'}
            {activeTab === 'priority' && 'Priority Universities & Sector Control'}
            {activeTab === 'rules' && 'Country & Language Rules'}
            {activeTab === 'ingestion' && 'Excel, PDF & Web Sync'}
            {activeTab === 'courses' && 'Course Manager'}
            {activeTab === 'security' && 'Security & Admin Accounts'}
          </h1>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] mt-1">
            {activeTab === 'overview' && 'Live overview of courses, institutions, and student inquiry analytics.'}
            {activeTab === 'leads' && 'View captured student contacts, filter by destination country, and export agency-ready Excel sheets.'}
            {activeTab === 'analytics' && 'Track most searched countries, courses, student cities, loan demand, and export reports to sell to agencies.'}
            {activeTab === 'priority' && 'Pin partner priority universities for UK, Germany, and all countries, and manage Public/Private overrides.'}
            {activeTab === 'rules' && 'Configure baseline academic cutoffs, MOI acceptance, and language waivers.'}
            {activeTab === 'ingestion' && 'Upload university spreadsheets, parse PDFs, or sync official university portals.'}
            {activeTab === 'courses' && 'Search, inline edit, bulk rectify, or export all courses in Excel (.xlsx).'}
            {activeTab === 'security' && 'Manage admin accounts, Authenticator 2FA policies, passwords, and audit logs.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 rounded-full self-start">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                    : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <section id="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                  Live Courses in DB
                </span>
                <GraduationCap className="w-4 h-4 text-[#86868B]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {liveCourseCount !== null ? liveCourseCount.toLocaleString() : '—'}
                </span>
                <span className="text-[11px] font-medium text-[#1D7A39] dark:text-[#34C759]">
                  Synced
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1">
                Active programmes searchable by students
              </p>
            </div>

            <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                  Institutions
                </span>
                <Building2 className="w-4 h-4 text-[#86868B]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {liveUniCount !== null ? liveUniCount.toLocaleString() : '—'}
                </span>
                <span className="text-[11px] font-medium text-[#0071E3] dark:text-[#2997FF]">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1">
                Accredited partner &amp; public universities
              </p>
            </div>

            <Link
              href="/admin?tab=leads"
              className="block bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-[#0071E3]/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                  Recent Inquiries
                </span>
                <Users className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {liveInquiriesCount !== null ? liveInquiriesCount.toLocaleString() : '—'}
                </span>
                <span className="text-[11px] font-medium text-[#1D7A39] dark:text-[#34C759]">
                  View Leads →
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1">
                Student qualification intakes stored safely
              </p>
            </Link>

            <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                  Security &amp; Rules
                </span>
                <ShieldCheck className="w-4 h-4 text-[#86868B]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Active</span>
                <span className="text-[11px] font-medium text-[#1D7A39] dark:text-[#34C759]">
                  2FA Vault
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1">
                MOI cutoffs &amp; admin access wall active
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Live Searches &amp; Leads (Last 14 Days)
                  </h3>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                    Daily search demand vs. captured student contacts
                  </p>
                </div>
                <Link
                  href="/admin?tab=analytics"
                  className="text-[11px] font-medium text-[#0071E3] dark:text-[#2997FF] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1 rounded-full hover:opacity-80"
                >
                  Full Market Intel →
                </Link>
              </div>

              {liveTrendSeries.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-[13px] text-[#86868B]">
                  Search activity will appear here as visitors browse programmes.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={liveTrendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="inqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0071E3" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                      />
                      <XAxis dataKey="date" stroke="#86868B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#86868B" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                          color: isDark ? '#F5F5F7' : '#1D1D1F',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="searches"
                        stroke="#0071E3"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#inqGrad)"
                        name="Searches"
                      />
                      <Area
                        type="monotone"
                        dataKey="leads"
                        stroke="#86868B"
                        strokeWidth={2}
                        fillOpacity={0.1}
                        fill="#86868B"
                        name="Leads"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Most Searched Countries
                </h3>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                  Real student destination demand
                </p>
              </div>

              {liveTopCountries.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-center text-[13px] text-[#86868B] px-4">
                  Search activity will appear here as visitors browse countries.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={liveTopCountries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                      />
                      <XAxis dataKey="country" stroke="#86868B" fontSize={10} tickLine={false} />
                      <YAxis stroke="#86868B" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                          color: isDark ? '#F5F5F7' : '#1D1D1F',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="searches" fill="#0071E3" radius={[6, 6, 0, 0]} name="Searches" />
                      <Bar dataKey="leads" fill="#86868B" radius={[6, 6, 0, 0]} name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: STUDENT LEADS CRM */}
      {activeTab === 'leads' && <AdminLeadsManager />}

      {/* TAB 3: MARKET INTELLIGENCE */}
      {activeTab === 'analytics' && <AdminMarketAnalytics />}

      {/* TAB 4: PRIORITY UNIVERSITIES */}
      {activeTab === 'priority' && <AdminPriorityUniversities />}

      {/* TAB 5: COUNTRY & LANGUAGE RULES */}
      {activeTab === 'rules' && (
        <div id="country-rules">
          <CountryRulesManager />
        </div>
      )}

      {/* TAB 3: EXCEL, PDF & WEB SYNC */}
      {activeTab === 'ingestion' && <DataIngestionHub />}

      {/* TAB 4: COURSE MANAGER */}
      {activeTab === 'courses' && <CourseManager />}

      {/* TAB 5: SECURITY & ACCOUNTS */}
      {activeTab === 'security' && <AdminSecurityPanel />}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-[#6E6E73]">
          Loading admin workspace...
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
