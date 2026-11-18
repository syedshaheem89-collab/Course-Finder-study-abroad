'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  GraduationCap,
  BookOpen,
  Languages,
  Compass,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { pteToIelts } from '@/lib/course-utils';

interface StudentEnquiryFormProps {
  availableCountries: string[];
}

export default function StudentEnquiryForm({ availableCountries }: StudentEnquiryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Personal
  const [studentName, setStudentName] = useState('');
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

  // Preferences
  const [preferredDestination, setPreferredDestination] = useState(searchParams.get('country') || '');
  const [coursePreference, setCoursePreference] = useState(searchParams.get('course') || '');

  useEffect(() => {
    const paramCountry = searchParams.get('country');
    const paramCourse = searchParams.get('course');
    if (paramCountry) setPreferredDestination(paramCountry);
    if (paramCourse) setCoursePreference(paramCourse);
  }, [searchParams]);
  const [budget, setBudget] = useState('');
  const [specificEnquiry, setSpecificEnquiry] = useState('');
  const [workExperience, setWorkExperience] = useState('0');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMsg('Please enter the Student Name.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSavedMsg(null);

    const profile = {
      student_name: studentName,
      place,
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
      course: coursePreference,
      budget,
      specific_enquiry: specificEnquiry,
      work_experience_months: Number(workExperience) || 0,
    };

    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName,
          background_profile: profile,
        }),
      });

      setSavedMsg('Enquiry saved! Redirecting to matching courses...');

      // Build query params so the /courses page auto-filters by this student's qualification!
      const params = new URLSearchParams();
      if (coursePreference) params.set('q', coursePreference);
      if (preferredDestination) params.set('country', preferredDestination);
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

      setTimeout(() => {
        router.push(`/courses?${params.toString()}`);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save enquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-600';
  const labelClass = 'text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1';

  return (
    <section
      id="enquiry-form"
      className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-6 sm:p-8"
    >
      <div className="border-b border-slate-200 dark:border-white/10 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Student &amp; Counselor Qualification Form
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Fill in the student&apos;s academic background to save the enquiry and automatically filter eligible courses.
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/20 self-start">
          Counselor Intake
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Personal Details */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Student Name *</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Place / City</label>
              <input
                type="text"
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
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> +2 / Higher Secondary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                placeholder="e.g. Science, Commerce, Humanities"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* 3. Bachelor Degree */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Bachelor Degree
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Master&apos;s (If Applicable)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" /> Language &amp; Entrance Scores
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

        {/* 6. Preferences */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> Preferences &amp; Experience
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Preferred Destination</label>
              <select
                value={preferredDestination}
                onChange={(e) => setPreferredDestination(e.target.value)}
                className={inputClass}
              >
                <option value="">Any Destination</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Course / Keyword</label>
              <input
                type="text"
                value={coursePreference}
                onChange={(e) => setCoursePreference(e.target.value)}
                placeholder="e.g. MBA, Logistics, AI"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Budget (EUR)</label>
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
            <div>
              <label className={labelClass}>Specific Enquiry</label>
              <input
                type="text"
                value={specificEnquiry}
                onChange={(e) => setSpecificEnquiry(e.target.value)}
                placeholder="Scholarships, MOI, PR..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {savedMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{savedMsg}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving &amp; Matching...
              </>
            ) : (
              <>
                Save Enquiry &amp; Find Matching Courses
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
