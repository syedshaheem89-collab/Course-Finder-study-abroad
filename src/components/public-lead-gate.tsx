'use client';

import { useState, useEffect } from 'react';
import { Lock, X, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { COUNTRY_DIAL_CODES } from '@/lib/countries';
import { getTrafficAttribution } from '@/lib/analytics-tracker';

export const LEAD_STORAGE_KEY = 'gc_student_lead_v1';

export interface SavedLeadProfile {
  name: string;
  dialCode: string;
  phone: string;
  email?: string;
  city: string;
  preferredDestination: string;
  consentedAt: string;
}

export function loadSavedLeadProfile(): SavedLeadProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.phone) return parsed as SavedLeadProfile;
    return null;
  } catch {
    return null;
  }
}

export function saveLeadProfileLocally(profile: SavedLeadProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

interface PublicLeadGateProps {
  isOpen: boolean;
  isHardGate: boolean;
  defaultCountry?: string;
  searchContext?: string;
  availableCountries: string[];
  onComplete: (lead: SavedLeadProfile) => void;
  onDismiss?: () => void;
}

export default function PublicLeadGate({
  isOpen,
  isHardGate,
  defaultCountry = '',
  searchContext = '',
  availableCountries,
  onComplete,
  onDismiss,
}: PublicLeadGateProps) {
  const [name, setName] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [preferredDestination, setPreferredDestination] = useState(defaultCountry);
  const [consent, setConsent] = useState(false);
  const [websiteHp, setWebsiteHp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (defaultCountry) {
      setPreferredDestination(defaultCountry);
    }
  }, [defaultCountry]);

  useEffect(() => {
    const existing = loadSavedLeadProfile();
    if (existing) {
      if (!name) setName(existing.name);
      if (!phone) setPhone(existing.phone);
      if (existing.dialCode) setDialCode(existing.dialCode);
      if (!city) setCity(existing.city);
      if (!preferredDestination && existing.preferredDestination) {
        setPreferredDestination(existing.preferredDestination);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const digits = phone.replace(/\D/g, '');
    const cleanCity = city.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (digits.length < 7 || digits.length > 15) {
      setErrorMsg('Please enter a valid mobile / WhatsApp number.');
      return;
    }
    if (cleanCity.length < 2) {
      setErrorMsg('Please enter your city or location.');
      return;
    }
    if (!consent) {
      setErrorMsg('Please confirm your consent to unlock course details and counselling updates.');
      return;
    }

    setSubmitting(true);
    try {
      const fullPhone = `${dialCode} ${phone.trim()}`;
      const consentedAt = new Date().toISOString();

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: cleanName,
          phone: fullPhone,
          background_profile: {
            student_name: cleanName,
            phone: fullPhone,
            place: cleanCity,
            city: cleanCity,
            preferred_destination: preferredDestination || defaultCountry || '',
            source: 'course_finder_gate',
            lead_tier: 'basic_lead',
            search_context: searchContext,
            consent_partner_contact: true,
            consent_timestamp: consentedAt,
            ...getTrafficAttribution(),
          },
          website_hp: websiteHp,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Could not verify your details right now. Please try again.');
        return;
      }

      const saved: SavedLeadProfile = {
        name: cleanName,
        dialCode,
        phone: phone.trim(),
        city: cleanCity,
        preferredDestination: preferredDestination || defaultCountry || '',
        consentedAt,
      };
      saveLeadProfileLocally(saved);
      onComplete(saved);
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition-all';

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-7 relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] flex items-center justify-center text-[#6E6E73] dark:text-[#A1A1A6] absolute right-4 top-4 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0066CC] dark:text-[#2997FF]">
            <Lock className="w-3.5 h-3.5" />
            <span>Free Verified Access</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            Unlock Complete Entry Rules, Show Money &amp; Excel Exports
          </h2>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
            Enter your name, mobile number, and city once (supports browser autofill) to unlock university cutoffs, MOI rules, 2026 stay-back breakdowns, and instant .xlsx downloads.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
              Mobile / WhatsApp Number *
            </label>
            <div className="flex gap-2">
              <select
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                aria-label="Country Dial Code"
                className="w-24 shrink-0 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-2.5 py-2.5 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
              >
                {COUNTRY_DIAL_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                name="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                City / Location *
              </label>
              <input
                type="text"
                name="city"
                autoComplete="address-level2"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Kochi, Kerala"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                Preferred Country
              </label>
              <select
                value={preferredDestination}
                onChange={(e) => setPreferredDestination(e.target.value)}
                className={inputClass}
              >
                <option value="">Any Country</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] leading-snug">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 rounded border-black/20 text-[#0071E3] focus:ring-[#0071E3]"
            />
            <span>
              I agree to unlock full course details and receive study abroad counselling updates via phone/WhatsApp from verified partner agencies.
            </span>
          </label>

          <input
            type="text"
            name="website_hp"
            value={websiteHp}
            onChange={(e) => setWebsiteHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[#FFEBE9] dark:bg-[#FF3B30]/15 border border-[#FF3B30]/30 text-[12px] text-[#C41E1E] dark:text-[#FF6961]">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking Access...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Free Access</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {!isHardGate && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full text-center text-[11px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white cursor-pointer pt-1"
            >
              Browse briefly first
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
