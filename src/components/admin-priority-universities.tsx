'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Star,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle2,
  Loader2,
  Search,
  Building2,
  Globe,
} from 'lucide-react';
import { mergeCountryLists, normalizeCountryName } from '@/lib/countries';
import {
  PriorityUniversityRule,
  classifyUniversityType,
  sanitizePriorityRules,
} from '@/lib/university-classification';

interface MetaUniversity {
  id: string;
  name: string;
  country: string;
}

const QUICK_ADD_COUNTRIES = [
  'United Kingdom',
  'Germany',
  'Ireland',
  'Poland',
  'Canada',
  'Australia',
];

export default function AdminPriorityUniversities() {
  const [rules, setRules] = useState<PriorityUniversityRule[]>([]);
  const [metaCountries, setMetaCountries] = useState<string[]>([]);
  const [metaUniversities, setMetaUniversities] = useState<MetaUniversity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Filter state
  const [countryFilter, setCountryFilter] = useState<string>('ALL');

  // Add form state
  const [formCountry, setFormCountry] = useState<string>('United Kingdom');
  const [formUniName, setFormUniName] = useState<string>('');
  const [formRank, setFormRank] = useState<number>(1);
  const [formSectorOverride, setFormSectorOverride] = useState<'Auto' | 'Public' | 'Private'>('Auto');
  const [formNote, setFormNote] = useState<string>('');
  const [showUniSuggestions, setShowUniSuggestions] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setShowUniSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoading(true);
      try {
        const [settingsRes, metaRes] = await Promise.all([
          fetch('/api/site-settings', { cache: 'no-store' }),
          fetch('/api/courses?meta=true'),
        ]);
        const settingsData = await settingsRes.json();
        const metaData = await metaRes.json();
        if (cancelled) return;

        if (settingsData?.success && Array.isArray(settingsData.priorityUniversities)) {
          const clean = sanitizePriorityRules(settingsData.priorityUniversities);
          setRules(clean);
        }
        if (metaData?.success) {
          if (Array.isArray(metaData.countries)) setMetaCountries(metaData.countries);
          if (Array.isArray(metaData.universities)) setMetaUniversities(metaData.universities);
        }
      } catch (err) {
        console.error('Failed to load priority university settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const allCountries = useMemo(() => mergeCountryLists(metaCountries), [metaCountries]);

  // Auto-suggest next rank whenever country or rules list changes
  useEffect(() => {
    const inCountry = rules.filter(
      (r) => (normalizeCountryName(r.country) || r.country) === formCountry
    );
    const maxRank = inCountry.reduce((acc, r) => Math.max(acc, r.rank), 0);
    setFormRank(maxRank + 1);
  }, [formCountry, rules.length]);

  const uniSuggestions = useMemo(() => {
    const normCountry = (normalizeCountryName(formCountry) || formCountry).toLowerCase();
    const q = formUniName.trim().toLowerCase();
    return metaUniversities
      .filter((u) => {
        const uc = (normalizeCountryName(u.country) || u.country).toLowerCase();
        return uc === normCountry;
      })
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .slice(0, 25);
  }, [metaUniversities, formCountry, formUniName]);

  const autoPreviewSector = useMemo(() => {
    if (!formUniName.trim()) return 'Public';
    return classifyUniversityType(formUniName.trim(), formCountry);
  }, [formUniName, formCountry]);

  const configuredCountries = useMemo(() => {
    const s = new Set<string>();
    rules.forEach((r) => s.add(r.country));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rules]);

  const displayedRules = useMemo(() => {
    const filtered =
      countryFilter === 'ALL'
        ? rules
        : rules.filter((r) => r.country.toLowerCase() === countryFilter.toLowerCase());
    return [...filtered].sort((a, b) => {
      const c = a.country.localeCompare(b.country);
      return c !== 0 ? c : a.rank - b.rank;
    });
  }, [rules, countryFilter]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    const cleanUni = formUniName.replace(/\s+/g, ' ').trim();
    if (cleanUni.length < 2) {
      setSaveMessage({ type: 'error', text: 'Enter or select a valid university name.' });
      return;
    }

    const next = sanitizePriorityRules([
      ...rules,
      {
        id: `prio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        country: formCountry,
        university_name: cleanUni,
        rank: Number(formRank) || 1,
        sector_override: formSectorOverride,
        note: formNote.trim() || undefined,
      },
    ]);

    setRules(next);
    setDirty(true);
    setFormUniName('');
    setFormNote('');
    setFormSectorOverride('Auto');
    setShowUniSuggestions(false);
  };

  const handleUpdateRule = (id: string, patch: Partial<PriorityUniversityRule>) => {
    setRules((prev) =>
      sanitizePriorityRules(
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      )
    );
    setDirty(true);
    setSaveMessage(null);
  };

  const handleMoveRank = (id: string, direction: 'up' | 'down') => {
    const target = rules.find((r) => r.id === id);
    if (!target) return;

    const sameCountry = rules
      .filter((r) => r.country === target.country)
      .sort((a, b) => a.rank - b.rank);
    const idx = sameCountry.findIndex((r) => r.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCountry.length) return;

    const reordered = [...sameCountry];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved);

    const rankMap = new Map<string, number>();
    reordered.forEach((item, i) => rankMap.set(item.id, i + 1));

    setRules((prev) =>
      sanitizePriorityRules(
        prev.map((r) => (rankMap.has(r.id) ? { ...r, rank: rankMap.get(r.id)! } : r))
      )
    );
    setDirty(true);
    setSaveMessage(null);
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
    setSaveMessage(null);
  };

  const handleSaveGlobal = async (listOverride?: PriorityUniversityRule[]) => {
    setSaving(true);
    setSaveMessage(null);
    const payload = sanitizePriorityRules(listOverride ?? rules);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityUniversities: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveMessage({
          type: 'error',
          text: data?.error || 'Could not save priority university settings.',
        });
        return;
      }
      setRules(sanitizePriorityRules(data.priorityUniversities || payload));
      setDirty(false);
      setSaveMessage({
        type: 'success',
        text: 'Saved globally — active immediately on Course Finder & AI Matcher.',
      });
    } catch {
      setSaveMessage({
        type: 'error',
        text: 'Network error while saving priority universities.',
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition-all';
  const labelClass = 'text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-1.5';

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-2xl p-10 flex items-center justify-center gap-2 text-[13px] text-[#6E6E73]">
        <Loader2 className="w-4 h-4 animate-spin text-[#0071E3]" />
        <span>Loading priority universities &amp; sector settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            <h2 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Partner Priority Ranking &amp; Public/Private Overrides
            </h2>
            {dirty && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#2997FF]/15 dark:text-[#2997FF] text-[11px] font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
            Pin your agency&apos;s priority partner universities per country (UK, Germany, Poland, Ireland, Canada, etc.) so they appear first in Programme Directory and receive priority boosting in AI recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSaveGlobal()}
          disabled={saving}
          className="px-5 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Priority Settings'}</span>
        </button>
      </div>

      {saveMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-[13px] flex items-center gap-2 ${
            saveMessage.type === 'success'
              ? 'bg-[#E8F8EE] dark:bg-[#34C759]/15 border-[#34C759]/30 text-[#1D7A39] dark:text-[#34C759]'
              : 'bg-[#FFEBE9] dark:bg-[#FF3B30]/15 border-[#FF3B30]/30 text-[#C41E1E] dark:text-[#FF3B30]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* Add Priority / Partner University Card */}
      <form
        onSubmit={handleAddRule}
        className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/[0.06] dark:border-white/10">
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0071E3]" />
            <span>Add Priority University or Sector Override</span>
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#86868B] mr-1">Quick select:</span>
            {QUICK_ADD_COUNTRIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFormCountry(c)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                  formCountry === c
                    ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
                    : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className={labelClass}>Country</label>
            <select
              value={formCountry}
              onChange={(e) => {
                setFormCountry(e.target.value);
                setShowUniSuggestions(false);
              }}
              className={inputClass}
            >
              {allCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5 relative" ref={comboRef}>
            <label className={labelClass}>
              University Name ({uniSuggestions.length} in DB for {formCountry})
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formUniName}
                onFocus={() => setShowUniSuggestions(true)}
                onChange={(e) => {
                  setFormUniName(e.target.value);
                  setShowUniSuggestions(true);
                }}
                placeholder={`Search or type any university in ${formCountry}...`}
                className={`${inputClass} pl-9`}
              />
            </div>

            {showUniSuggestions && uniSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-2xl shadow-xl z-40 py-1.5">
                {uniSuggestions.map((u) => {
                  const autoSec = classifyUniversityType(u.name, u.country);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setFormUniName(u.name);
                        setShowUniSuggestions(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] flex items-center justify-between gap-2 text-[13px] cursor-pointer"
                    >
                      <span className="text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{u.name}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          autoSec === 'Public'
                            ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                            : 'bg-[#F5F5F7] text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]'
                        }`}
                      >
                        {autoSec}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {formUniName.trim() && (
              <p className="text-[11px] text-[#6E6E73] dark:text-[#86868B] mt-1">
                Auto-detected type:{' '}
                <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{autoPreviewSector}</strong>
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Priority Rank</label>
            <input
              type="number"
              min={1}
              max={999}
              value={formRank}
              onChange={(e) => setFormRank(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Institution Type</label>
            <select
              value={formSectorOverride}
              onChange={(e) => setFormSectorOverride(e.target.value as any)}
              className={inputClass}
            >
              <option value="Auto">Auto-Detect</option>
              <option value="Public">Force Public</option>
              <option value="Private">Force Private</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-9">
            <label className={labelClass}>Partner Note (Optional)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="e.g. Direct Tier-1 Partner · Fast CAS · MOI Accepted"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="w-full px-5 py-2.5 rounded-full bg-[#1D1D1F] hover:opacity-90 dark:bg-[#F5F5F7] dark:text-[#1D1D1F] text-white text-[13px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Priority List</span>
            </button>
          </div>
        </div>
      </form>

      {/* Configured Priority Universities Table */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
        <div className="p-5 border-b border-black/[0.06] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#6E6E73]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Active Priority Universities ({displayedRules.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCountryFilter('ALL')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                countryFilter === 'ALL'
                  ? 'bg-[#0071E3] text-white'
                  : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]'
              }`}
            >
              All Countries ({rules.length})
            </button>
            {configuredCountries.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCountryFilter(c)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                  countryFilter === c
                    ? 'bg-[#0071E3] text-white'
                    : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]'
                }`}
              >
                {c} ({rules.filter((r) => r.country === c).length})
              </button>
            ))}
          </div>
        </div>

        {displayedRules.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Globe className="w-8 h-8 text-[#86868B] mx-auto" />
            <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              No priority universities configured{countryFilter !== 'ALL' ? ` for ${countryFilter}` : ''} yet
            </p>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] max-w-md mx-auto">
              Add your preferred UK, Germany, Poland, Ireland, or Canada universities above, then click &ldquo;Save Priority Settings&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#2C2C2E]/40 text-[11px] uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B]">
                  <th className="py-3 px-4 font-medium">Order</th>
                  <th className="py-3 px-4 font-medium">Country</th>
                  <th className="py-3 px-4 font-medium">University</th>
                  <th className="py-3 px-4 font-medium">Sector Override</th>
                  <th className="py-3 px-4 font-medium">Partner Note</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/10">
                {displayedRules.map((rule) => {
                  const effectiveSector = classifyUniversityType(
                    rule.university_name,
                    rule.country,
                    undefined,
                    [rule]
                  );
                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-[#F5F5F7]/50 dark:hover:bg-[#2C2C2E]/30 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0071E3] dark:bg-[#2997FF]/15 dark:text-[#2997FF] font-semibold text-[11px]">
                            #{rule.rank}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveRank(rule.id, 'up')}
                            title="Move higher priority"
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#6E6E73] cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRank(rule.id, 'down')}
                            title="Move lower priority"
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#6E6E73] cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
                        {rule.country}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {rule.university_name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <select
                            value={rule.sector_override || 'Auto'}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, {
                                sector_override: e.target.value as 'Auto' | 'Public' | 'Private',
                              })
                            }
                            className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer focus:outline-none"
                          >
                            <option value="Auto">Auto-Detect</option>
                            <option value="Public">Public</option>
                            <option value="Private">Private</option>
                          </select>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              effectiveSector === 'Public'
                                ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                                : 'bg-[#F5F5F7] text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]'
                            }`}
                          >
                            {effectiveSector}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <input
                          type="text"
                          value={rule.note || ''}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { note: e.target.value })
                          }
                          placeholder="Add optional partner note..."
                          className="w-full bg-transparent border border-transparent hover:border-black/10 focus:border-[#0071E3] rounded-lg px-2 py-1 text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] focus:text-[#1D1D1F] dark:focus:text-white focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-full text-[#FF3B30] hover:bg-[#FFEBE9] dark:hover:bg-[#FF3B30]/15 cursor-pointer transition-colors"
                          title="Remove priority rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
