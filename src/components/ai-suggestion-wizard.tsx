'use client';

import { useState, useEffect } from 'react';
import {
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Euro,
  Globe2,
  Briefcase,
  ArrowRight,
  Compass,
} from 'lucide-react';

interface Recommendation {
  course_id: string;
  program_name: string;
  university_name: string;
  country: string;
  fit_score: number;
  roi_ratio: number;
  settlement_probability_percent: number;
  rationale: string;
}

export default function AiSuggestionWizard() {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);

  const [availableCountries, setAvailableCountries] = useState<string[]>([
    'United Kingdom',
    'Germany',
    'Ireland',
    'Netherlands',
    'Sweden',
    'Australia',
    'Canada',
    'Poland',
    'Malta',
  ]);

  const [budget, setBudget] = useState<number>(25000);
  const [country, setCountry] = useState<string>('United Kingdom');
  const [category, setCategory] = useState<string>('Business & Management');
  const [degreePercent, setDegreePercent] = useState<number>(70);
  const [ieltsScore, setIeltsScore] = useState<number>(6.5);
  const [careerGoal, setCareerGoal] = useState<string>('Permanent Settlement (PR)');
  const [studentName, setStudentName] = useState<string>('Applicant');
  const [email, setEmail] = useState<string>('student@example.com');
  const [phone, setPhone] = useState<string>('+44 000 0000');

  useEffect(() => {
    async function loadLiveCountries() {
      try {
        const res = await fetch('/api/courses?meta=true');
        const data = await res.json();
        if (data.success && Array.isArray(data.countries) && data.countries.length > 0) {
          setAvailableCountries(data.countries);
          if (!data.countries.includes(country)) {
            setCountry(data.countries[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load countries for AI wizard:', err);
      }
    }
    loadLiveCountries();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName,
          email,
          phone,
          budget_eur: budget,
          preferred_destination: country,
          target_countries: [country],
          degree_percent: degreePercent,
          english_score: ieltsScore,
          career_goal: careerGoal,
          course_category: category,
        }),
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.recommendations)) {
        setRecommendations(data.recommendations.slice(0, 3));
        setStep(3);
      }
    } catch (err) {
      console.error('Wizard error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="ai-wizard"
      className="my-8 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-black/[0.06] dark:border-white/10 gap-4">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-[#0071E3] dark:text-[#2997FF] shrink-0 mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-[-0.02em]">
                Smart Programme Matcher
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
                ROI &amp; Visa Check
              </span>
            </div>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
              Enter two quick steps to preview top matching programmes based on budget, scores, and 2026 stay-back rules.
            </p>
          </div>
        </div>

        {/* Clean Step Segmented Control */}
        <div className="flex items-center gap-1 bg-[#E5E5EA]/70 dark:bg-[#2C2C2E] p-1 rounded-full self-start md:self-auto">
          {[
            { num: 1, label: '1. Goals' },
            { num: 2, label: '2. Marks' },
            { num: 3, label: '3. Top 3' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                if (s.num < 3 || recommendations) setStep(s.num);
              }}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                step === s.num
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm'
                  : step > s.num
                  ? 'text-[#0066CC] dark:text-[#2997FF]'
                  : 'text-[#6E6E73] dark:text-[#A1A1A6]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Evaluating matching programmes...
            </h3>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] max-w-sm mt-1">
              Checking entry criteria, MOI acceptance, tuition ROI, and 2026 stay-back permits in {country}.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Goals & Budget */}
      {!loading && step === 1 && (
        <div className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" /> Destination Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none font-medium"
              >
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" /> Field of Study
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none font-medium"
              >
                <option value="Business & Management">Business &amp; Management</option>
                <option value="Engineering">Engineering &amp; Logistics</option>
                <option value="Computer Science & AI">Computer Science &amp; AI</option>
                <option value="Data Science">Data Science &amp; Analytics</option>
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" /> Primary Outcome
              </label>
              <select
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none font-medium"
              >
                <option value="Permanent Settlement (PR)">Post-Study Work &amp; PR</option>
                <option value="High ROI Job">Fastest ROI &amp; Salary</option>
                <option value="Research / Academia">Research &amp; Ranking</option>
              </select>
            </div>
          </div>

          <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" /> Maximum Annual Tuition Budget
              </span>
              <span className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                €{budget.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full h-1.5 bg-black/10 dark:bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#0071E3]"
            />
            <div className="flex justify-between text-[11px] text-[#86868B] mt-1">
              <span>€0 (Tuition Free)</span>
              <span>€25,000</span>
              <span>€50,000+</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              Next: Academic Marks
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Academic Profile & Scores */}
      {!loading && step === 2 && (
        <div className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 block">
                Degree / 12th Percentage
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={degreePercent}
                  onChange={(e) => setDegreePercent(Number(e.target.value))}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
                />
                <span className="absolute right-3.5 top-2.5 text-[12px] text-[#86868B]">%</span>
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 block">
                English Test (IELTS / MOI)
              </label>
              <select
                value={ieltsScore}
                onChange={(e) => setIeltsScore(Number(e.target.value))}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
              >
                <option value="5.5">MOI Letter / IELTS 5.5</option>
                <option value="6.0">IELTS 6.0 / PTE 50</option>
                <option value="6.5">IELTS 6.5 / PTE 58</option>
                <option value="7.0">IELTS 7.0+ / PTE 65+</option>
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 block">
                Your Name
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5 block">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-full text-[13px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              className="px-6 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium flex items-center gap-2 cursor-pointer transition-colors"
            >
              Get Top 3 Matches
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Top 3 Recommendations */}
      {!loading && step === 3 && recommendations && (
        <div className="pt-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#1D7A39] dark:text-[#34C759]" />
                Top Matches in {country}
              </h3>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                Ranked by eligibility fit, tuition ROI, and post-study stay-back eligibility.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-[13px] text-[#0066CC] dark:text-[#2997FF] hover:underline font-medium self-start sm:self-auto cursor-pointer"
            >
              Adjust Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec, i) => (
              <div
                key={rec.course_id}
                className="bg-[#F5F5F7] dark:bg-[#2C2C2E] p-5 rounded-2xl border border-black/[0.04] dark:border-white/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#2997FF]/15 dark:text-[#2997FF]">
                      #{i + 1} Pick
                    </span>
                    <div className="flex items-center gap-1 text-[#1D7A39] dark:text-[#34C759] font-semibold text-[12px]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {rec.fit_score}% Fit
                    </div>
                  </div>

                  <h4 className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] text-[15px] line-clamp-2">
                    {rec.program_name}
                  </h4>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] font-medium mt-1">
                    {rec.university_name} · <span className="text-[#0066CC] dark:text-[#2997FF]">{rec.country}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 my-3 py-2.5 border-y border-black/[0.06] dark:border-white/10 text-center">
                    <div>
                      <span className="text-[10px] text-[#86868B] uppercase font-semibold block">ROI Score</span>
                      <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {rec.roi_ratio}x
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#86868B] uppercase font-semibold block">Settlement Fit</span>
                      <span className="text-[13px] font-semibold text-[#0066CC] dark:text-[#2997FF]">
                        {rec.settlement_probability_percent}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed bg-white dark:bg-[#1C1C1E] p-3 rounded-xl">
                    {rec.rationale}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-[#86868B] font-medium">Accredited Programme</span>
                  <a
                    href="#results-section"
                    className="text-[12px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline flex items-center gap-1"
                  >
                    Browse All <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
