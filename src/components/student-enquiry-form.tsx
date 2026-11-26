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
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
import { pteToIelts } from '@/lib/course-utils';
import { COUNTRY_DIAL_CODES } from '@/lib/countries';
import { CurrencyCode, formatCurrencyAmount, resolveCourseUrl } from '@/lib/student-guides';
import { SectorFilter, UniversitySector } from '@/lib/university-classification';
import { formatStayBack } from '@/lib/country-visa-intel';
import { exportAiRecommendationsToExcel } from '@/lib/excel-export';
import { loadSavedLeadProfile, saveLeadProfileLocally } from '@/components/public-lead-gate';
import { getTrafficAttribution, setStaffAnalyticsBypass, trackAnalyticsEvent } from '@/lib/analytics-tracker';
import { useTheme } from '@/components/theme-provider';

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
  institution_type?: UniversitySector;
  is_priority_university?: boolean;
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

const COURSE_QUICK_CHIPS = [
  'Computer Science & AI',
  'MBA / Management',
  'Data Science',
  'Engineering',
  'Healthcare',
];

const BUDGET_TIER_EUR_MAP: Record<string, number> = {
  'Under €5,000 (Low / Free)': 5000,
  '€5,000 – €12,000': 12000,
  '€12,000 – €20,000': 20000,
  '€20,000+': 35000,
  'Need Education Loan': 15000,
};

const BACKLOG_VALUE_MAP: Record<string, number> = {
  '0': 0,
  '1-2': 2,
  '3-5': 4,
  '6+': 6,
};

