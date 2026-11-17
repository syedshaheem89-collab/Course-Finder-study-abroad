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
  Calendar
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

  // Filters initialized from URL query params (from Hero Search or Enquiry Form)
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

  // Qualification Filters (pre-filled from Enquiry Form if submitted)
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

        // Slight penalty if student has many backlogs
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e]">
      {/* Slim Top Banner */}
      <div className="bg-[#0a3154] text-white py-3 px-4 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-sky-200 hover:text-white flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Home
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase">
              International Programmes 2026 / 2027
            </span>
          </div>
          <Link
            href="/#enquiry-form"
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sky-100 font-medium"
          >
            + New Student Enquiry
          </Link>
        </div>
      </div>

      {/* Main 2-Column Layout (Like Screenshot 2) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR FILTERS */}
          <aside className="lg:col-span-3 bg-[#e6edf5] dark:bg-[#0f1420] border border-slate-300/80 dark:border-white/10 rounded-lg p-4 space-y-5">
            {/* Search item */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-3 py-2 pr-8 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-600"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* Course Type Checkboxes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Course Type
              </label>
              <div className="space-y-1 bg-white dark:bg-slate-900/70 p-2.5 rounded border border-slate-300/80 dark:border-white/10">
                {COURSE_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-0.5 hover:text-sky-700"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                        className="accent-sky-700 rounded cursor-pointer"
                      />
                      <span>{type}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">({typeCounts[type] || 0})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subject Groups */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                Subject Groups
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2.5 py-2 text-xs text-slate-800 dark:text-white"
              >
                <option value="">Please select</option>
                <option value="Computer Science & AI">Computer Science &amp; AI</option>
                <option value="Data Science">Data Science</option>
                <option value="Engineering">Engineering &amp; Logistics</option>
                <option value="Business & Management">Business &amp; Management</option>
              </select>
            </div>

            {/* Location / Country */}
            <div className="pt-2 border-t border-slate-300/70 dark:border-white/10 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location
              </span>
              <div>
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2.5 py-2 text-xs text-slate-800 dark:text-white"
                >
                  <option value="">All Countries</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Institution
                </label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2.5 py-2 text-xs text-slate-800 dark:text-white"
                >
                  <option value="all">All Institutions</option>
                  {availableUniversities.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tuition & Intake */}
            <div className="pt-2 border-t border-slate-300/70 dark:border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Max Tuition Fees</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
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
                  className="w-full accent-sky-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Beginning / Intake
                </label>
                <select
                  value={selectedIntake}
                  onChange={(e) => setSelectedIntake(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2.5 py-2 text-xs text-slate-800 dark:text-white"
                >
                  <option value="all">Any Intake</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="February">February</option>
                  <option value="July">July</option>
                </select>
              </div>
            </div>

            {/* Student Qualification Filter (Matches Enquiry Form!) */}
            <div className="pt-2 border-t border-slate-300/70 dark:border-white/10 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-400 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> Student Qualification
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    +2 / 12th %
                  </label>
                  <input
                    type="number"
                    value={twelfthPercent}
                    onChange={(e) => setTwelfthPercent(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    Bachelor %
                  </label>
                  <input
                    type="number"
                    value={degreePercent}
                    onChange={(e) => setDegreePercent(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    Backlogs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={backlogs}
                    onChange={(e) => setBacklogs(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    Work Exp (Mo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={workExpMonths}
                    onChange={(e) => setWorkExpMonths(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    IELTS Score
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={ieltsScore}
                    onChange={(e) => setIeltsScore(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    PTE Score
                  </label>
                  <input
                    type="number"
                    value={pteScore}
                    onChange={(e) => setPteScore(Number(e.target.value))}
                    placeholder="e.g. 58"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hasMoi}
                  onChange={(e) => setHasMoi(e.target.checked)}
                  className="accent-sky-700 rounded cursor-pointer"
                />
                <span>MOI (Medium of Instruction)</span>
              </label>
            </div>

            <button
              onClick={resetAll}
              className="w-full py-2 rounded bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </aside>

          {/* RIGHT SIDE RESULTS LIST */}
          <main className="lg:col-span-9 space-y-4">
            {/* Top Results Summary & Sorting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/10">
              <div>
                <h1 className="text-xl font-semibold text-[#0a3154] dark:text-cyan-300">
                  {filteredCourses.length} results for your criteria
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {selectedTypes.map((t) => (
                    <span
                      key={t}
                      onClick={() => toggleType(t)}
                      className="inline-flex items-center gap-1 text-[11px] bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded cursor-pointer"
                    >
                      {t} <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedCountry && (
                    <span
                      onClick={() => setSelectedCountry('')}
                      className="inline-flex items-center gap-1 text-[11px] bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded cursor-pointer"
                    >
                      {selectedCountry} <X className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded px-3 py-1.5 text-xs text-slate-800 dark:text-white"
                >
                  <option value="match">Sort by: Best Match %</option>
                  <option value="tuition_asc">Sort by: Lowest Tuition</option>
                  <option value="salary_desc">Sort by: Highest Avg Salary</option>
                </select>
              </div>
            </div>

            {loading && (
              <div className="py-6 text-center text-xs text-slate-500">
                Syncing live programmes...
              </div>
            )}

            {/* Clean DAAD-Style Result Cards */}
            {filteredCourses.length === 0 ? (
              <div className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/10 rounded-lg p-12 text-center space-y-3">
                <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No programmes match these exact filters
                </h3>
                <button
                  onClick={resetAll}
                  className="bg-sky-700 text-white px-4 py-2 rounded text-xs font-semibold cursor-pointer"
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
                      className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/10 hover:border-sky-500 rounded-lg p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      {/* Title Line (Just like Screenshot 2) */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                        <div>
                          <h2 className="text-sm sm:text-base font-semibold text-[#0d4a82] dark:text-cyan-300 hover:underline">
                            {courseType} • {course.program_name}
                          </h2>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {course.university?.name} • {course.university?.country}
                          </p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold shrink-0 self-start ${
                            score >= 80
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                              : score >= 60
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {score}% Match
                        </span>
                      </div>

                      {/* 2x2 Clean Detail Grid (Just like Screenshot 2) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Language / Policy
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {course.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                              ? 'English (MOI Accepted)'
                              : course.eligibility_rules?.english_requirement_type === 'WAIVED'
                              ? 'English Waived'
                              : `English (IELTS ${course.eligibility_rules?.min_ielts || 6.0})`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Beginning
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {course.intake_months?.join(', ') || 'September'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Duration &amp; Stay Back
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {course.duration_months} mo • {course.stay_back_visa_years}y Visa
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Tuition fees
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {course.tuition_fees_eur === 0
                              ? 'No tuition fees'
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

      {/* COURSE DETAIL MODAL (Next-level detail view on click) */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCourse(null)}
        >
          <div
            className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/15 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300">
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
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Tuition</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Euro className="w-3.5 h-3.5" />
                  {selectedCourse.tuition_fees_eur === 0
                    ? 'Free'
                    : selectedCourse.tuition_fees_eur.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Stay Back</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedCourse.stay_back_visa_years} Years
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Avg Salary</span>
                <span className="text-sm font-bold text-sky-600 dark:text-cyan-400 flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  €{selectedCourse.average_graduate_salary.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Match Fit</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedCourse.matchScore}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
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

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <a
                href={selectedCourse.course_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
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
