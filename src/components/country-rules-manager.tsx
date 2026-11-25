'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Save,
  CheckCircle2,
  CalendarClock,
  UserCheck,
  Award,
  RefreshCw,
  Globe,
  RotateCcw,
} from 'lucide-react';
import { InstitutionalRule } from '@/types/database';
import { STUDY_ABROAD_COUNTRIES } from '@/lib/countries';
import { formatStayBack, getCountryVisaIntel } from '@/lib/country-visa-intel';
import { getLivingCostGuide } from '@/lib/student-guides';
import { LivePolicyStoreData } from '@/lib/live-policy-types';

export const GLOBAL_COUNTRIES = STUDY_ABROAD_COUNTRIES;

export default function CountryRulesManager() {
  const [rules, setRules] = useState<InstitutionalRule[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [scope, setScope] = useState<'COUNTRY' | 'UNIVERSITY'>('COUNTRY');
  const [targetName, setTargetName] = useState<string>('Malta');
  const [minDegree, setMinDegree] = useState<number>(50);
  const [min12th, setMin12th] = useState<number>(50);
  const [justPass, setJustPass] = useState<boolean>(false);
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(40);
  const [maxGapYears, setMaxGapYears] = useState<number>(8);
  const [englishPolicy, setEnglishPolicy] = useState<'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT'>('MOI_ACCEPTED');
  const [minIelts] = useState<number>(5.5);
  const [notes, setNotes] = useState<string>('National pass grade (50%) accepted; Medium of Instruction (MOI) recognized in place of IELTS.');

  // Live Auto-Update & Policy Override controls
  const [liveStore, setLiveStore] = useState<LivePolicyStoreData | null>(null);
  const [syncCountry, setSyncCountry] = useState<string>('__auto__');
  const [syncingLive, setSyncingLive] = useState<boolean>(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

  const [ovCountry, setOvCountry] = useState<string>('Georgia');
  const [ovMasterStay, setOvMasterStay] = useState<string>('0');
  const [ovBachelorStay, setOvBachelorStay] = useState<string>('0');
  const [ovShowMoney, setOvShowMoney] = useState<string>('5500');
  const [ovVisaSummary, setOvVisaSummary] = useState<string>('');
  const [ovSourceUrl, setOvSourceUrl] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState<boolean>(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLivePolicy = async () => {
    try {
      const res = await fetch('/api/live-policy', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setLiveStore({
          countryOverrides: data.countryOverrides || {},
          policyUpdates: data.policyUpdates || [],
          lastAutoSyncAt: data.lastAutoSyncAt || null,
          lastFeeSyncAt: data.lastFeeSyncAt || null,
          lastSyncSummary: data.lastSyncSummary || '',
          lastBatchOffset: data.lastBatchOffset || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadCountryIntoOverrideForm = (countryName: string, storeData?: LivePolicyStoreData | null) => {
    setOvCountry(countryName);
    const activeOv = (storeData ?? liveStore)?.countryOverrides?.[countryName];
    const baseMaster = getCountryVisaIntel(countryName, 'Master');
    const baseBach = getCountryVisaIntel(countryName, 'Bachelor');
    const baseLiving = getLivingCostGuide(countryName);
    setOvMasterStay(String(activeOv?.stayBackYears ?? baseMaster.stayBackYears));
    setOvBachelorStay(String(activeOv?.bachelorStayBackYears ?? baseBach.bachelorStayBackYears ?? baseBach.stayBackYears));
    setOvShowMoney(String(activeOv?.showMoneyEur ?? baseLiving.amountEur));
    setOvVisaSummary(activeOv?.visaSummary || baseMaster.visaSummary);
    setOvSourceUrl(activeOv?.sourceUrl || '');
  };

  useEffect(() => {
    fetchRules();
    fetchLivePolicy();
    loadCountryIntoOverrideForm('Georgia', null);
  }, []);

  const handleRunAutoSync = async () => {
    if (syncingLive) return;
    setSyncingLive(true);
    setSyncResultMsg(null);
    try {
      const res = await fetch('/api/cron/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countries: syncCountry === '__auto__' ? undefined : [syncCountry],
          syncFees: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResultMsg(data.summary || 'Live auto-update completed.');
        await fetchLivePolicy();
      } else {
        setSyncResultMsg(data.error || 'Auto-update failed.');
      }
    } catch (err: any) {
      setSyncResultMsg(err?.message || 'Auto-update request failed.');
    } finally {
      setSyncingLive(false);
    }
  };

  const handleSaveLiveOverride = async () => {
    if (savingOverride) return;
    setSavingOverride(true);
    setOverrideMsg(null);
    try {
      const res = await fetch('/api/live-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          country: ovCountry,
          stayBackYears: Number(ovMasterStay),
          bachelorStayBackYears: Number(ovBachelorStay),
          showMoneyEur: Number(ovShowMoney),
          visaSummary: ovVisaSummary,
          sourceUrl: ovSourceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOverrideMsg(`Live policy saved for ${ovCountry}`);
        await fetchLivePolicy();
        setTimeout(() => setOverrideMsg(null), 3500);
      } else {
        setOverrideMsg(data.error || 'Failed to save override.');
      }
    } catch (err: any) {
      setOverrideMsg(err?.message || 'Failed to save override.');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteLiveOverride = async (countryName: string) => {
    try {
      const res = await fetch('/api/live-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', country: countryName }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchLivePolicy();
        if (countryName === ovCountry) {
          loadCountryIntoOverrideForm(countryName, {
            countryOverrides: data.countryOverrides || {},
            policyUpdates: data.policyUpdates || [],
            lastAutoSyncAt: data.lastAutoSyncAt || null,
            lastFeeSyncAt: data.lastFeeSyncAt || null,
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRule = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          target_name: targetName,
          default_min_degree_percent: justPass ? 35 : minDegree,
          default_min_12th_percent: justPass ? 35 : min12th,
          just_pass_accepted: justPass,
          min_age: minAge,
          max_age: maxAge,
          max_gap_years: maxGapYears,
          english_policy: englishPolicy,
          default_min_ielts: minIelts,
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Rule for ${targetName} saved!`);
        fetchRules();
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 sm:p-7 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/10">
        <div>
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0071E3]" />
            Country &amp; University Eligibility Rules
          </h3>
          <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
            Set minimum marks or Just Pass, Age limits, Study Gap limits, and English / MOI policies.
          </p>
        </div>
        {successMsg && (
          <span className="text-xs text-[#1D7A39] dark:text-[#34C759] bg-[#E8F8EE] dark:bg-[#34C759]/15 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
        )}
      </div>

      {/* Configuration Form */}
      <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-4">
        {/* Row 1: Scope, Target, Marks + Just Pass, Language Policy */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1.5">
              Rule Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            >
              <option value="COUNTRY">Country Baseline</option>
              <option value="UNIVERSITY">University Specific</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1.5">
              {scope === 'COUNTRY' ? 'Target Country' : 'University Name'}
            </label>
            {scope === 'COUNTRY' ? (
              <select
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              >
                {GLOBAL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g. MCAST, TUM, Trinity College"
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                Min % Cutoff
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={justPass}
                  onChange={(e) => setJustPass(e.target.checked)}
                  className="accent-[#0071E3] rounded cursor-pointer"
                />
                <span>Just Pass</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={justPass}
                value={justPass ? 35 : minDegree}
                onChange={(e) => {
                  setMinDegree(Number(e.target.value));
                  setMin12th(Number(e.target.value));
                }}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-60"
              />
              <span className="absolute right-3 top-2 text-xs text-[#86868B]">
                {justPass ? 'Pass' : '%'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1.5">
              English Language Policy
            </label>
            <select
              value={englishPolicy}
              onChange={(e) => setEnglishPolicy(e.target.value as any)}
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            >
              <option value="MOI_ACCEPTED">MOI Accepted (Medium of Instruction)</option>
              <option value="WAIVED">English Score Waived (Exempt)</option>
              <option value="NO_REQUIREMENT">No Language Requirement</option>
              <option value="IELTS_TOEFL">Mandatory IELTS / TOEFL</option>
            </select>
          </div>
        </div>

        {/* Row 2: Age Limit & Study Gap Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-black/[0.06] dark:border-white/10">
          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#86868B]" /> Min Age Allowed
            </label>
            <input
              type="number"
              min="16"
              max="60"
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#86868B]" /> Max Age Limit
            </label>
            <input
              type="number"
              min="18"
              max="70"
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-[#86868B]" /> Max Study Gap Allowed (Years)
            </label>
            <input
              type="number"
              min="0"
              max="25"
              value={maxGapYears}
              onChange={(e) => setMaxGapYears(Number(e.target.value))}
              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Policy notes (e.g. Just Pass accepted; Max 8 yrs gap; MOI recognized)"
          className="flex-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3.5 py-2.5 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
        />
        <button
          onClick={handleSaveRule}
          disabled={saving}
          className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
      </div>

      {/* Active Rules List */}
      <div className="space-y-3 pt-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
          Active Country &amp; University Rules
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {rules.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.04] dark:border-white/5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{r.target_name}</span>
                <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#A1A1A6]">
                  {r.scope}
                </span>
              </div>

              <div className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-medium text-[#1D7A39] dark:text-[#34C759]">
                  <Award className="w-3 h-3" />
                  {r.just_pass_accepted ? 'Just Pass' : `Min ${r.default_min_degree_percent}%`}
                </span>
                <span>·</span>
                <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {r.english_policy.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="text-[11px] text-[#6E6E73] dark:text-[#86868B] flex flex-wrap items-center gap-2">
                <span>Age: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{r.min_age ?? 18}–{r.max_age ?? 40} yrs</strong></span>
                <span>·</span>
                <span>Max Gap: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{r.max_gap_years ?? 5} yrs</strong></span>
              </div>

              {r.notes && (
                <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] pt-0.5 line-clamp-2">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live Auto-Update & Instant Stay-Back / Visa Override */}
      <div className="pt-6 border-t border-black/[0.06] dark:border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0071E3]" />
              Automatic Daily Sync &amp; Live Visa/Fee Override
            </h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
              Daily cron checks 5 rotating destinations, news, DAAD fees &amp; course URLs automatically. Trigger a live scan or push an immediate policy change below.
            </p>
          </div>
          {liveStore?.lastAutoSyncAt && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-[#E8F8EE] dark:bg-[#34C759]/15 text-[#1D7A39] dark:text-[#34C759] font-medium shrink-0">
              Last Sync: {new Date(liveStore.lastAutoSyncAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
            <select
              value={syncCountry}
              onChange={(e) => setSyncCountry(e.target.value)}
              className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium focus:outline-none"
            >
              <option value="__auto__">Next 5 Countries (Auto-Rotate)</option>
              {GLOBAL_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
              {syncResultMsg || liveStore?.lastSyncSummary || 'Scans Google News RSS, Grounded Web Search, DAAD fees & course URLs.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRunAutoSync}
            disabled={syncingLive}
            className="px-4 py-2 rounded-full bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
            {syncingLive ? 'Scanning Live Sources...' : 'Run Live Auto-Update Now'}
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Instant Live Country Override (Stay-Back &amp; Show Money)
            </span>
            {overrideMsg && (
              <span className="text-[11px] font-medium text-[#1D7A39] dark:text-[#34C759]">
                {overrideMsg}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">Country</label>
              <select
                value={ovCountry}
                onChange={(e) => loadCountryIntoOverrideForm(e.target.value)}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium"
              >
                {GLOBAL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                Master Stay-Back (Yrs, 0 = None)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="5"
                value={ovMasterStay}
                onChange={(e) => setOvMasterStay(e.target.value)}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                Bachelor Stay-Back (Yrs, 0 = None)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="5"
                value={ovBachelorStay}
                onChange={(e) => setOvBachelorStay(e.target.value)}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                Living Funds Proof (€/yr)
              </label>
              <input
                type="number"
                min="2000"
                max="50000"
                value={ovShowMoney}
                onChange={(e) => setOvShowMoney(e.target.value)}
                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white font-medium"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            <input
              type="text"
              value={ovVisaSummary}
              onChange={(e) => setOvVisaSummary(e.target.value)}
              placeholder="Concise post-study visa rule summary..."
              className="lg:col-span-6 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white"
            />
            <input
              type="url"
              value={ovSourceUrl}
              onChange={(e) => setOvSourceUrl(e.target.value)}
              placeholder="Official government source URL (optional)"
              className="lg:col-span-4 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#1D1D1F] dark:text-white"
            />
            <button
              type="button"
              onClick={handleSaveLiveOverride}
              disabled={savingOverride}
              className="lg:col-span-2 px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingOverride ? 'Saving...' : 'Save Live'}
            </button>
          </div>

          {liveStore && Object.keys(liveStore.countryOverrides).length > 0 && (
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex flex-wrap gap-2">
              {Object.values(liveStore.countryOverrides).map((ov) => (
                <div
                  key={ov.country}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 text-[11px]"
                >
                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{ov.country}:</span>
                  <span className="text-[#6E6E73] dark:text-[#A1A1A6]">
                    {ov.stayBackYears !== undefined ? formatStayBack(ov.stayBackYears) : 'Custom'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteLiveOverride(ov.country)}
                    className="text-[#FF3B30] hover:opacity-80 cursor-pointer inline-flex items-center gap-0.5"
                    title="Reset to built-in baseline"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
