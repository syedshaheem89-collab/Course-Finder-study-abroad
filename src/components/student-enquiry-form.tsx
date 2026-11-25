'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Download,
  ExternalLink,
  ShieldCheck,
  Edit3,
  Globe,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { pteToIelts } from '@/lib/course-utils';
import { COUNTRY_DIAL_CODES } from '@/lib/countries';
import { CurrencyCode, formatCurrencyAmount } from '@/lib/student-guides';
import { formatStayBack } from '@/lib/country-visa-intel';
import { exportAiRecommendationsToExcel } from '@/lib/excel-export';
import { loadSavedLeadProfile, saveLeadProfileLocally } from '@/components/public-lead-gate';

interface StudentEnquiryFormProps {
  availableCountries: string[];
}

interface AiRecItem {
  course_id: string;
  program_name: string;
  university_name: string;
  country: string;
  degree_level: string;
  category: string;
  tuition_fees_eur: number;
  duration_months: number;
  intake_months: string[];
  stay_back_visa_years: number;
  average_graduate_salary: number;
  min_ielts: number;
  english_policy: string;
  match_score: number;
  admission_chance: 'High' | 'Good' | 'Stretch';
  why_it_fits: string;
  course_url: string;
  is_verified_db?: boolean;
}

interface AiReportPayload {
  destination: string;
  eligibility_verdict: string;
  country_strategy: string;
  visa_summary?: string;
  recommendations: AiRecItem[];
}

