'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import {
  Users,
  Download,
  RefreshCw,
  Search,
  Trash2,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Globe,
  Flame,
  LockOpen,
} from 'lucide-react';
import { exportLeadsToExcel } from '@/lib/excel-export';

interface InquiryRow {
  id: string;
  student_name: string;
  email: string;
  phone: string;
  background_profile?: Record<string, any>;
  ai_suggested_courses?: Record<string, any>;
  created_at: string;
}

export default function AdminLeadsManager() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'hot_qualified' | 'basic_lead'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inquiries', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.inquiries)) {
        setInquiries(data.inquiries);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleDeleteLead = async (id: string, name: string) => {
    if (!confirm(`Delete lead for "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInquiries((prev) => prev.filter((item) => item.id !== id));
        setBanner(`Deleted lead for ${name}.`);
      }
    } catch {
      setBanner('Failed to delete lead.');
    } finally {
      setDeletingId(null);
    }
  };

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    inquiries.forEach((inq) => {
      const c = String(inq.background_profile?.preferred_destination || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [inquiries]);

  const stats = useMemo(() => {
    let hot = 0;
    let basic = 0;
    inquiries.forEach((inq) => {
      if (inq.background_profile?.lead_tier === 'hot_qualified') hot++;
      else basic++;
    });
    return {
      total: inquiries.length,
      hot,
      basic,
      countriesCount: uniqueCountries.length,
    };
  }, [inquiries, uniqueCountries]);

  const filteredLeads = useMemo(() => {
    return inquiries.filter((inq) => {
      const bp = inq.background_profile || {};
      const tier = bp.lead_tier === 'hot_qualified' ? 'hot_qualified' : 'basic_lead';
      if (tierFilter !== 'ALL' && tier !== tierFilter) return false;

      const dest = String(bp.preferred_destination || '').trim();
      if (countryFilter !== 'ALL' && dest.toLowerCase() !== countryFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${inq.student_name || ''} ${inq.phone || ''} ${inq.email || ''} ${bp.place || ''} ${bp.city || ''} ${dest} ${bp.course || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inquiries, tierFilter, countryFilter, searchQuery]);

  const toWhatsappHref = (rawPhone: string) => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    return digits.length >= 7 ? `https://wa.me/${digits}` : null;
  };

  return (
    <div className="space-y-6">
      {banner && (
        <div className="p-3.5 rounded-2xl bg-[#E8F8EE] dark:bg-[#30D158]/15 border border-[#34C759]/25 text-[13px] font-medium text-[#1D7A39] dark:text-[#30D158] flex items-center justify-between">
          <span>{banner}</span>
          <button
            onClick={() => setBanner(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Apple KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Total Captured Leads</span>
            <Users className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {stats.total}
          </p>
          <p className="text-[11px] text-[#86868B]">Saved with contact details</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Hot Qualified Leads</span>
            <Flame className="w-4 h-4 text-[#1D7A39] dark:text-[#30D158]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {stats.hot}
          </p>
          <p className="text-[11px] text-[#1D7A39] dark:text-[#30D158]">
            Full academic &amp; budget profile
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Course Finder Gate Leads</span>
            <LockOpen className="w-4 h-4 text-[#6E6E73] dark:text-[#A1A1A6]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {stats.basic}
          </p>
          <p className="text-[11px] text-[#86868B]">Captured from public finder</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>Unique Target Countries</span>
            <Globe className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {stats.countriesCount}
          </p>
          <p className="text-[11px] text-[#86868B]">Filterable for agency batches</p>
        </div>
      </div>

      {/* Filter Toolbar & Table */}
      <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, city, course..."
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-full pl-9 pr-4 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
            </div>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-full px-4 py-2 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Countries ({inquiries.length})</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-full px-4 py-2 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Lead Tiers</option>
              <option value="hot_qualified">Hot Qualified (Enquiry)</option>
              <option value="basic_lead">Basic Gate Lead</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadLeads}
              disabled={loading}
              className="px-4 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => exportLeadsToExcel(filteredLeads, 'study-abroad-leads')}
              disabled={filteredLeads.length === 0}
              className="px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] text-white text-[12px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export Filtered Leads ({filteredLeads.length}) .xlsx
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.08] dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6]">
                <th className="py-2.5 px-2">Student &amp; City</th>
                <th className="py-2.5 px-2">Mobile / WhatsApp</th>
                <th className="py-2.5 px-2">Target &amp; Course</th>
                <th className="py-2.5 px-2">Academic Summary</th>
                <th className="py-2.5 px-2">Tier &amp; Consent</th>
                <th className="py-2.5 px-2">Date</th>
                <th className="py-2.5 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6E6E73]">
                    Loading captured student leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6E6E73]">
                    No leads match these filters yet.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((inq) => {
                  const bp = inq.background_profile || {};
                  const isHot = bp.lead_tier === 'hot_qualified';
                  const isExpanded = expandedId === inq.id;
                  const waHref = toWhatsappHref(inq.phone);
                  const aiRecs = Array.isArray(inq.ai_suggested_courses?.recommendations)
                    ? inq.ai_suggested_courses.recommendations
                    : [];

                  const academicParts = [
                    bp.bachelor?.percentage ? `Deg ${bp.bachelor.percentage}%` : null,
                    bp.plus2?.percentage ? `+2 ${bp.plus2.percentage}%` : null,
                    bp.tests?.ielts ? `IELTS ${bp.tests.ielts}` : null,
                    bp.budget ? `€${bp.budget}` : null,
                  ].filter(Boolean);

                  return (
                    <Fragment key={inq.id}>
                      <tr
                        className="hover:bg-[#F5F5F7]/70 dark:hover:bg-white/5 transition-colors align-top"
                      >
                        <td className="py-3 px-2">
                          <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {inq.student_name}
                          </div>
                          <div className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                            {bp.place || bp.city || 'Location not specified'}
                          </div>
                          {inq.email &&
                            inq.email !== 'counselor@intake.local' &&
                            inq.email !== 'student@lead.local' && (
                              <div className="text-[11px] text-[#86868B]">{inq.email}</div>
                            )}
                        </td>

                        <td className="py-3 px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${inq.phone}`}
                              className="inline-flex items-center gap-1 font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {inq.phone}
                            </a>
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Message on WhatsApp"
                                className="p-1 rounded-full bg-[#E8F8EE] text-[#1D7A39] hover:opacity-80"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-2">
                          <div className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {bp.preferred_destination || 'Any Country'}
                          </div>
                          <div className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                            {bp.course || bp.search_context || bp.target_level || 'Browsing'}
                          </div>
                        </td>

                        <td className="py-3 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                          {academicParts.length > 0 ? academicParts.join(' · ') : 'Basic Gate Profile'}
                        </td>

                        <td className="py-3 px-2">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                isHot
                                  ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158]'
                                  : 'bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                              }`}
                            >
                              {isHot ? 'Hot Qualified' : 'Basic Gate'}
                            </span>
                            {bp.consent_partner_contact && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#1D7A39] dark:text-[#30D158]">
                                <CheckCircle2 className="w-3 h-3" /> Consent OK
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] whitespace-nowrap">
                          {new Date(inq.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                              className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Details
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === inq.id}
                              onClick={() => handleDeleteLead(inq.id, inq.student_name)}
                              className="p-1.5 rounded-full bg-[#FFEBE9] hover:bg-[#FFD8D4] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961] cursor-pointer disabled:opacity-50"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${inq.id}-details`} className="bg-[#F5F5F7]/60 dark:bg-[#2C2C2E]/40">
                          <td colSpan={7} className="p-4 space-y-3 text-[12px]">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-xl border border-black/5 dark:border-white/10 space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73] block">
                                  Academic Credentials
                                </span>
                                <p className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  +2: {bp.plus2?.percentage ? `${bp.plus2.percentage}% (${bp.plus2.stream || '-'})` : '—'}
                                </p>
                                <p className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  Bachelor: {bp.bachelor?.degree || '—'} ({bp.bachelor?.percentage ? `${bp.bachelor.percentage}%` : '—'}) · Backlogs: {bp.bachelor?.backlogs ?? 0}
                                </p>
                                <p className="text-[#6E6E73]">
                                  Work Exp: {bp.work_experience_months ?? 0} months · Intake: {bp.target_intake || 'Flexible'}
                                </p>
                              </div>

                              <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-xl border border-black/5 dark:border-white/10 space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73] block">
                                  Language &amp; Notes
                                </span>
                                <p className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  IELTS: {bp.tests?.ielts || '—'} · PTE: {bp.tests?.pte || '—'} · GRE/GMAT: {bp.tests?.gre_gmat || '—'}
                                </p>
                                <p className="text-[#6E6E73]">Other: {bp.tests?.other_language || '—'}</p>
                                <p className="text-[#6E6E73]">Notes: {bp.specific_enquiry || '—'}</p>
                              </div>

                              <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-xl border border-black/5 dark:border-white/10 space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73] block">
                                  Saved AI Recommendations ({aiRecs.length})
                                </span>
                                {aiRecs.length === 0 ? (
                                  <p className="text-[#86868B]">No AI shortlist attached to this lead.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {aiRecs.slice(0, 4).map((r: any, idx: number) => (
                                      <li key={idx} className="text-[11px] text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                                        • {r.university_name} — {r.program_name} ({r.match_score || r.fit_score}%)
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
