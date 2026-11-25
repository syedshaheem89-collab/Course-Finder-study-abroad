'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Search,
  Eye,
  TrendingUp,
  Wallet,
  Download,
  RefreshCw,
  Globe,
  MapPin,
  BookOpen,
  Building2,
  Smartphone,
  Share2,
} from 'lucide-react';
import { exportMarketReportToExcel } from '@/lib/excel-export';
import { useTheme } from '@/components/theme-provider';

interface MarketSummaryPayload {
  kpis: {
    totalSearches: number;
    totalCourseViews: number;
    totalLeads: number;
    hotLeads: number;
    basicLeads: number;
    conversionRate: number;
    loanDemandCount: number;
    moiDemandCount: number;
  };
  topCountries: { country: string; searches: number; leads: number; conversionRate: number }[];
  topCourses: { label: string; count: number }[];
  topUniversities: { label: string; count: number }[];
  topCities: { label: string; count: number }[];
  budgetBreakdown: { label: string; count: number }[];
  englishBreakdown: { label: string; count: number }[];
  intakeBreakdown: { label: string; count: number }[];
  deviceBreakdown: { label: string; count: number }[];
  sourceBreakdown: { label: string; count: number }[];
}

export default function AdminMarketAnalytics() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [summary, setSummary] = useState<MarketSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/summary', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const k = summary?.kpis || {
    totalSearches: 0,
    totalCourseViews: 0,
    totalLeads: 0,
    hotLeads: 0,
    basicLeads: 0,
    conversionRate: 0,
    loanDemandCount: 0,
    moiDemandCount: 0,
  };

  const renderProgressRows = (
    items: { label: string; count: number }[],
    emptyLabel: string,
    accentHex = '#0071E3'
  ) => {
    if (!items || items.length === 0) {
      return <p className="text-[12px] text-[#86868B] py-4">{emptyLabel}</p>;
    }
    const maxVal = Math.max(...items.map((i) => i.count), 1);
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate pr-2">
                {item.label}
              </span>
              <span className="font-semibold text-[#6E6E73] dark:text-[#A1A1A6] shrink-0">
                {item.count}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(8, Math.round((item.count / maxVal) * 100))}%`,
                  backgroundColor: accentHex,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
          Live search demand, student cities, and lead conversion metrics.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadSummary}
            disabled={loading}
            className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 hover:bg-[#F5F5F7] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>

          <button
            onClick={() => exportMarketReportToExcel(summary)}
            disabled={!summary}
            className="px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] text-white text-[12px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Market Report (.xlsx)
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Total Searches Tracked</span>
            <Search className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {k.totalSearches.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#86868B]">Country &amp; course keyword demand</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Course Detail Views</span>
            <Eye className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {k.totalCourseViews.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#86868B]">High-intent programme opens</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Lead Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-[#1D7A39] dark:text-[#30D158]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {k.conversionRate}%
          </p>
          <p className="text-[11px] text-[#1D7A39] dark:text-[#30D158]">
            {k.hotLeads} hot · {k.basicLeads} basic leads
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Loan &amp; MOI Demand</span>
            <Wallet className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {k.loanDemandCount} Loans · {k.moiDemandCount} MOI
          </p>
          <p className="text-[11px] text-[#86868B]">Bank loan &amp; IELTS-waiver buyers</p>
        </div>
      </div>

      {/* Row 1: Most Searched Countries + Top Courses/Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                Most Searched Countries &amp; Lead Yield
              </h3>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                Shows which destinations agencies are willing to pay premium CPL for
              </p>
            </div>
          </div>

          {!summary || summary.topCountries.length === 0 ? (
            <p className="text-[13px] text-[#86868B] py-10 text-center">
              Country search analytics will appear automatically as students browse or submit enquiries.
            </p>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.topCountries.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    />
                    <XAxis dataKey="country" stroke="#86868B" fontSize={11} tickLine={false} />
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

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-black/[0.08] dark:border-white/10 text-[10px] uppercase tracking-wider text-[#6E6E73]">
                      <th className="py-2 px-2">Country</th>
                      <th className="py-2 px-2">Searches</th>
                      <th className="py-2 px-2">Leads</th>
                      <th className="py-2 px-2 text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/5">
                    {summary.topCountries.map((row) => (
                      <tr key={row.country}>
                        <td className="py-2 px-2 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {row.country}
                        </td>
                        <td className="py-2 px-2 text-[#6E6E73] dark:text-[#A1A1A6]">{row.searches}</td>
                        <td className="py-2 px-2 font-medium text-[#1D7A39] dark:text-[#30D158]">
                          {row.leads}
                        </td>
                        <td className="py-2 px-2 text-right text-[#6E6E73] dark:text-[#A1A1A6]">
                          {row.conversionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              Most Searched Courses &amp; Keywords
            </h3>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
              High-demand degrees and subjects requested by students
            </p>
          </div>
          {renderProgressRows(
            summary?.topCourses || [],
            'No course searches recorded yet.'
          )}
        </div>
      </div>

      {/* Row 2: 3-column Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            Student Cities / Locations
          </h3>
          {renderProgressRows(
            summary?.topCities || [],
            'Student locations appear as leads are submitted.',
            '#1D1D1F'
          )}
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            Budget &amp; Education Loan Demand
          </h3>
          {renderProgressRows(
            summary?.budgetBreakdown || [],
            'Budget tiers appear as students run the 30s matcher.',
            '#0071E3'
          )}
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            English / MOI &amp; Intake Pipeline
          </h3>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] block mb-2">
                English Test Readiness
              </span>
              {renderProgressRows(
                summary?.englishBreakdown || [],
                'No test readiness data yet.'
              )}
            </div>
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/10">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] block mb-2">
                Target Intakes
              </span>
              {renderProgressRows(
                summary?.intakeBreakdown || [],
                'No intake preferences yet.',
                '#6E6E73'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Viewed Universities + Traffic Attribution & Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            Most Viewed Universities
          </h3>
          {renderProgressRows(
            summary?.topUniversities || [],
            'University click counts populate as visitors open course cards.'
          )}
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              Traffic Attribution (UTM / Referrer)
            </h3>
            {renderProgressRows(
              summary?.sourceBreakdown || [],
              'Direct, Instagram, Google, and WhatsApp campaign counts appear here.'
            )}
          </div>

          <div className="pt-4 border-t border-black/[0.06] dark:border-white/10">
            <h4 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 mb-2">
              <Smartphone className="w-3.5 h-3.5 text-[#6E6E73]" />
              Device Split (Mobile vs Desktop)
            </h4>
            {renderProgressRows(
              summary?.deviceBreakdown || [],
              'No device split data yet.',
              '#1D1D1F'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
