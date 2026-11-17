'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  GraduationCap,
  Briefcase,
  MapPin,
  Clock,
  Euro,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { MOCK_COURSES, MOCK_UNIVERSITIES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import { calculateMatchScore } from '@/lib/match-calculator';
import AiSuggestionWizard from '@/components/ai-suggestion-wizard';

export default function CourseSearchPage() {
  // Filter states
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntake, setSelectedIntake] = useState<string>('all');
  const [maxTuition, setMaxTuition] = useState<number>(40000);

  // Student academic scores for real-time Match Score % calculation
  const [twelfthScore, setTwelfthScore] = useState<number>(75);
  const [degreeScore, setDegreeScore] = useState<number>(72);
  const [englishScore, setEnglishScore] = useState<number>(6.5);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract available distinct values
  const allCountries = useMemo(() => {
    return Array.from(new Set(MOCK_UNIVERSITIES.map((u) => u.country)));
  }, []);

  const allCategories = [
    'Computer Science & AI',
    'Data Science',
    'Engineering',
    'Business & Management',
  ];

  const allIntakes = ['September', 'October', 'February', 'July', 'August', 'April'];

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  const resetFilters = () => {
    setSelectedCountries([]);
    setSelectedUniversity('all');
    setSelectedCategory('all');
    setSelectedIntake('all');
    setMaxTuition(40000);
    setSearchQuery('');
  };

  // Filtered courses with real-time match scores
  const filteredCourses = useMemo(() => {
    return MOCK_COURSES.map((course) => {
      const matchScore = calculateMatchScore(course.eligibility_rules, {
        twelfth_percent: twelfthScore,
        degree_percent: degreeScore,
        ielts_score: englishScore,
      });

      return {
        ...course,
        matchScore,
      };
    }).filter((course) => {
      // 1. Search Query
      if (
        searchQuery &&
        !course.program_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !course.university?.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // 2. Country
      if (
        selectedCountries.length > 0 &&
        course.university &&
        !selectedCountries.includes(course.university.country)
      ) {
        return false;
      }

      // 3. University
      if (selectedUniversity !== 'all' && course.university_id !== selectedUniversity) {
        return false;
      }

      // 4. Category
      if (selectedCategory !== 'all' && course.category !== selectedCategory) {
        return false;
      }

      // 5. Intake
      if (
        selectedIntake !== 'all' &&
        !course.intake_months.some((m) => m.toLowerCase() === selectedIntake.toLowerCase())
      ) {
        return false;
      }

      // 6. Max Tuition
      if (course.tuition_fees_eur > maxTuition) {
        return false;
      }

      return true;
    });
  }, [
    searchQuery,
    selectedCountries,
    selectedUniversity,
    selectedCategory,
    selectedIntake,
    maxTuition,
    twelfthScore,
    degreeScore,
    englishScore,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Global Education Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Find Your Dream Course with{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            AI Certainty
          </span>
        </h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Search accredited degrees across Germany, Ireland, Netherlands, and Australia. Match your scores against real admission criteria, post-study work rights, and ROI metrics.
        </p>
      </div>

      {/* AI Suggestion Form Component (Wizard) */}
      <AiSuggestionWizard />

      {/* Main Search & Discovery Section */}
      <div id="results-section" className="pt-6">
        {/* Search Bar & Quick Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search programs (e.g. Data Science, TUM, robotics)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs text-slate-400">
              Showing <strong className="text-cyan-400">{filteredCourses.length}</strong> matching programs
            </span>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* 2-Column Complex Layout: Left Sidebar + Right Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================================= */}
          {/* LEFT SIDEBAR FILTERS (4 Cols) */}
          {/* ========================================================================= */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-6 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                  Criteria & Score Matcher
                </h3>
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold">
                  Live Sync
                </span>
              </div>

              {/* 1. Academic Score Evaluator (Dynamically drives Match Score %) */}
              <div className="space-y-3 p-3.5 rounded-xl bg-white/5 border border-cyan-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <GraduationCap className="w-4 h-4" />
                  <span>Your Academic Profile</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">12th Grade %</label>
                    <input
                      type="number"
                      value={twelfthScore}
                      onChange={(e) => setTwelfthScore(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Undergrad %</label>
                    <input
                      type="number"
                      value={degreeScore}
                      onChange={(e) => setDegreeScore(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* English Language Score dropdown (IELTS/PTE) */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">English Test Score (IELTS/PTE)</label>
                  <select
                    value={englishScore}
                    onChange={(e) => setEnglishScore(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="6.0">IELTS 6.0 / PTE 50</option>
                    <option value="6.5">IELTS 6.5 / PTE 58</option>
                    <option value="7.0">IELTS 7.0 / PTE 65</option>
                    <option value="7.5">IELTS 7.5 / PTE 73</option>
                    <option value="8.0">IELTS 8.0+ / PTE 79+</option>
                  </select>
                </div>
              </div>

              {/* 2. Country Multi-Select */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Destination Country (Multi-Select)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allCountries.map((c) => {
                    const isSelected = selectedCountries.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleCountry(c)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm shadow-cyan-500/30'
                            : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/20 hover:text-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. University Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">University</label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Global Universities</option>
                  {MOCK_UNIVERSITIES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Course Category */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Course Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Disciplines</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Intake Dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Target Intake</label>
                <select
                  value={selectedIntake}
                  onChange={(e) => setSelectedIntake(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">Any Intake Term</option>
                  {allIntakes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Fees Slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Max Tuition Fees</label>
                  <span className="text-xs font-bold text-emerald-400">
                    {maxTuition === 0 ? 'Free Only' : `€${maxTuition.toLocaleString()}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40000"
                  step="2000"
                  value={maxTuition}
                  onChange={(e) => setMaxTuition(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>€0 (Free)</span>
                  <span>€20,000</span>
                  <span>€40,000+</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* RIGHT SIDE RESULTS (8 Cols) */}
          {/* ========================================================================= */}
          <main className="lg:col-span-8 space-y-4">
            {filteredCourses.length === 0 ? (
              <div className="glass-card p-12 rounded-2xl text-center space-y-3">
                <GraduationCap className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Matching Courses Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try broadening your tuition fee slider or clearing country selections to view more opportunities.
                </p>
                <button
                  onClick={resetFilters}
                  className="neon-btn-cyan px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              filteredCourses.map((course) => {
                const matchScore = course.matchScore ?? 85;
                const isHighMatch = matchScore >= 80;
                const isMediumMatch = matchScore >= 60 && matchScore < 80;

                return (
                  <div
                    key={course.id}
                    className="glass-card glass-card-hover p-5 sm:p-6 rounded-2xl relative overflow-hidden group"
                  >
                    {/* Top Row: Degree Badge, University Name, and Match Score Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {course.degree_level}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {course.university?.name}
                        </span>
                      </div>

                      {/* Dynamic Match Score % Badge */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                          isHighMatch
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isMediumMatch
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Match Score: {matchScore}%</span>
                      </div>
                    </div>

                    {/* Program Title */}
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {course.program_name}
                    </h3>

                    {/* Metadata Badges: Country, Duration, Stay-Back, Salary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 py-3 border-y border-white/5">
                      {/* Stay-Back Visa Years (Requested in prompt) */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Visa Stay Back</span>
                          <span className="text-xs font-bold text-purple-300">
                            {course.stay_back_visa_years} Years
                          </span>
                        </div>
                      </div>

                      {/* Tuition Fees */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Euro className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Tuition Fees</span>
                          <span className="text-xs font-bold text-emerald-300">
                            {course.tuition_fees_eur === 0
                              ? '€0 (Tuition Free)'
                              : `€${course.tuition_fees_eur.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      {/* Average Graduate Salary */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                          <Briefcase className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Avg Salary</span>
                          <span className="text-xs font-bold text-cyan-300">
                            €{course.average_graduate_salary.toLocaleString()}/yr
                          </span>
                        </div>
                      </div>

                      {/* Country & Global Ranking */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {course.university?.country}
                          </span>
                          <span className="text-xs font-bold text-amber-300">
                            QS #{course.university?.global_ranking}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Eligibility Snapshot & Intake tags */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[11px] border border-white/5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Intakes: {course.intake_months.join(', ')}
                        </span>
                        <span className="bg-white/5 px-2 py-0.5 rounded text-[11px] border border-white/5">
                          Min IELTS: {course.eligibility_rules?.min_ielts}
                        </span>
                        <span className="bg-white/5 px-2 py-0.5 rounded text-[11px] border border-white/5">
                          Min Degree: {course.eligibility_rules?.min_degree_percent}%
                        </span>
                        {course.eligibility_rules?.interview_required && (
                          <span className="text-amber-400 text-[11px]">Interview Req</span>
                        )}
                      </div>

                      {/* Action Links */}
                      <div className="flex items-center gap-2">
                        <a
                          href={course.course_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
                        >
                          Official Portal
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
