'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Euro,
  Globe2,
  Briefcase,
  ArrowRight
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
    'Malta',
    'Germany',
    'Ireland',
    'Netherlands',
    'Sweden',
    'Australia',
    'Canada'
  ]);

  const [budget, setBudget] = useState<number>(25000);
  const [country, setCountry] = useState<string>('Malta');
  const [category, setCategory] = useState<string>('Business & Management');
  const [degreePercent, setDegreePercent] = useState<number>(70);
  const [ieltsScore, setIeltsScore] = useState<number>(6.5);
  const [careerGoal, setCareerGoal] = useState<string>('Permanent Settlement (PR)');
  const [studentName, setStudentName] = useState<string>('Applicant');
  const [email, setEmail] = useState<string>('student@example.com');
  const [phone, setPhone] = useState<string>('+356 000 0000');

  useEffect(() => {
    async function loadLiveCountries() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && data.courses) {
          const distinct = new Set<string>();
          data.courses.forEach((c: any) => {
            if (c.university?.country) distinct.add(c.university.country);
          });
          if (distinct.size > 0) {
            const list = Array.from(distinct);
            setAvailableCountries(list);
            if (!list.includes(country)) {
              setCountry(list[0]);
            }
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
          target_countries: [country],
          degree_percent: degreePercent,
          english_score: ieltsScore,
          career_goal: careerGoal,
          course_category: category,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setRecommendations(data.recommendations);
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
      className="relative my-8 rounded-3xl overflow-hidden bg-white dark:bg-[#0f1420]/90 border border-slate-200 dark:border-cyan-500/25 p-6 md:p-8 shadow-xl shadow-slate-200/60 dark:shadow-cyan-950/30 transition-colors"
    >
      {/* Subtle Ambient Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 dark:border-white/10 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                AI Course Recommender
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Smart ROI &amp; Visa Match
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Answer 2 quick steps to get your top 3 best-fit courses based on budget, scores, and stay-back visa rules.
            </p>
          </div>
        </div>

        {/* Clean Step Indicator */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 self-start md:self-auto">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                step === s.num
                  ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200 dark:border-cyan-500/30'
                  : step > s.num
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
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
          <div className="w-14 h-14 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              AI is analyzing your profile...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Checking eligibility rules, MOI acceptance, tuition ROI, and post-study visa options in {country}.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Goals & Budget */}
      {!loading && step === 1 && (
        <div className="pt-6 space-y-5 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Dream Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
              >
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Field of Study
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
              >
                <option value="Business & Management">Business &amp; Management</option>
                <option value="Engineering">Engineering &amp; Logistics</option>
                <option value="Computer Science & AI">Computer Science &amp; AI</option>
                <option value="Data Science">Data Science &amp; Analytics</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-purple-400" /> Main Career Goal
              </label>
              <select
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
              >
                <option value="Permanent Settlement (PR)">Job &amp; Permanent Settlement (PR)</option>
                <option value="High ROI Job">Fastest ROI &amp; High Salary</option>
                <option value="Research / Academia">Top Global Ranking &amp; Research</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Maximum Tuition Budget
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
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
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>€0 (Tuition Free)</span>
              <span>€25,000</span>
              <span>€50,000+</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="neon-btn-cyan px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              Next: Enter Your Marks
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Academic Profile & Scores */}
      {!loading && step === 2 && (
        <div className="pt-6 space-y-5 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Your Degree / 12th Percentage
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={degreePercent}
                  onChange={(e) => setDegreePercent(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                English Test (IELTS / MOI)
              </label>
              <select
                value={ieltsScore}
                onChange={(e) => setIeltsScore(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              >
                <option value="5.5">MOI Letter / IELTS 5.5</option>
                <option value="6.0">IELTS 6.0 / PTE 50</option>
                <option value="6.5">IELTS 6.5 / PTE 58</option>
                <option value="7.0">IELTS 7.0+ / PTE 65+</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Your Name
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              className="neon-btn-emerald px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Get My Top 3 Recommendations
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Top 3 Recommendations */}
      {!loading && step === 3 && recommendations && (
        <div className="pt-6 space-y-5 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Top 3 Matches in {country}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked by eligibility fit, return on investment (ROI), and settlement probability.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold self-start sm:self-auto cursor-pointer"
            >
              Try Different Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec, i) => (
              <div
                key={rec.course_id}
                className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                      #{i + 1} Top Pick
                    </span>
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {rec.fit_score}% Fit
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                    {rec.program_name}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                    {rec.university_name} • <span className="text-cyan-600 dark:text-cyan-400">{rec.country}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 my-3 py-2.5 border-y border-slate-200 dark:border-white/10 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">ROI Score</span>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{rec.roi_ratio}x</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">PR Likelihood</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-purple-400">
                        {rec.settlement_probability_percent}%
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-white/5 p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
                    {rec.rationale}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Verified Program</span>
                  <a
                    href="#results-section"
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
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
