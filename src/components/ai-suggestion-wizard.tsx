'use client';

import { useState } from 'react';
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
  Briefcase,
  AlertCircle
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

  // Form State
  const [budget, setBudget] = useState<number>(25000);
  const [country, setCountry] = useState<string>('Germany');
  const [category, setCategory] = useState<string>('Computer Science & AI');
  const [degreePercent, setDegreePercent] = useState<number>(76);
  const [ieltsScore, setIeltsScore] = useState<number>(7.0);
  const [careerGoal, setCareerGoal] = useState<string>('Permanent Settlement (PR)');
  const [studentName, setStudentName] = useState<string>('Alex Rivera');
  const [email, setEmail] = useState<string>('alex.rivera@example.com');
  const [phone, setPhone] = useState<string>('+1 (555) 019-2834');

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
        setStep(3); // Result view
      }
    } catch (err) {
      console.error('Wizard error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-wizard" className="relative my-12 rounded-2xl overflow-hidden glass-panel border border-cyan-500/30 p-6 md:p-8 shadow-2xl shadow-cyan-950/40">
      {/* Background Accent Gradients */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">AI Admission Advisor</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> ROI & PR Analyzer
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-criteria machine learning engine evaluating immigration policy, graduate pay, and university acceptance.
            </p>
          </div>
        </div>

        {/* Step Indicator */}
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

      {/* Loading Screen State */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI is analyzing your profile...</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Cross-referencing global visa stay-back laws, university eligibility constraints, and post-grad wage trends.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Goals and Budget */}
      {!loading && step === 1 && (
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Preferred Country */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" /> Target Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Germany">Germany (Zero Tuition / 18m Stay-Back)</option>
                <option value="Ireland">Ireland (2y Stay-Back / Silicon Docks)</option>
                <option value="Netherlands">Netherlands (Knowledge Migrant Hub)</option>
                <option value="Sweden">Sweden (High Innovation / English Taught)</option>
                <option value="Australia">Australia (3y Post-Study Visa)</option>
                <option value="Canada">Canada (PGWP Pathway)</option>
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
                <option value="Computer Science & AI">Computer Science & AI</option>
                <option value="Data Science">Data Science & Analytics</option>
                <option value="Engineering">Mechanical & Industrial Eng</option>
                <option value="Business & Management">Business Analytics / MBA</option>
              </select>
            </div>

            {/* Primary Strategic Goal */}
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
                <option value="High ROI Job">High ROI (Fastest Break-Even / High Salary)</option>
                <option value="Research / Academia">Research & Top Global Ranking</option>
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
              step="2500"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>€0 (Tuition Free - Germany)</span>
              <span>€25,000</span>
              <span>€50,000+</span>
            </div>
          </div>

          {/* Navigation */}
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
                English Proficiency (IELTS Band)
              </label>
              <select
                value={ieltsScore}
                onChange={(e) => setIeltsScore(Number(e.target.value))}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="6.0">6.0 (Competent)</option>
                <option value="6.5">6.5 (Standard Good)</option>
                <option value="7.0">7.0 (High Acceptance)</option>
                <option value="7.5">7.5+ (Elite Requirement)</option>
                <option value="8.0">8.0+ (Superior)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">
                Full Name for Profile Report
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">Phone / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
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

      {/* Step 3: Top 3 Recommendations Result View */}
      {!loading && step === 3 && recommendations && (
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Top 3 AI Tailored Recommendations
              </h3>
              <p className="text-xs text-slate-400">
                Optimized for maximum ROI, visa settlement probability, and academic compatibility.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-cyan-400 hover:underline font-medium"
            >
              Re-calculate with different goals
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
                    {rec.university_name} • <span className="text-slate-400">{rec.country}</span>
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
