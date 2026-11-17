'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Search,
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
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import { calculateMatchScore } from '@/lib/match-calculator';
import AiSuggestionWizard from '@/components/ai-suggestion-wizard';

export default function CourseSearchPage() {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter states
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntake, setSelectedIntake] = useState<string>('all');
  const [maxTuition, setMaxTuition] = useState<number>(40000);

  // Student academic scores for real-time Match Score % calculation
  const [twelfthScore, setTwelfthScore] = useState<number>(70);
  const [degreeScore, setDegreeScore] = useState<number>(68);
  const [englishScore, setEnglishScore] = useState<number>(6.5);
  const [hasMoi, setHasMoi] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadLiveCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && data.courses && data.courses.length > 0) {
          setCourses(data.courses);
        }
      } catch (e) {
        console.error('Error fetching live Supabase courses:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLiveCourses();
  }, []);

  const allCountries = useMemo(() => {
    const countries = new Set<string>();
    courses.forEach((c) => {
      if (c.university?.country) countries.add(c.university.country);
    });
    return Array.from(countries);
  }, [courses]);

  const allUniversities = useMemo(() => {
    const unis = new Map<string, string>();
    courses.forEach((c) => {
      if (c.university) unis.set(c.university.id, `${c.university.name} (${c.university.country})`);
    });
    return Array.from(unis.entries());
  }, [courses]);

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

  const filteredCourses = useMemo(() => {
    return courses
      .map((course) => {
        const matchScore = calculateMatchScore(course.eligibility_rules, {
          twelfth_percent: twelfthScore,
          degree_percent: degreeScore,
          ielts_score: englishScore,
          has_moi: hasMoi,
        });

        return {
          ...course,
          matchScore,
        };
      })
      .filter((course) => {
        if (
          searchQuery &&
          !course.program_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !course.university?.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !course.university?.country?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        if (
          selectedCountries.length > 0 &&
          course.university &&
          !selectedCountries.includes(course.university.country)
        ) {
          return false;
        }

        if (selectedUniversity !== 'all' && course.university_id !== selectedUniversity) {
          return false;
        }

        if (selectedCategory !== 'all' && course.category !== selectedCategory) {
          return false;
        }

        if (
          selectedIntake !== 'all' &&
          !course.intake_months?.some((m) => m.toLowerCase() === selectedIntake.toLowerCase())
        ) {
          return false;
        }

        if (course.tuition_fees_eur > maxTuition) {
          return false;
        }

        return true;
      });
  }, [
    courses,
    searchQuery,
    selectedCountries,
    selectedUniversity,
    selectedCategory,
    selectedIntake,
    maxTuition,
    twelfthScore,
    degreeScore,
    englishScore,
    hasMoi,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Clean 2026 Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-8 space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>2026 Global Education &amp; Visa Intelligence</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
          Find Your Ideal Degree Abroad with{' '}
          <span className="bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 dark:from-cyan-400 dark:via-sky-300 dark:to-indigo-400 bg-clip-text text-transparent">
            AI Clarity
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Compare accredited programs across Malta, Germany, Ireland, Netherlands, and beyond. See your real-time eligibility match, MOI acceptance, and stay-back visa rights.
        </p>

        {/* Instant Hero Search Bar */}
        <div className="pt-2 max-w-xl mx-auto">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4" />
            <input
              type="text"
              placeholder="Search by course, university, or country (e.g. Malta, Logistics, AI)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#0f1420] border border-slate-300 dark:border-white/15 rounded-2xl pl-11 pr-28 py-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-lg shadow-slate-200/50 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
            />
            <a
              href="#results-section"
              className="absolute right-2 neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold"
            >
              Search
            </a>
          </div>

          {/* Quick Country Filter Chips */}
          {allCountries.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
              <button
                onClick={() => setSelectedCountries([])}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer border ${
                  selectedCountries.length === 0
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-cyan-500/40'
                }`}
              >
                All Countries
              </button>
              {allCountries.map((c) => {
                const active = selectedCountries.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCountry(c)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer border ${
                      active
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                        : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-cyan-500/40'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestion Form Component */}
      <AiSuggestionWizard />

      {/* Main Search & Discovery Section */}
      <div id="results-section" className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Course Directory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing <strong className="text-cyan-600 dark:text-cyan-400">{filteredCourses.length}</strong>{' '}
              {loading ? 'courses (syncing...)' : 'live programs'}
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 transition-all cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Filters
          </button>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR FILTERS */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="glass-panel p-5 rounded-2xl space-y-5 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Filter &amp; Match Score
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Live
                </span>
              </div>

              {/* 1. Academic Score Evaluator */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-cyan-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-cyan-300">
                  <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Your Academic Profile</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      12th Grade %
                    </label>
                    <input
                      type="number"
                      value={twelfthScore}
                      onChange={(e) => setTwelfthScore(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Degree %
                    </label>
                    <input
                      type="number"
                      value={degreeScore}
                      onChange={(e) => setDegreeScore(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    English Score (IELTS / PTE)
                  </label>
                  <select
                    value={englishScore}
                    onChange={(e) => setEnglishScore(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="5.5">IELTS 5.5 / PTE 43</option>
                    <option value="6.0">IELTS 6.0 / PTE 50</option>
                    <option value="6.5">IELTS 6.5 / PTE 58</option>
                    <option value="7.0">IELTS 7.0 / PTE 65</option>
                    <option value="7.5">IELTS 7.5+ / PTE 73+</option>
                  </select>
                </div>

                {/* MOI Toggle */}
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasMoi}
                    onChange={(e) => setHasMoi(e.target.checked)}
                    className="rounded accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    I have MOI (Medium of Instruction) letter
                  </span>
                </label>
              </div>

              {/* 2. Country Multi-Select */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Destination Country
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allCountries.map((c) => {
                    const isSelected = selectedCountries.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleCountry(c)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                          isSelected
                            ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/50'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-cyan-500/30'
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  University
                </label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Universities</option>
                  {allUniversities.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Course Category */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Course Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Intake Term
                </label>
                <select
                  value={selectedIntake}
                  onChange={(e) => setSelectedIntake(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">Any Intake</option>
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Max Tuition Fees
                  </label>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>€0 (Free)</span>
                  <span>€20,000</span>
                  <span>€40,000+</span>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT SIDE RESULTS */}
          <main className="lg:col-span-8 space-y-4">
            {filteredCourses.length === 0 ? (
              <div className="glass-card p-12 rounded-2xl text-center space-y-3">
                <GraduationCap className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Matching Courses Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try increasing your tuition slider or clearing country filters to view more programs.
                </p>
                <button
                  onClick={resetFilters}
                  className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
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
                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                          {course.degree_level}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {course.university?.name}
                        </span>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                          isHighMatch
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : isMediumMatch
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Match Score: {matchScore}%</span>
                      </div>
                    </div>

                    {/* Program Title */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                      {course.program_name}
                    </h3>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 py-3 border-y border-slate-200/80 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            Stay Back
                          </span>
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                            {course.stay_back_visa_years} Years
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Euro className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            Tuition
                          </span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {course.tuition_fees_eur === 0
                              ? '€0 (Free)'
                              : `€${course.tuition_fees_eur.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            Avg Salary
                          </span>
                          <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                            €{course.average_graduate_salary.toLocaleString()}/yr
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            {course.university?.country || 'Global'}
                          </span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            QS #{course.university?.global_ranking || 150}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Pills & Link */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-white/5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {course.intake_months?.join(', ') || 'September'}
                        </span>
                        <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-white/5">
                          Min Degree: <strong>{course.eligibility_rules?.min_degree_percent || 50}%</strong>
                        </span>
                        <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-white/5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {course.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                            ? 'MOI Accepted'
                            : course.eligibility_rules?.english_requirement_type === 'WAIVED'
                            ? 'English Waived'
                            : `IELTS ${course.eligibility_rules?.min_ielts || 6.0}`}
                        </span>
                      </div>

                      <a
                        href={course.course_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-cyan-500/10 border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-cyan-300 transition-all self-start sm:self-auto"
                      >
                        Official Portal
                        <ExternalLink className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                      </a>
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
