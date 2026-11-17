'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  TrendingUp,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Euro,
  Globe2,
  Briefcase
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

  // Dynamic live countries fetched from Supabase
  const [availableCountries, setAvailableCountries] = useState<string[]>([
    'Germany',
    'Ireland',
    'Netherlands',
    'Malta',
    'Sweden',
    'Australia',
    'Canada'
  ]);

  // Form State
  const [budget, setBudget] = useState<number>(25000);
  const [country, setCountry] = useState<string>('Malta');
  const [category, setCategory] = useState<string>('Business & Management');
  const [degreePercent, setDegreePercent] = useState<number>(70);
  const [ieltsScore, setIeltsScore] = useState<number>(6.5);
  const [careerGoal, setCareerGoal] = useState<string>('Permanent Settlement (PR)');
  const [studentName, setStudentName] = useState<string>('Applicant');
  const [email, setEmail] = useState<string>('student@example.com');
  const [phone, setPhone] = useState<string>('+356 000 0000');

  // Fetch real countries directly from Supabase courses
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
    <div id="ai-wizard" className="relative my-12 rounded-2xl overflow-hidden glass-panel border border-cyan-500/30 p-6 md:p-8 shadow-2xl shadow-cyan-950/40">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">AI Admission Advisor</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Live Supabase Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-criteria analyzer dynamically scanning newly uploaded Excel, PDF, and web-scraped courses in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                step === s
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : step > s
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-500 border border-white/5'
              }`}
            >
              <span>{s === 1 ? '1. Goals' : s === 2 ? '2. Academics' : '3. Match'}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI is evaluating Supabase catalog...</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Matching your budget and academic profile with active courses in {country}.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Goals and Dynamic Country List */}
      {!loading && step === 1 && (
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Preferred Country (NOW DYNAMIC!) */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" /> Target Country (Live from Supabase)
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
              >
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c} {c.toLowerCase() === 'malta' ? '(MCAST / Schengen English)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Field of Study */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-400" /> Program Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Business & Management">Business & Management</option>
                <option value="Engineering">Engineering, Logistics & Supply Chain</option>
                <option value="Computer Science & AI">Computer Science & AI</option>
                <option value="Data Science">Data Science & Analytics</option>
              </select>
            </div>

            {/* Career Goal */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-400" /> Career Outcome Priority
              </label>
              <select
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Permanent Settlement (PR)">Permanent Settlement (PR & Visa Stability)</option>
                <option value="High ROI Job">High ROI (Fastest Break-Even)</option>
                <option value="Research / Academia">Research & Global Ranking</option>
              </select>
            </div>
          </div>

          {/* Budget Slider */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5 text-emerald-400" /> Max Tuition Budget (Total Degree)
              </span>
              <span className="text-sm font-bold text-emerald-400">€{budget.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              className="neon-btn-cyan px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              Next: Enter Academic Profile
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Academic Profile & Scores */}
      {!loading && step === 2 && (
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">
                Bachelor&apos;s / Degree GPA or %
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={degreePercent}
                  onChange={(e) => setDegreePercent(Number(e.target.value))}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">
                English Proficiency (IELTS / MOI)
              </label>
              <select
                value={ieltsScore}
                onChange={(e) => setIeltsScore(Number(e.target.value))}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="5.5">5.5 (or MOI from College)</option>
                <option value="6.0">6.0 (Standard)</option>
                <option value="6.5">6.5 (High Acceptance)</option>
                <option value="7.0">7.0+ (Superior)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">Applicant Name</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              className="neon-btn-emerald px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Sparkles className="w-4 h-4" />
              Compute AI Recommendations
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Top 3 Recommendations View */}
      {!loading && step === 3 && recommendations && (
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Top AI Recommendations in {country}
              </h3>
              <p className="text-xs text-slate-400">
                Queried in real time against your live Supabase database courses.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-cyan-400 hover:underline font-medium"
            >
              Change Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recommendations.map((rec, i) => (
              <div
                key={rec.course_id}
                className="glass-card p-5 rounded-xl border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Rank #{i + 1} Best Fit
                    </span>
                    <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {rec.fit_score}% Match
                    </div>
                  </div>

                  <h4 className="font-bold text-white text-sm line-clamp-2 mt-2">
                    {rec.program_name}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    {rec.university_name} • <span className="text-cyan-400">{rec.country}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 my-3 py-2 border-y border-white/5 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ROI Index</span>
                      <span className="text-xs font-bold text-cyan-400">{rec.roi_ratio}x Multiple</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">PR Likelihood</span>
                      <span className="text-xs font-bold text-purple-400">{rec.settlement_probability_percent}%</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed italic bg-white/5 p-2.5 rounded-lg border border-white/5">
                    &quot;{rec.rationale}&quot;
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Verified Visa Scheme</span>
                  <a
                    href="#results-section"
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    View in Catalog <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