export default function StudentEnquiryForm({ availableCountries }: StudentEnquiryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brandName } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AiReportPayload | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('LOCAL');
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [counselorQuickMode, setCounselorQuickMode] = useState(false);
  const [sectorPreference, setSectorPreference] = useState<SectorFilter>('all');
  const [reportSectorFilter, setReportSectorFilter] = useState<SectorFilter>('all');

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.isStaff || d?.authenticated) {
          setStaffAnalyticsBypass(true);
          setIsStaff(true);
          setCounselorQuickMode(true);
        }
      })
      .catch(() => {});
    fetch('/api/fx-rates')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.rates) setFxRates(d.rates);
      })
      .catch(() => {});
  }, []);

  // Section 1: Study Goal & Academic Essentials
  const [preferredDestination, setPreferredDestination] = useState(searchParams.get('country') || '');
  const [targetLevel, setTargetLevel] = useState('Masters');
  const [coursePreference, setCoursePreference] = useState(searchParams.get('course') || '');
  const [highestQualification, setHighestQualification] = useState<'bachelor' | 'plus2' | 'masters'>('bachelor');
  const [scorePercent, setScorePercent] = useState('');
  const [passingYear, setPassingYear] = useState('');
  const [backlogBucket, setBacklogBucket] = useState('0');
  const [englishStatus, setEnglishStatus] = useState('MOI (No IELTS)');
  const [englishScore, setEnglishScore] = useState('');
  const [budgetTier, setBudgetTier] = useState('€5,000 – €12,000');
  const [targetIntake, setTargetIntake] = useState('September / Fall 2026');

  // Section 2: Contact Details (1-Tap Autofill)
  const [studentName, setStudentName] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [place, setPlace] = useState('');
  const [email, setEmail] = useState('');

  // Section 3: Collapsible Optional Details
  const [degreeStreamName, setDegreeStreamName] = useState('');
  const [workExperience, setWorkExperience] = useState('0');
  const [greGmatScore, setGreGmatScore] = useState('');
  const [age, setAge] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [specificEnquiry, setSpecificEnquiry] = useState('');

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

  const computeEffectiveScores = () => {
    const numScore = Number(scorePercent) || 0;
    const twelfthPct = highestQualification === 'plus2' && numScore > 0 ? String(numScore) : '';
    const bachPct = highestQualification === 'bachelor' && numScore > 0 ? String(numScore) : '';
    const mastPct = highestQualification === 'masters' && numScore > 0 ? String(numScore) : '';

    const rawEngNum = Number(englishScore) || 0;
    const ieltsVal = englishStatus === 'IELTS' && rawEngNum > 0 ? String(rawEngNum) : '';
    const pteVal = englishStatus === 'PTE' && rawEngNum > 0 ? String(rawEngNum) : '';
    const otherLang =
      englishStatus === 'MOI (No IELTS)'
        ? 'MOI (Medium of Instruction)'
        : englishStatus === 'TOEFL / Duolingo' && rawEngNum > 0
        ? `TOEFL/DET ${rawEngNum}`
        : englishStatus;

    const numericBudgetEur = BUDGET_TIER_EUR_MAP[budgetTier] || 15000;
    const backlogsNum = BACKLOG_VALUE_MAP[backlogBucket] ?? 0;

    return {
      twelfthPct,
      bachPct,
      mastPct,
      ieltsVal,
      pteVal,
      otherLang,
      numericBudgetEur,
      backlogsNum,
    };
  };

  const buildDirectoryParams = () => {
    const params = new URLSearchParams();
    const { twelfthPct, bachPct, ieltsVal, pteVal, otherLang, numericBudgetEur, backlogsNum } =
      computeEffectiveScores();

    if (coursePreference) params.set('q', coursePreference);
    if (preferredDestination) params.set('country', preferredDestination);
    if (sectorPreference !== 'all') params.set('sector', sectorPreference);
    if (targetLevel && targetLevel !== 'PhD') {
      const mappedType = targetLevel === 'MBA' ? 'Masters' : targetLevel;
      params.set('types', mappedType);
    }
    if (twelfthPct) params.set('twelfth', twelfthPct);
    if (bachPct) params.set('degree', bachPct);
    params.set('backlogs', String(backlogsNum));

    const effIelts = Number(ieltsVal) || pteToIelts(Number(pteVal));
    if (effIelts > 0) params.set('ielts', String(effIelts));
    if (otherLang.toLowerCase().includes('moi')) params.set('moi', 'true');
    if (numericBudgetEur > 0) params.set('budget', String(numericBudgetEur));
    if (workExperience) params.set('exp', workExperience);
    if (age) params.set('age', age);

    const latestYear = Number(passingYear);
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

    if (!counselorQuickMode) {
      if (cleanName.length < 2) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (digits.length < 7 || digits.length > 15) {
        setErrorMsg('Please enter a valid mobile / WhatsApp number (at least 7 digits).');
        return;
      }
      if (cleanPlace.length < 2) {
        setErrorMsg('Please enter your City / State.');
        return;
      }
      if (!consentPartnerContact) {
        setErrorMsg('Please accept the counselling consent checkbox to unlock your AI matches.');
        return;
      }
    }

    setSubmitting(true);

    const fullPhone = `${dialCode} ${mobileNumber.trim()}`;
    const latestYear = Number(passingYear);
    const studyGapYears =
      latestYear && latestYear > 1990 && latestYear <= 2026 ? Math.max(0, 2026 - latestYear) : 0;
    const consentedAt = new Date().toISOString();
    const needsEducationLoan = budgetTier === 'Need Education Loan';
    const attribution = getTrafficAttribution();

    const {
      twelfthPct,
      bachPct,
      mastPct,
      ieltsVal,
      pteVal,
      otherLang,
      numericBudgetEur,
      backlogsNum,
    } = computeEffectiveScores();

    const combinedNotes = [
      needsEducationLoan ? 'Student requires education loan assistance.' : '',
      specificEnquiry.trim(),
    ]
      .filter(Boolean)
      .join(' ');

    try {
      // Step 1: Run Full-Profile Country-Specific AI Matcher
      const aiRes = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_destination: preferredDestination,
          sector: sectorPreference,
          target_level: targetLevel,
          course_preference: coursePreference,
          budget_eur: numericBudgetEur,
          twelfth_percent: twelfthPct,
          plus2_stream: highestQualification === 'plus2' ? degreeStreamName : '',
          bachelor_degree: highestQualification !== 'plus2' ? degreeStreamName : '',
          bachelor_percent: bachPct,
          backlogs: backlogsNum,
          master_percent: mastPct,
          ielts_score: ieltsVal,
          pte_score: pteVal,
          gre_gmat: greGmatScore,
          other_language: otherLang,
          work_experience_months: Number(workExperience) || 0,
          study_gap_years: studyGapYears,
          age,
          marital_status: maritalStatus,
          target_intake: targetIntake,
          specific_enquiry: combinedNotes,
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

      // In Counselor Quick AI Check mode: do NOT save lead or skew public analytics
      if (counselorQuickMode) {
        setReportSectorFilter('all');
        setAiReport(reportPayload);
        setSavedMsg(
          `AI quick check complete: matched ${recommendations.length} ${reportPayload.destination} programmes (not saved to CRM).`
        );
        setTimeout(() => {
          const el = document.getElementById('ai-best-options');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        return;
      }

      // Step 2: Save full qualified lead + Market Attribution + AI recommendations
      const profile = {
        student_name: cleanName,
        phone: fullPhone,
        email: email.trim(),
        place: cleanPlace,
        city: cleanPlace,
        age,
        marital_status: maritalStatus,
        highest_qualification: highestQualification,
        plus2: {
          pass_out_year: highestQualification === 'plus2' ? passingYear : '',
          percentage: twelfthPct,
          stream: highestQualification === 'plus2' ? degreeStreamName : '',
        },
        bachelor: {
          university: '',
          degree: highestQualification !== 'plus2' ? degreeStreamName : '',
          passing_year: highestQualification === 'bachelor' ? passingYear : '',
          percentage: bachPct,
          backlogs: backlogsNum,
        },
        masters: {
          passout_year: highestQualification === 'masters' ? passingYear : '',
          university: '',
          percentage: mastPct,
        },
        tests: {
          ielts: ieltsVal,
          pte: pteVal,
          gre_gmat: greGmatScore,
          other_language: otherLang,
        },
        preferred_destination: preferredDestination,
        target_level: targetLevel,
        target_intake: targetIntake,
        course: coursePreference,
        budget: String(numericBudgetEur),
        budget_tier: budgetTier,
        needs_education_loan: needsEducationLoan,
        english_status: englishStatus,
        specific_enquiry: combinedNotes,
        work_experience_months: Number(workExperience) || 0,
        study_gap_years: studyGapYears,
        source: 'qualification_enquiry',
        lead_tier: 'hot_qualified',
        consent_partner_contact: true,
        consent_timestamp: consentedAt,
        ...attribution,
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

      // Fire analytics demand event
      trackAnalyticsEvent({
        event_type: 'ai_recommend',
        country: preferredDestination,
        query: coursePreference,
        degree_level: targetLevel,
        budget_tier: budgetTier,
        intake: targetIntake,
        english_status: englishStatus,
        city: cleanPlace,
      });

      saveLeadProfileLocally({
        name: cleanName,
        dialCode,
        phone: mobileNumber.trim(),
        email: email.trim(),
        city: cleanPlace,
        preferredDestination,
        consentedAt,
      });

      setReportSectorFilter('all');
      setAiReport(reportPayload);
      setSavedMsg(
        `Matched ${recommendations.length} top ${reportPayload.destination} programmes for your profile.`
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
    'w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 min-h-[44px] sm:min-h-0 text-[16px] sm:text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition-all';
  const labelClass = 'text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1.5';

  const showNumericEngInput =
    englishStatus === 'IELTS' || englishStatus === 'PTE' || englishStatus === 'TOEFL / Duolingo';

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
                {studentName.trim()
                  ? `Top Recommended Programmes for ${studentName}`
                  : 'AI Recommended Programmes · Counselor Quick Check'}
              </h2>
            </div>

            <div className="inline-flex items-center bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 rounded-full self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrency('LOCAL')}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                  currency === 'LOCAL'
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                    : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                }`}
              >
                Local
              </button>
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

          {aiReport.recommendations.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-center space-y-2">
              <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                No exact catalogue matches returned right now.
              </p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                Click &ldquo;Browse All Matching Programmes&rdquo; below to search accredited universities in our live Global Catalogue.
              </p>
            </div>
          ) : (() => {
            const visibleRecommendations = aiReport.recommendations.filter(
              (rec) => reportSectorFilter === 'all' || (rec.institution_type || 'Public') === reportSectorFilter
            );
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                    Showing {visibleRecommendations.length} of {aiReport.recommendations.length} matched programmes
                  </span>
                  <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[11px] font-medium">
                    {(['all', 'Public', 'Private'] as const).map((sec) => {
                      const active = reportSectorFilter === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setReportSectorFilter(sec)}
                          className={`px-3 py-1 rounded-full cursor-pointer transition-all ${
                            active
                              ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                              : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                          }`}
                        >
                          {sec === 'all' ? 'All Unis' : sec}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {visibleRecommendations.map((rec, idx) => (
                  <div
                    key={`${rec.course_id}-${idx}`}
                    className={`bg-white dark:bg-[#1C1C1E] border rounded-2xl p-5 hover:shadow-md transition-shadow space-y-3.5 ${
                      rec.is_priority_university
                        ? 'border-[#0071E3]/30 dark:border-[#2997FF]/30'
                        : 'border-black/[0.08] dark:border-white/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                          <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {rec.university_name}
                          </span>
                          <span>·</span>
                          <span>{rec.country}</span>
                          {rec.is_priority_university && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#0071E3] dark:bg-[#2997FF]/15 dark:text-[#2997FF] text-[11px] font-semibold">
                              <Star className="w-3 h-3 fill-current" />
                              Partner Priority
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              (rec.institution_type || 'Public') === 'Public'
                                ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                                : 'bg-[#F5F5F7] text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]'
                            }`}
                          >
                            {rec.institution_type || 'Public'}
                          </span>
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
                              : 'bg-[#F5F5F7] text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]'
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
                          {formatCurrencyAmount(rec.tuition_fees_eur, currency, true, rec.institution_type, {
                            country: rec.country,
                            fxRates,
                          })}
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

                    {(() => {
                      const linkInfo = resolveCourseUrl({
                        program_name: rec.program_name,
                        course_url: rec.course_url,
                        university: { name: rec.university_name, country: rec.country },
                      });
                      return (
                        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                          {!linkInfo.isDirect && linkInfo.universityUrl && (
                            <a
                              href={linkInfo.universityUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:underline"
                            >
                              <span>University Portal</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <a
                            href={linkInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
                          >
                            <span>{linkInfo.isDirect ? 'Official Course Page' : 'Find Exact Course Page'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          })()}

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
                Export Shortlist (Excel)
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
              <span>Browse All Matching Programmes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Simplified Fast Intake Form (< 30 seconds) */}
      <section
        id="enquiry-form"
        className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none p-6 sm:p-8 space-y-6"
      >
        <div className="border-b border-black/[0.06] dark:border-white/10 pb-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#0066CC] dark:text-[#2997FF] block">
                {counselorQuickMode ? 'Counselor AI Quick Matcher' : '30-Second Eligibility & Course Matcher'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
                Get your personalised study abroad shortlist.
              </h1>
            </div>

            {isStaff && (
              <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[11px] font-medium self-start">
                <button
                  type="button"
                  onClick={() => setCounselorQuickMode(true)}
                  className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                    counselorQuickMode
                      ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                      : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                  }`}
                >
                  Quick AI Check (No Mobile)
                </button>
                <button
                  type="button"
                  onClick={() => setCounselorQuickMode(false)}
                  className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                    !counselorQuickMode
                      ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                      : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                  }`}
                >
                  Save Student Lead
                </button>
              </div>
            )}
          </div>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
            {counselorQuickMode
              ? 'Counselor mode active: evaluate student marks and budget instantly without entering phone details or polluting analytics.'
              : 'Share your marks, IELTS or MOI status, and tuition budget to receive 12 accredited Public and Private options tailored to your exact destination.'}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <span className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E]">
              Verified 2026 Stay-Back
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E]">
              Public &amp; Private Options
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E]">
              Instant Excel Shortlist (.xlsx)
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: STUDY GOAL & ACADEMIC ESSENTIALS */}
          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              1. Study Goal &amp; Academic Essentials
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
                  <option value="Masters">Masters (MSc / MA / MEng)</option>
                  <option value="Undergraduate">Undergraduate (Bachelor)</option>
                  <option value="MBA">MBA</option>
                  <option value="PG Diploma">PG Diploma</option>
                  <option value="PhD">PhD / Research</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Preferred Course / Field</label>
              <input
                type="text"
                value={coursePreference}
                onChange={(e) => setCoursePreference(e.target.value)}
                placeholder="e.g. Computer Science, MBA, Data Science, Logistics..."
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {COURSE_QUICK_CHIPS.map((chip) => {
                  const active = coursePreference.toLowerCase() === chip.toLowerCase();
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCoursePreference(chip)}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0071E3] text-white'
                          : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Academic Row */}
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 pt-1">
              <div className="col-span-2 sm:col-span-4">
                <label className={labelClass}>Highest Qualification</label>
                <select
                  value={highestQualification}
                  onChange={(e) => setHighestQualification(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="bachelor">Bachelor&apos;s Degree</option>
                  <option value="plus2">Completed +2 / 12th</option>
                  <option value="masters">Master&apos;s Degree</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Score (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={scorePercent}
                  onChange={(e) => setScorePercent(e.target.value)}
                  placeholder="e.g. 68"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-3">
                <label className={labelClass}>Passing Year</label>
                <input
                  type="number"
                  min="1995"
                  max="2028"
                  value={passingYear}
                  onChange={(e) => setPassingYear(e.target.value)}
                  placeholder="e.g. 2025"
                  className={inputClass}
                />
              </div>

              <div className="col-span-2 sm:col-span-3">
                <label className={labelClass}>Backlogs</label>
                <select
                  value={backlogBucket}
                  onChange={(e) => setBacklogBucket(e.target.value)}
                  className={inputClass}
                >
                  <option value="0">0 Backlogs</option>
                  <option value="1-2">1–2 Backlogs</option>
                  <option value="3-5">3–5 Backlogs</option>
                  <option value="6+">6+ Backlogs</option>
                </select>
              </div>
            </div>

            {/* Compact Readiness Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className={labelClass}>English Test / MOI</label>
                <div className="flex gap-2">
                  <select
                    value={englishStatus}
                    onChange={(e) => {
                      setEnglishStatus(e.target.value);
                      if (
                        e.target.value !== 'IELTS' &&
                        e.target.value !== 'PTE' &&
                        e.target.value !== 'TOEFL / Duolingo'
                      ) {
                        setEnglishScore('');
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="MOI (No IELTS)">MOI (No IELTS)</option>
                    <option value="IELTS">IELTS</option>
                    <option value="PTE">PTE</option>
                    <option value="Not Taken Yet (Planning)">Not Taken Yet (Planning)</option>
                    <option value="TOEFL / Duolingo">TOEFL / Duolingo</option>
                  </select>
                  {showNumericEngInput && (
                    <input
                      type="number"
                      step="0.5"
                      value={englishScore}
                      onChange={(e) => setEnglishScore(e.target.value)}
                      placeholder={englishStatus === 'IELTS' ? '6.5' : '58'}
                      className="w-20 shrink-0 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3 py-2.5 min-h-[44px] sm:min-h-0 text-[16px] sm:text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Annual Budget</label>
                <select
                  value={budgetTier}
                  onChange={(e) => setBudgetTier(e.target.value)}
                  className={inputClass}
                >
                  <option value="Under €5,000 (Low / Free)">Under €5,000 (Low / Free)</option>
                  <option value="€5,000 – €12,000">€5,000 – €12,000</option>
                  <option value="€12,000 – €20,000">€12,000 – €20,000</option>
                  <option value="€20,000+">€20,000+</option>
                  <option value="Need Education Loan">Need Education Loan</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Target Intake</label>
                <select
                  value={targetIntake}
                  onChange={(e) => setTargetIntake(e.target.value)}
                  className={inputClass}
                >
                  <option value="September / Fall 2026">September / Fall 2026</option>
                  <option value="January / Spring 2027">January / Spring 2027</option>
                  <option value="May / Summer 2027">May / Summer 2027</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className={labelClass + ' mb-0'}>University Sector Preference</span>
              <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[12px] font-medium">
                {(['all', 'Public', 'Private'] as const).map((sec) => {
                  const active = sectorPreference === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSectorPreference(sec)}
                      className={`px-3.5 py-1 rounded-full cursor-pointer transition-all ${
                        active
                          ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                          : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      {sec === 'all' ? 'All (Public & Private)' : `${sec} Only`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTACT DETAILS (1-TAP AUTOFILL) - HIDDEN IN COUNSELOR QUICK CHECK MODE */}
          {!counselorQuickMode && (
            <div className="space-y-3.5 pt-5 border-t border-black/[0.06] dark:border-white/10">
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                2. Your Contact Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Your full name"
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
                      className="w-24 shrink-0 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-2.5 py-2.5 min-h-[44px] sm:min-h-0 text-[16px] sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
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
                  <label className={labelClass}>City / State *</label>
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
                  <label className={labelClass}>Email Address (Optional)</label>
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
              </div>
            </div>
          )}

          {/* SECTION 3: COLLAPSIBLE OPTIONAL DETAILS */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline cursor-pointer"
            >
              {showOptional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>
                Add optional details (Stream / Degree name, Work Exp, GRE/GMAT, Notes)
              </span>
            </button>

            {showOptional && (
              <div className="mt-4 p-4 rounded-2xl bg-[#F5F5F7]/70 dark:bg-[#2C2C2E]/40 border border-black/[0.05] dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className={labelClass}>Degree / Stream Name</label>
                  <input
                    type="text"
                    value={degreeStreamName}
                    onChange={(e) => setDegreeStreamName(e.target.value)}
                    placeholder="e.g. B.Tech CS, B.Com, Science"
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
                    placeholder="0"
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
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelClass}>Specific Notes</label>
                  <input
                    type="text"
                    value={specificEnquiry}
                    onChange={(e) => setSpecificEnquiry(e.target.value)}
                    placeholder="Scholarships, Spouse Visa, PR pathway, part-time work..."
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Partner Contact Consent */}
          {!counselorQuickMode && (
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/10">
              <label className="flex items-start gap-2.5 cursor-pointer text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                <input
                  type="checkbox"
                  checked={consentPartnerContact}
                  onChange={(e) => setConsentPartnerContact(e.target.checked)}
                  className="mt-0.5 rounded border-black/20 text-[#0071E3] focus:ring-[#0071E3]"
                />
                <span>
                  I agree to receive my personalised programme shortlist and study abroad guidance via phone or WhatsApp from {brandName} advisors.
                </span>
              </label>
            </div>
          )}

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
              className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Finding Best {preferredDestination || 'Study Abroad'} Options...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {counselorQuickMode
                    ? 'Run AI Quick Match'
                    : 'Get My Personalised Shortlist'}
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
