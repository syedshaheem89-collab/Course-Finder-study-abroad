'use client';

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
  ArrowUpRight,
} from 'lucide-react';
import DataIngestionHub from '@/components/data-ingestion-hub';
import CourseManager from '@/components/course-manager';

const INQUIRY_TRENDS = [
  { month: 'Jun', inquiries: 42, matches: 38 },
  { month: 'Jul', inquiries: 68, matches: 61 },
  { month: 'Aug', inquiries: 95, matches: 84 },
  { month: 'Sep', inquiries: 140, matches: 122 },
  { month: 'Oct', inquiries: 185, matches: 169 },
  { month: 'Nov', inquiries: 240, matches: 215 },
];

const DESTINATION_DISTRIBUTION = [
  { country: 'Germany', count: 145 },
  { country: 'Ireland', count: 98 },
  { country: 'Netherlands', count: 76 },
  { country: 'Australia', count: 64 },
  { country: 'Canada', count: 52 },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Executive Operations Dashboard</h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time metrics for courses catalog, ingested brochures, and AI student inquiries.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Courses */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Courses</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">1,420</span>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +12.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across 85 verified global institutions</p>
        </div>

        {/* KPI 2: Total Universities */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Universities</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">85</span>
            <span className="text-[11px] font-bold text-purple-400 flex items-center">
              Top 200 QS
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Germany, Ireland, NL, Sweden, AU</p>
        </div>

        {/* KPI 3: Recent Inquiries */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Recent Inquiries</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">842</span>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +28% this mo
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">AI suggestions generated & profile scored</p>
        </div>

        {/* KPI 4: Ingestion Sync Health */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">AI OCR Pipeline</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">99.2%</span>
            <span className="text-[11px] font-bold text-cyan-400">Gemini 1.5</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Brochure admission criteria parsing accuracy</p>
        </div>
      </div>

      {/* Analytics Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart: Inquiry & Matching Growth (8 cols) */}
        <div className="lg:col-span-8 glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Student Inquiries & AI Recommendations</h3>
              <p className="text-[11px] text-slate-400">Monthly conversion rate of inquiries through AI Matcher</p>
            </div>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
              2026 Trend
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INQUIRY_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="matchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inquiries"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#inqGrad)"
                  name="Inquiries"
                />
                <Area
                  type="monotone"
                  dataKey="matches"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#matchGrad)"
                  name="AI Recommendations"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Country Distribution (4 cols) */}
        <div className="lg:col-span-4 glass-card p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Popularity by Destination</h3>
            <p className="text-[11px] text-slate-400">Courses queried by international applicants</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DESTINATION_DISTRIBUTION} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="country" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Course Applications" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Ingestion Hub Section */}
      <DataIngestionHub />

      {/* Course & Eligibility Rules Manager Section */}
      <CourseManager />
    </div>
  );
}