export default function StudentEnquiryForm({ availableCountries }: StudentEnquiryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AiReportPayload | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');

  // Personal
  const [studentName, setStudentName] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState('');
  const [age, setAge] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');

  // +2
  const [plus2Year, setPlus2Year] = useState('');
  const [plus2Percent, setPlus2Percent] = useState('');
  const [plus2Stream, setPlus2Stream] = useState('');

  // Bachelor
  const [bachUniversity, setBachUniversity] = useState('');
  const [bachDegree, setBachDegree] = useState('');
  const [bachYear, setBachYear] = useState('');
  const [bachPercent, setBachPercent] = useState('');
  const [bachBacklogs, setBachBacklogs] = useState('0');

  // Master's
  const [masterYear, setMasterYear] = useState('');
  const [masterUniversity, setMasterUniversity] = useState('');
  const [masterPercent, setMasterPercent] = useState('');

  // Tests & Language
  const [ieltsScore, setIeltsScore] = useState('');
  const [pteScore, setPteScore] = useState('');
  const [greGmatScore, setGreGmatScore] = useState('');
  const [otherLanguage, setOtherLanguage] = useState('MOI (Medium of Instruction)');

  // Preferences & Requirements
  const [preferredDestination, setPreferredDestination] = useState(searchParams.get('country') || '');
  const [targetLevel, setTargetLevel] = useState('');
  const [targetIntake, setTargetIntake] = useState('');
  const [coursePreference, setCoursePreference] = useState(searchParams.get('course') || '');
  const [budget, setBudget] = useState('');
  const [specificEnquiry, setSpecificEnquiry] = useState('');
  const [workExperience, setWorkExperience] = useState('0');
  const [consentPartnerContact, setConsentPartnerContact] = useState(true);
  const [websiteHp, setWebsiteHp] = useState('');

  useEffect(() => {
    const paramCountry = searchParams.get('country');
    const paramCourse = searchParams.get('course');
    if (paramCountry) setPreferredDestination(paramCountry);
    if (paramCourse) setCoursePreference(paramCourse);
  }, [searchParams]);

  // Autofill from saved localStorage lead profile if previously submitted
  useEffect(() => {
    const existing = loadSavedLeadProfile();
    if (existing) {
      setStudentName((prev) => prev || existing.name);
      if (existing.dialCode) setDialCode(existing.dialCode);
      setMobileNumber((prev) => prev || existing.phone);
      if (existing.email) setEmail((prev) => prev || existing.email || '');
      setPlace((prev) => prev || existing.city);
      if (existing.preferredDestination && !searchParams.get('country')) {
        setPreferredDestination((prev) => prev || existing.preferredDestination);
      }
    }
  }, [searchParams]);

  const buildDirectoryParams = () => {
    const params = new URLSearchParams();
    if (coursePreference) params.set('q', coursePreference);
    if (preferredDestination) params.set('country', preferredDestination);
    if (targetLevel && targetLevel !== 'PhD') {
      const mappedType =
        targetLevel === 'MBA' ? 'Masters' : targetLevel;
      params.set('types', mappedType);
    }
    if (plus2Percent) params.set('twelfth', plus2Percent);
    if (bachPercent) params.set('degree', bachPercent);
    if (bachBacklogs) params.set('backlogs', bachBacklogs);

    const effectiveIelts = Number(ieltsScore) || pteToIelts(Number(pteScore));
    if (effectiveIelts > 0) params.set('ielts', String(effectiveIelts));
    if (otherLanguage.toLowerCase().includes('moi')) params.set('moi', 'true');
    if (budget) {
      const numericBudget = budget.replace(/[^0-9]/g, '');
      if (numericBudget) params.set('budget', numericBudget);
    }
    if (workExperience) params.set('exp', workExperience);
    if (age) params.set('age', age);

    const latestYear = Number(masterYear) || Number(bachYear) || Number(plus2Year);
    if (latestYear && latestYear > 1990 && latestYear <= 2026) {
      params.set('gap', String(Math.max(0, 2026 - latestYear)));
    }
    return params.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedMsg(null);

    const cleanName = studentName.trim();
    const digits = mobileNumber.replace(/\D/g, '');
    const cleanPlace = place.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (digits.length < 7 || digits.length > 15) {
      setErrorMsg('Please enter a valid mobile / WhatsApp number (at least 7 digits).');
      return;
    }
    if (cleanPlace.length < 2) {
      setErrorMsg('Please enter your City / Location.');
      return;
    }
    if (!consentPartnerContact) {
      setErrorMsg('Please accept the counselling consent checkbox to get your AI matches.');
      return;
    }

    setSubmitting(true);

    const fullPhone = `${dialCode} ${mobileNumber.trim()}`;
    const latestYear = Number(masterYear) || Number(bachYear) || Number(plus2Year);
    const studyGapYears =
      latestYear && latestYear > 1990 && latestYear <= 2026 ? Math.max(0, 2026 - latestYear) : 0;
    const consentedAt = new Date().toISOString();

    try {
      // Step 1: Run Full-Profile Country-Specific AI Matcher
      const aiRes = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_destination: preferredDestination,
          target_level: targetLevel,
          course_preference: coursePreference,
          budget_eur: Number(budget) || 0,
          twelfth_percent: plus2Percent,
          plus2_stream: plus2Stream,
          bachelor_degree: bachDegree,
          bachelor_percent: bachPercent,
          backlogs: Number(bachBacklogs) || 0,
          master_percent: masterPercent,
          ielts_score: ieltsScore,
          pte_score: pteScore,
          gre_gmat: greGmatScore,
          other_language: otherLanguage,
          work_experience_months: Number(workExperience) || 0,
          study_gap_years: studyGapYears,
          age,
          marital_status: maritalStatus,
          target_intake: targetIntake,
          specific_enquiry: specificEnquiry,
        }),
      });

      const aiData = await aiRes.json();
      const recommendations: AiRecItem[] = Array.isArray(aiData?.recommendations)
        ? aiData.recommendations
        : [];

      const reportPayload: AiReportPayload = {
        destination: aiData?.destination || preferredDestination || 'Global Best Fit',
        eligibility_verdict:
          aiData?.eligibility_verdict ||
          'Evaluated your qualification profile for international university admission.',
        country_strategy: aiData?.country_strategy || '',
        visa_summary: aiData?.visa_summary || '',
        recommendations,
      };

      // Step 2: Save full qualified lead + AI suggested courses to Supabase CRM
      const profile = {
        student_name: cleanName,
        phone: fullPhone,
        email: email.trim(),
        place: cleanPlace,
        city: cleanPlace,
        age,
        marital_status: maritalStatus,
        plus2: { pass_out_year: plus2Year, percentage: plus2Percent, stream: plus2Stream },
        bachelor: {
          university: bachUniversity,
          degree: bachDegree,
          passing_year: bachYear,
          percentage: bachPercent,
          backlogs: bachBacklogs,
        },
        masters: {
          passout_year: masterYear,
          university: masterUniversity,
          percentage: masterPercent,
        },
        tests: {
          ielts: ieltsScore,
          pte: pteScore,
          gre_gmat: greGmatScore,
          other_language: otherLanguage,
        },
        preferred_destination: preferredDestination,
        target_level: targetLevel,
        target_intake: targetIntake,
        course: coursePreference,
        budget,
        specific_enquiry: specificEnquiry,
        work_experience_months: Number(workExperience) || 0,
        study_gap_years: studyGapYears,
        source: 'qualification_enquiry',
        lead_tier: 'hot_qualified',
        consent_partner_contact: true,
        consent_timestamp: consentedAt,
      };

      const inqRes = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: cleanName,
          email: email.trim() || 'student@lead.local',
          phone: fullPhone,
          background_profile: profile,
          ai_suggested_courses: reportPayload,
          website_hp: websiteHp,
        }),
      });

      const inqData = await inqRes.json();
      if (!inqRes.ok || !inqData.success) {
        setErrorMsg(inqData.error || 'Could not save your enquiry right now.');
        return;
      }

      // Step 3: Persist locally so the Course Finder Lead Gate won't re-prompt this student
      saveLeadProfileLocally({
        name: cleanName,
        dialCode,
        phone: mobileNumber.trim(),
        email: email.trim(),
        city: cleanPlace,
        preferredDestination,
        consentedAt,
      });

      setAiReport(reportPayload);
      setSavedMsg(
        `Profile saved & matched ${recommendations.length} top ${reportPayload.destination} programmes below.`
      );

      setTimeout(() => {
        const el = document.getElementById('ai-best-options');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not generate AI matches right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition-all';
  const labelClass = 'text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1.5';

  return (
    <div className="space-y-8">
      {/* AI Country-Specific Best Options Report */}
      {aiReport && (
        <section
          id="ai-best-options"
          className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/10 pb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] dark:text-[#2997FF]">
                <Globe className="w-3.5 h-3.5" />
                <span>AI Personalised Best Options · {aiReport.destination}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                Top Recommended Programmes for {studentName}
              </h2>
            </div>

            <div className="inline-flex items-center bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 rounded-full self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrency('EUR')}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                  currency === 'EUR'
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                    : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                }`}
              >
                € EUR
              </button>
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                  currency === 'INR'
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                    : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                }`}
              >
                ₹ INR
              </button>
            </div>
          </div>

          {/* Eligibility Verdict + Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                Eligibility &amp; Profile Assessment
              </span>
              <p className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                {aiReport.eligibility_verdict}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                Destination &amp; Visa Strategy
              </span>
              <p className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                {aiReport.country_strategy || aiReport.visa_summary}
              </p>
            </div>
          </div>

          {/* Recommended Course Cards */}
          {aiReport.recommendations.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-center space-y-2">
              <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                No exact catalogue matches returned right now.
              </p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                Click &ldquo;Explore All Matching Courses in Directory&rdquo; below to run live Global Discovery.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aiReport.recommendations.map((rec, idx) => (
                <div
                  key={`${rec.course_id}-${idx}`}
                  className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-2xl p-5 hover:shadow-md transition-shadow space-y-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                        <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {rec.university_name}
                        </span>
                        <span>·</span>
                        <span>{rec.country}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {rec.degree_level}
                        </span>
                      </div>
                      <h3 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {rec.program_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          rec.admission_chance === 'High'
                            ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158]'
                            : rec.admission_chance === 'Good'
                            ? 'bg-[#EAF3FF] text-[#0071E3] dark:bg-[#2997FF]/15 dark:text-[#2997FF]'
                            : 'bg-[#FFF6E5] text-[#8A5A00] dark:bg-[#FFD60A]/15 dark:text-[#FFD60A]'
                        }`}
                      >
                        {rec.admission_chance} Chance
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158] text-[11px] font-semibold">
                        {rec.match_score}% Match
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                    {rec.why_it_fits}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-black/[0.06] dark:border-white/10 text-[12px]">
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                        Tuition / Yr
                      </span>
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatCurrencyAmount(rec.tuition_fees_eur, currency, true)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                        Language
                      </span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {rec.english_policy === 'MOI_ACCEPTED'
                          ? 'MOI Accepted'
                          : rec.english_policy === 'WAIVED'
                          ? 'Waived'
                          : `IELTS ${rec.min_ielts}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                        Intakes
                      </span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {Array.isArray(rec.intake_months) ? rec.intake_months.join(', ') : 'September'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                        Stay Back
                      </span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#6E6E73]" />
                        {rec.duration_months} mo · {formatStayBack(rec.stay_back_visa_years)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <a
                      href={rec.course_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
                    >
                      <span>Official Programme Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-black/[0.06] dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  exportAiRecommendationsToExcel(
                    aiReport.recommendations,
                    studentName,
                    aiReport.destination
                  )
                }
                disabled={aiReport.recommendations.length === 0}
                className="px-4 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[#1D7A39]" />
                Download My AI Shortlist (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('enquiry-form');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 hover:bg-[#F5F5F7] text-[#1D1D1F] dark:text-[#F5F5F7] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Modify Requirements
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/courses?${buildDirectoryParams()}`)}
              className="px-5 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] text-white text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Explore All Matching Courses in Directory</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Qualification Intake Form */}
      <section
        id="enquiry-form"
        className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none p-6 sm:p-10"
      >
        <div className="border-b border-black/[0.06] dark:border-white/10 pb-6 mb-7 space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
            AI Admission Intake
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Student Qualification Enquiry
          </h1>
          <p className="text-[14px] text-[#6E6E73] dark:text-[#A1A1A6]">
            Enter your contact details, academic scores, and target country — AI will recommend the best matching universities and options for your exact destination.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* 1. Personal Details */}
          <div className="space-y-3.5">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Personal &amp; Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Student Name *</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Mobile / WhatsApp Number *</label>
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
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="98765 43210"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@email.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>City / Location *</label>
                <input
                  type="text"
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="e.g. Kochi, Kerala"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 22"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Marital Status</label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. +2 (12th) Qualification */}
          <div className="space-y-3.5 pt-6 border-t border-black/[0.06] dark:border-white/10">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              +2 / Higher Secondary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className={labelClass}>Pass Out Year</label>
                <input
                  type="text"
                  value={plus2Year}
                  onChange={(e) => setPlus2Year(e.target.value)}
                  placeholder="e.g. 2021"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Percentage (%)</label>
                <input
                  type="number"
                  value={plus2Percent}
                  onChange={(e) => setPlus2Percent(e.target.value)}
                  placeholder="e.g. 75"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Stream</label>
                <input
                  type="text"
                  value={plus2Stream}
                  onChange={(e) => setPlus2Stream(e.target.value)}
                  placeholder="e.g. Science, Commerce"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 3. Bachelor Degree */}
          <div className="space-y-3.5 pt-6 border-t border-black/[0.06] dark:border-white/10">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Bachelor Degree
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className={labelClass}>University</label>
                <input
                  type="text"
                  value={bachUniversity}
                  onChange={(e) => setBachUniversity(e.target.value)}
                  placeholder="University name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bachelors (Course)</label>
                <input
                  type="text"
                  value={bachDegree}
                  onChange={(e) => setBachDegree(e.target.value)}
                  placeholder="e.g. B.Tech CS, B.Com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Passing Year</label>
                <input
                  type="text"
                  value={bachYear}
                  onChange={(e) => setBachYear(e.target.value)}
                  placeholder="e.g. 2025"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Percentage (%)</label>
                <input
                  type="number"
                  value={bachPercent}
                  onChange={(e) => setBachPercent(e.target.value)}
                  placeholder="e.g. 68"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Backlogs</label>
                <input
                  type="number"
                  min="0"
                  value={bachBacklogs}
                  onChange={(e) => setBachBacklogs(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 4. Master's (Optional) */}
          <div className="space-y-3.5 pt-6 border-t border-black/[0.06] dark:border-white/10">
            <h3 className="text-[13px] font-semibold text-[#6E6E73] dark:text-[#A1A1A6]">
              Master&apos;s (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className={labelClass}>Passout Year</label>
                <input
                  type="text"
                  value={masterYear}
                  onChange={(e) => setMasterYear(e.target.value)}
                  placeholder="e.g. 2026"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>University</label>
                <input
                  type="text"
                  value={masterUniversity}
                  onChange={(e) => setMasterUniversity(e.target.value)}
                  placeholder="University name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Percentage (%)</label>
                <input
                  type="number"
                  value={masterPercent}
                  onChange={(e) => setMasterPercent(e.target.value)}
                  placeholder="e.g. 72"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 5. English & Test Scores */}
          <div className="space-y-3.5 pt-6 border-t border-black/[0.06] dark:border-white/10">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Language &amp; Entrance Scores
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>IELTS Score</label>
                <input
                  type="number"
                  step="0.5"
                  value={ieltsScore}
                  onChange={(e) => setIeltsScore(e.target.value)}
                  placeholder="e.g. 6.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>PTE Score</label>
                <input
                  type="number"
                  value={pteScore}
                  onChange={(e) => setPteScore(e.target.value)}
                  placeholder="e.g. 58"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>GRE / GMAT Score</label>
                <input
                  type="text"
                  value={greGmatScore}
                  onChange={(e) => setGreGmatScore(e.target.value)}
                  placeholder="e.g. GRE 310 / N/A"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Other Language Proficiency</label>
                <input
                  type="text"
                  value={otherLanguage}
                  onChange={(e) => setOtherLanguage(e.target.value)}
                  placeholder="e.g. MOI, German A2, OET"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 6. Preferences & Requirements */}
          <div className="space-y-3.5 pt-6 border-t border-black/[0.06] dark:border-white/10">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Preferences &amp; Experience
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Preferred Destination</label>
                <select
                  value={preferredDestination}
                  onChange={(e) => setPreferredDestination(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any Destination (Best AI Match)</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Target Degree Level</label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any / Best Fit</option>
                  <option value="Undergraduate">Undergraduate (Bachelor)</option>
                  <option value="Masters">Masters (MSc / MA / MEng)</option>
                  <option value="MBA">MBA</option>
                  <option value="PG Diploma">PG Diploma</option>
                  <option value="PhD">PhD / Research</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Course / Keyword</label>
                <input
                  type="text"
                  value={coursePreference}
                  onChange={(e) => setCoursePreference(e.target.value)}
                  placeholder="e.g. MBA, Logistics, AI, Computer Science"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Target Intake</label>
                <select
                  value={targetIntake}
                  onChange={(e) => setTargetIntake(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any Upcoming Intake</option>
                  <option value="September / Fall 2026">September / Fall 2026</option>
                  <option value="January / Spring 2027">January / Spring 2027</option>
                  <option value="May / Summer 2027">May / Summer 2027</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Budget (EUR per year)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 15000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Work Experience (Months)</label>
                <input
                  type="number"
                  min="0"
                  value={workExperience}
                  onChange={(e) => setWorkExperience(e.target.value)}
                  placeholder="e.g. 12"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Specific Enquiry</label>
                <input
                  type="text"
                  value={specificEnquiry}
                  onChange={(e) => setSpecificEnquiry(e.target.value)}
                  placeholder="Scholarships, MOI, Spouse Visa, Low Tuition, PR pathway..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Partner Contact Consent */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/10">
            <label className="flex items-start gap-2.5 cursor-pointer text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
              <input
                type="checkbox"
                checked={consentPartnerContact}
                onChange={(e) => setConsentPartnerContact(e.target.checked)}
                className="mt-0.5 rounded border-black/20 text-[#0071E3] focus:ring-[#0071E3]"
              />
              <span>
                I agree to receive personalised AI course matches and study abroad counselling calls/WhatsApp updates from GlobalCourse AI and verified partner study abroad agencies.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FFEBE9] dark:bg-[#FF3B30]/15 border border-[#FF3B30]/30 text-xs text-[#C41E1E] dark:text-[#FF3B30]">
              {errorMsg}
            </div>
          )}

          {savedMsg && (
            <div className="p-3.5 rounded-xl bg-[#E8F8EE] dark:bg-[#34C759]/15 border border-[#34C759]/30 text-xs text-[#1D7A39] dark:text-[#34C759] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedMsg}</span>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-black/[0.06] dark:border-white/10">
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
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[14px] font-medium flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analysing Profile &amp; Matching {preferredDestination || 'Best Options'}...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Get AI Best Options &amp; Save Profile
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
