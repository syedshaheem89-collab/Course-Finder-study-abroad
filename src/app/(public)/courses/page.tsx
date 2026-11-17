'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  MapPin,
  GraduationCap,
  Euro,
  Clock,
  ExternalLink,
  ShieldCheck,
  X,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  Building2,
  Briefcase,
  Calendar,
  SlidersHorizontal,
  ClipboardList
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import { calculateMatchScore } from '@/lib/match-calculator';
import { COURSE_TYPES, CourseTypeOption, normalizeCourseType, pteToIelts } from '@/lib/course-utils';

function CoursesResultsContent() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<(Course & { matchScore?: number }) | null>(null);

  // Filters initialized from URL query params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTypes, setSelectedTypes] = useState<CourseTypeOption[]>(() => {
    const t = searchParams.get('types');
    return t ? (t.split(',') as CourseTypeOption[]) : [];
  });
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  const [selectedUniversity, setSelectedUniversity] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
  const [selectedIntake, setSelectedIntake] = useState('all');
  const [maxTuition, setMaxTuition] = useState<number>(() => {
    const b = searchParams.get('budget');
    return b ? Number(b) : 40000;
  });

  // Qualification Filters
  const [twelfthPercent, setTwelfthPercent] = useState<number>(() => {
    const v = searchParams.get('twelfth');
    return v ? Number(v) : 65;
  });
  const [degreePercent, setDegreePercent] = useState<number>(() => {
    const v = searchParams.get('degree');
    return v ? Number(v) : 60;
  });
  const [backlogs, setBacklogs] = useState<number>(() => {
    const v = searchParams.get('backlogs');
    return v ? Number(v) : 0;
  });
  const [ieltsScore, setIeltsScore] = useState<number>(() => {
    const v = searchParams.get('ielts');
    return v ? Number(v) : 6.0;
  });
  const [pteScore, setPteScore] = useState<number>(0);
  const [hasMoi, setHasMoi] = useState<boolean>(() => searchParams.get('moi') === 'true');
  const [workExpMonths, setWorkExpMonths] = useState<number>(() => {
    const v = searchParams.get('exp');
    return v ? Number(v) : 0;
  });
  const [sortBy, setSortBy] = useState<'match' | 'tuition_asc' | 'salary_desc'>('match');

  useEffect(() => {
    async function loadLiveCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
        }
      } catch (e) {
        console.error('Error loading courses:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLiveCourses();
  }, []);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.university?.country) set.add(c.university.country);
    });
    return Array.from(set).sort();
  }, [courses]);

  const availableUniversities = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c) => {
      if (c.university) map.set(c.university.id, `${c.university.name} (${c.university.country})`);
    });
    return Array.from(map.entries());
  }, [courses]);

  const typeCounts = useMemo(() => {
    const counts: Record<CourseTypeOption, number> = {
      Undergraduate: 0,
      Masters: 0,
      'UG Diploma': 0,
      'PG Diploma': 0,
      Certificate: 0,
      'PG Certificate': 0,
    };
    courses.forEach((c) => {
      const t = normalizeCourseType(c);
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [courses]);

  const toggleType = (type: CourseTypeOption) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const resetAll = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedCountry('');
    setSelectedUniversity('all');
    setSelectedSubject('');
    setSelectedIntake('all');
    setMaxTuition(40000);
  };

  const effectiveIelts = useMemo(() => {
    const convertedPte = pteToIelts(pteScore);
    return Math.max(ieltsScore, convertedPte);
  }, [ieltsScore, pteScore]);

  const filteredCourses = useMemo(() => {
    const list = courses
      .map((course) => {
        let matchScore = calculateMatchScore(course.eligibility_rules, {
          twelfth_percent: twelfthPercent,
          degree_percent: degreePercent,
          ielts_score: effectiveIelts,
          has_moi: hasMoi,
          work_experience_months: workExpMonths,
        });

        if (backlogs > 5) matchScore = Math.max(40, matchScore - 15);
        else if (backlogs > 2) matchScore = Math.max(50, matchScore - 5);

        return { ...course, matchScore };
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

        if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeCourseType(course))) {
          return false;
        }

        if (selectedCountry && course.university?.country !== selectedCountry) {
          return false;
        }

        if (selectedUniversity !== 'all' && course.university_id !== selectedUniversity) {
          return false;
        }

        if (selectedSubject && course.category !== selectedSubject) {
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

    if (sortBy === 'match') {
      list.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'tuition_asc') {
      list.sort((a, b) => a.tuition_fees_eur - b.tuition_fees_eur);
    } else if (sortBy === 'salary_desc') {
      list.sort((a, b) => b.average_graduate_salary - a.average_graduate_salary);
    }

    return list;
  }, [
    courses,
    searchQuery,
    selectedTypes,
    selectedCountry,
    selectedUniversity,
    selectedSubject,
    selectedIntake,
    maxTuition,
    twelfthPercent,
    degreePercent,
    backlogs,
    effectiveIelts,
    hasMoi,
    workExpMonths,
    sortBy,
  ]);

  return (
    <div className="min-h-screen">
      {/* Slim Top Context Bar */}
      <div className="bg-white/70 dark:bg-[#0b0e17]/70 backdrop-blur-md border-b border-slate-200 dark:border-white/10 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Home
            </Link>
            <span className="text-slate-300 dark:text-white/20">/</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Programme Directory
            </span>
          </div>

          <Link
            href="/enquiry"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-xl border border-cyan-500/20 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Fill Qualification Enquiry
          </Link>
        </div>
      </div>

      {/* Main 2-Column 2026 Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR FILTERS */}
          <aside className="lg:col-span-3 glass-panel rounded-2xl p-5 space-y-5 sticky top-20">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Filters
              </span>
              <button
                onClick={resetAll}
                className="text-[11px] font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by keyword..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Course Type Checkboxes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Course Type
              </label>
              <div className="space-y-1 bg-slate-50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200 dark:border-white/10">
                {COURSE_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-1 hover:text-cyan-600 dark:hover:text-cyan-300"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                        className="accent-cyan-600 rounded cursor-pointer"
                      />
                      <span className="font-medium">{type}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">({typeCounts[type] || 0})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subject Groups */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                Subject Group
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Subjects</option>
                <option value="Computer Science & AI">Computer Science &amp; AI</option>
                <option value="Data Science">Data Science</option>
                <option value="Engineering">Engineering &amp; Logistics</option>
                <option value="Business & Management">Business &amp; Management</option>
              </select>
            </div>

            {/* Location / Country & Institution */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-500" /> Location
              </span>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Countries</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedUniversity}
                onChange={(e) => setSelectedUniversity(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Institutions</option>
                {availableUniversities.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tuition & Intake */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Max Tuition Fees</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    €{maxTuition.toLocaleString()}
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40000"
                  step="1000"
                  value={maxTuition}
                  onChange={(e) => setMaxTuition(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none accent-cyan-500 cursor-pointer"
                />
              </div>

              <select
                value={selectedIntake}
                onChange={(e) => setSelectedIntake(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Any Intake</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="February">February</option>
                <option value="July">July</option>
              </select>
            </div>

            {/* Student Qualification Filter */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> Student Qualification
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    +2 / 12th %
                  </label>
                  <input
                    type="number"
                    value={twelfthPercent}
                    onChange={(e) => setTwelfthPercent(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Bachelor %
                  </label>
                  <input
                    type="number"
                    value={degreePercent}
                    onChange={(e) => setDegreePercent(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Backlogs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={backlogs}
                    onChange={(e) => setBacklogs(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Work Exp (Mo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={workExpMonths}
                    onChange={(e) => setWorkExpMonths(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    IELTS Score
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={ieltsScore}
                    onChange={(e) => setIeltsScore(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    PTE Score
                  </label>
                  <input
                    type="number"
                    value={pteScore}
                    onChange={(e) => setPteScore(Number(e.target.value))}
                    placeholder="e.g. 58"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hasMoi}
                  onChange={(e) => setHasMoi(e.target.checked)}
                  className="accent-cyan-600 rounded cursor-pointer"
                />
                <span>MOI (Medium of Instruction)</span>
              </label>
            </div>
          </aside>

          {/* RIGHT SIDE RESULTS LIST */}
          <main className="lg:col-span-9 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {filteredCourses.length} programmes found
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {selectedTypes.map((t) => (
                    <span
                      key={t}
                      onClick={() => toggleType(t)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 px-2.5 py-0.5 rounded-full cursor-pointer"
                    >
                      {t} <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedCountry && (
                    <span
                      onClick={() => setSelectedCountry('')}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-0.5 rounded-full cursor-pointer"
                    >
                      {selectedCountry} <X className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white self-start sm:self-auto"
              >
                <option value="match">Sort by: Best Match %</option>
                <option value="tuition_asc">Sort by: Lowest Tuition</option>
                <option value="salary_desc">Sort by: Highest Avg Salary</option>
              </select>
            </div>

            {loading && (
              <div className="py-6 text-center text-xs text-slate-500">
                Syncing live programmes...
              </div>
            )}

            {filteredCourses.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center space-y-3">
                <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No programmes match these exact filters
                </h3>
                <button
                  onClick={resetAll}
                  className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCourses.map((course) => {
                  const score = course.matchScore ?? 85;
                  const courseType = normalizeCourseType(course);

                  return (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourse(course)}
                      className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-white/10">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                              {courseType}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {course.university?.name} • {course.university?.country}
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                            {course.program_name}
                          </h2>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shrink-0 self-start ${
                            score >= 80
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : score >= 60
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {score}% Match
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Language Policy
                          </span>
                          <span className="text-slate-700 dark:text-slate-200 font-medium">
                            {course.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                              ? 'MOI Accepted'
                              : course.eligibility_rules?.english_requirement_type === 'WAIVED'
                              ? 'English Waived'
                              : `IELTS ${course.eligibility_rules?.min_ielts || 6.0}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Intakes
                          </span>
                          <span className="text-slate-700 dark:text-slate-200 font-medium">
                            {course.intake_months?.join(', ') || 'September'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Duration &amp; Visa
                          </span>
                          <span className="text-purple-700 dark:text-purple-300 font-semibold">
                            {course.duration_months} mo • {course.stay_back_visa_years}y Stay Back
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Tuition Fees
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {course.tuition_fees_eur === 0
                              ? 'Free (€0)'
                              : `€${course.tuition_fees_eur.toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* COURSE DETAIL MODAL */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCourse(null)}
        >
          <div
            className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/15 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                  {normalizeCourseType(selectedCourse)}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                  {selectedCourse.program_name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {selectedCourse.university?.name} ({selectedCourse.university?.country})
                </p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Tuition</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Euro className="w-3.5 h-3.5" />
                  {selectedCourse.tuition_fees_eur === 0
                    ? 'Free'
                    : selectedCourse.tuition_fees_eur.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Stay Back</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedCourse.stay_back_visa_years} Years
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Avg Salary</span>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  €{selectedCourse.average_graduate_salary.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Match Fit</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedCourse.matchScore}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-white">Admission &amp; Eligibility Criteria</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>Min +2 / 12th %: <strong>{selectedCourse.eligibility_rules?.min_12th_percent || 50}%</strong></div>
                <div>Min Degree %: <strong>{selectedCourse.eligibility_rules?.min_degree_percent || 50}%</strong></div>
                <div>Min IELTS: <strong>{selectedCourse.eligibility_rules?.min_ielts || 6.0}</strong></div>
                <div>
                  Intakes:{' '}
                  <strong className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {selectedCourse.intake_months?.join(', ')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <a
                href={selectedCourse.course_url}
                target="_blank"
                rel="noopener noreferrer"
                className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                Visit Official University Page <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-slate-500">
          Loading programme directory...
        </div>
      }
    >
      <CoursesResultsContent />
    </Suspense>
  );
}
