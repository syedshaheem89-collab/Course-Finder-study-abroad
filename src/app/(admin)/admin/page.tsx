'use client';

import { Suspense, useState, useEffect } from 'react';
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
  TrendingUp,
  Sparkles,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Database,
  TableProperties
} from 'lucide-react';
import DataIngestionHub from '@/components/data-ingestion-hub';
import CourseManager from '@/components/course-manager';
import CountryRulesManager from '@/components/country-rules-manager';
import AdminSecurityPanel from '@/components/admin-security-panel';
import { useTheme } from '@/components/theme-provider';

const INQUIRY_TRENDS = [
  { month: 'Jun', inquiries: 42, matches: 38 },
  { month: 'Jul', inquiries: 68, matches: 61 },
  { month: 'Aug', inquiries: 95, matches: 84 },
  { month: 'Sep', inquiries: 140, matches: 122 },
  { month: 'Oct', inquiries: 185, matches: 169 },
  { month: 'Nov', inquiries: 240, matches: 215 },
];

const DESTINATION_DISTRIBUTION = [
  { country: 'Malta', count: 180 },
  { country: 'Germany', count: 145 },
  { country: 'Ireland', count: 98 },
  { country: 'Netherlands', count: 76 },
  { country: 'Australia', count: 64 },
];

type AdminTab = 'overview' | 'rules' | 'ingestion' | 'courses' | 'security';

function AdminDashboardContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab') as AdminTab | null;
  const activeTab: AdminTab =
    tabParam && ['overview', 'rules', 'ingestion', 'courses', 'security'].includes(tabParam)
      ? tabParam
      : 'overview';

  const [liveCourseCount, setLiveCourseCount] = useState<number | null>(null);
  const [liveUniCount, setLiveUniCount] = useState<number | null>(null);
  const [liveInquiriesCount, setLiveInquiriesCount] = useState<number | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const [metaRes, inqRes] = await Promise.all([
          fetch('/api/courses?meta=true'),
          fetch('/api/inquiries', { cache: 'no-store' }),
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
      } catch (e) {
        console.error('Stats fetch error:', e);
      }
    }
    loadStats();
  }, []);

  const isLight = theme === 'light';

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
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
      {/* Header + Top Pill Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {activeTab === 'overview' && 'Operations Dashboard'}
            {activeTab === 'rules' && 'Country & Language Rules'}
            {activeTab === 'ingestion' && 'Excel, PDF & Web Sync'}
            {activeTab === 'courses' && 'Course Manager'}
            {activeTab === 'security' && 'Security & Admin Accounts'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'overview' && 'Live overview of courses, universities, and student inquiry analytics.'}
            {activeTab === 'rules' && 'Configure baseline academic cutoffs, MOI acceptance, and language waivers.'}
            {activeTab === 'ingestion' && 'Upload university spreadsheets, parse PDFs with AI, or sync web portals.'}
            {activeTab === 'courses' && 'Search, inline edit, delete, or download all courses in Excel (.xlsx).'}
            {activeTab === 'security' && 'Manage admin accounts, 2FA Authenticator policies, passwords, and audit logs.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm self-start">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'neon-btn-cyan shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
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
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Live Courses in DB
                </span>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {liveCourseCount !== null ? liveCourseCount : '—'}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-0.5" /> Synced
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Active programs searchable by students
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Universities
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {liveUniCount !== null ? liveUniCount : '—'}
                </span>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Malta, Germany, Ireland, NL, Australia
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Recent Inquiries
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {liveInquiriesCount !== null ? liveInquiriesCount : '—'}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-0.5" /> Protected
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                AI profile assessments completed
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  MOI &amp; Waiver Rules
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">Active</span>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                  Rules Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                50% Malta Cutoff &amp; MOI Supported
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 glass-card p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Student Inquiries &amp; AI Recommendations
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Monthly conversion of student profiles matched to courses
                  </p>
                </div>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                  2026 Trend
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={INQUIRY_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'}
                    />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#ffffff' : '#0f172a',
                        borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="inquiries"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#inqGrad)"
                      name="Inquiries"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 glass-card p-6 rounded-2xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Popularity by Destination
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Top countries searched by applicants
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DESTINATION_DISTRIBUTION} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'}
                    />
                    <XAxis dataKey="country" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#ffffff' : '#0f172a',
                        borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} name="Inquiries" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: COUNTRY & LANGUAGE RULES ONLY */}
      {activeTab === 'rules' && (
        <div id="country-rules">
          <CountryRulesManager />
        </div>
      )}

      {/* TAB 3: EXCEL, PDF & WEB SYNC ONLY */}
      {activeTab === 'ingestion' && <DataIngestionHub />}

      {/* TAB 4: COURSE MANAGER ONLY */}
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
        <div className="py-12 text-center text-xs text-slate-500">
          Loading admin workspace...
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
