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
  ClipboardList,
  Download,
  Bookmark,
  ArrowRight,
  Loader2,
  Wallet
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course, InstitutionalRule } from '@/types/database';
import { calculateMatchScore, isAcademicallyEligible } from '@/lib/match-calculator';
import { COURSE_TYPES, CourseTypeOption, normalizeCourseType, pteToIelts } from '@/lib/course-utils';
import { exportCoursesToExcel } from '@/lib/excel-export';

const LIVING_COST_BY_COUNTRY: Record<string, { amount: string; note: string }> = {
  Germany: { amount: '~€11,208 / yr', note: 'Blocked account (Sperrkonto) requirement' },
  Malta: { amount: '~€8,000 / yr', note: 'Shared accommodation & student living' },
  Ireland: { amount: '~€10,000 / yr', note: 'IRP financial proof benchmark' },
  UK: { amount: '~€13,500 / yr', note: 'Outside London living estimate' },
  France: { amount: '~€9,600 / yr', note: 'CAF housing aid available' },
  Netherlands: { amount: '~€12,000 / yr', note: 'IND living proof benchmark' },
  Spain: { amount: '~€8,400 / yr', note: 'Student visa living estimate' },
  Italy: { amount: '~€8,500 / yr', note: 'Regional scholarships often available' },
  Portugal: { amount: '~€8,000 / yr', note: 'Affordable EU student living' },
};

function getLivingCostGuide(country?: string) {
  if (!country) return { amount: '~€9,000 – €12,000 / yr', note: 'Typical European student budget' };
  const match = Object.keys(LIVING_COST_BY_COUNTRY).find(
    (k) => k.toLowerCase() === country.trim().toLowerCase()
  );
  return match
    ? LIVING_COST_BY_COUNTRY[match]
    : { amount: '~€9,000 – €12,000 / yr', note: `Estimated living cost in ${country}` };
}

function CoursesResultsContent() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<(Course & { matchScore?: number }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

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
    return b ? Number(b) : 100000;
  });
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(() => {
    return Boolean(searchParams.get('degree') || searchParams.get('twelfth'));
  });

  // Sync filters when URL query params change (e.g. clicking "All Programmes" or returning from Home)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    const t = searchParams.get('types');
    setSelectedTypes(t ? (t.split(',') as CourseTypeOption[]) : []);
    setSelectedCountry(searchParams.get('country') || '');
    setSelectedSubject(searchParams.get('subject') || '');
    const b = searchParams.get('budget');
    setMaxTuition(b ? Number(b) : 100000);
    setEligibleOnly(Boolean(searchParams.get('degree') || searchParams.get('twelfth')));
  }, [searchParams]);

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
  const [studentAge, setStudentAge] = useState<number>(() => {
    const v = searchParams.get('age');
    return v ? Number(v) : 22;
  });
  const [studyGap, setStudyGap] = useState<number>(() => {
    const v = searchParams.get('gap');
    return v ? Number(v) : 1;
  });
  const [rules, setRules] = useState<InstitutionalRule[]>([]);
  const [sortBy, setSortBy] = useState<'match' | 'tuition_asc' | 'salary_desc'>('match');

  useEffect(() => {
    try {
      const savedShortlist = localStorage.getItem('student_shortlist_v1');
      if (savedShortlist) {
        const parsed = JSON.parse(savedShortlist);
        if (Array.isArray(parsed)) setShortlistedIds(parsed);
      }
    } catch {
      // Ignore storage errors
    }

    let hasCached = false;
    try {
      const cached = sessionStorage.getItem('globalcourse_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCourses(parsed);
          setLoading(false);
          hasCached = true;
        }
      }
    } catch {
      // Ignore storage errors
    }

    async function loadLiveCoursesAndRules(attempt = 0) {
      try {
        const [coursesRes, rulesRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/rules'),
        ]);
        const data = await coursesRes.json();
        if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          try {
            sessionStorage.setItem('globalcourse_cache_v1', JSON.stringify(data.courses));
          } catch {
            // Ignore quota exceeded
          }
        } else if (!hasCached) {
          setCourses(MOCK_COURSES);
        }
        const rulesData = await rulesRes.json();
        if (rulesData.success && Array.isArray(rulesData.rules)) {
          setRules(rulesData.rules);
        }
      } catch (e) {
        if (attempt < 2) {
          setTimeout(() => loadLiveCoursesAndRules(attempt + 1), 2000);
          return;
        }
        if (!hasCached) {
          setCourses(MOCK_COURSES);
        }
        console.error('Error loading courses:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLiveCoursesAndRules();
  }, []);

  const toggleShortlist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShortlistedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('student_shortlist_v1', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleSelectCourse = async (course: Course & { matchScore?: number }) => {
    setSelectedCourse(course);
    if (!course.raw_excel_data) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/courses?id=${encodeURIComponent(course.id)}`);
        const data = await res.json();
        if (data.success && data.course) {
          setSelectedCourse((prev) =>
            prev && prev.id === course.id
              ? { ...prev, raw_excel_data: data.course.raw_excel_data }
              : prev
          );
        }
      } catch (e) {
        console.error('Error fetching course details:', e);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const handleExportExcel = async () => {
    if (filteredCourses.length === 0 || exportingExcel) return;
    setExportingExcel(true);
    try {
      const needsRaw = filteredCourses.some((c) => !c.raw_excel_data);
      let coursesToExport = filteredCourses;
      if (needsRaw) {
        const res = await fetch('/api/courses?include_raw=true');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
          const rawMap = new Map<string, Record<string, any> | undefined>();
          data.courses.forEach((c: Course) => {
            if (c.raw_excel_data) rawMap.set(c.id, c.raw_excel_data);
          });
          coursesToExport = filteredCourses.map((c) => ({
            ...c,
            raw_excel_data: c.raw_excel_data || rawMap.get(c.id),
          }));
        }
      }
      exportCoursesToExcel(coursesToExport, 'study-abroad-courses', true);
    } catch (e) {
      console.error('Error exporting Excel:', e);
      exportCoursesToExcel(filteredCourses, 'study-abroad-courses', true);
    } finally {
      setExportingExcel(false);
    }
  };

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
    setMaxTuition(100000);
    setEligibleOnly(false);
  };

  const effectiveIelts = useMemo(() => {
    const convertedPte = pteToIelts(pteScore);
    return Math.max(ieltsScore, convertedPte);
  }, [ieltsScore, pteScore]);

  const filteredCourses = useMemo(() => {
    const list = courses
      .map((course) => {
        const courseType = normalizeCourseType(course);
        const matchingRule =
          rules.find((r) => r.scope === 'UNIVERSITY' && r.target_name.toLowerCase() === (course.university?.name || '').toLowerCase()) ||
          rules.find((r) => r.scope === 'COUNTRY' && r.target_name.toLowerCase() === (course.university?.country || '').toLowerCase());

        const effectiveRules = course.eligibility_rules || (matchingRule
          ? {
              id: matchingRule.id,
              course_id: course.id,
              min_12th_percent: matchingRule.just_pass_accepted ? 35 : matchingRule.default_min_12th_percent,
              min_degree_percent: matchingRule.just_pass_accepted ? 35 : matchingRule.default_min_degree_percent,
              min_ielts: matchingRule.default_min_ielts,
              min_toefl: 85,
              interview_required: false,
              work_experience_months: 0,
              english_requirement_type: matchingRule.english_policy,
            }
          : undefined);

        const studentInput = {
          twelfth_percent: twelfthPercent,
          degree_percent: degreePercent,
          ielts_score: effectiveIelts,
          has_moi: hasMoi,
          work_experience_months: workExpMonths,
        };

        let matchScore = calculateMatchScore(effectiveRules, studentInput, courseType);
        const academicallyEligible = isAcademicallyEligible(effectiveRules, studentInput, courseType);

        if (backlogs > 5) matchScore = Math.max(40, matchScore - 15);
        else if (backlogs > 2) matchScore = Math.max(50, matchScore - 5);

        if (matchingRule) {
          if (matchingRule.max_age && studentAge > matchingRule.max_age) {
            matchScore = Math.max(30, matchScore - 25);
          }
          if (matchingRule.min_age && studentAge < matchingRule.min_age) {
            matchScore = Math.max(30, matchScore - 25);
          }
          if (matchingRule.max_gap_years !== undefined && studyGap > matchingRule.max_gap_years) {
            matchScore = Math.max(35, matchScore - 20);
          }
        }

        return { ...course, matchScore, academicallyEligible };
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

        if (maxTuition < 100000 && course.tuition_fees_eur > maxTuition) {
          return false;
        }

        if (eligibleOnly && (!course.academicallyEligible || (course.matchScore ?? 0) < 75)) {
          return false;
        }

        if (showShortlistedOnly && !shortlistedIds.includes(course.id)) {
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
    studentAge,
    studyGap,
    rules,
    eligibleOnly,
    showShortlistedOnly,
    shortlistedIds,
    sortBy,
  ]);

  useEffect(() => {
    setVisibleCount(30);
  }, [
    searchQuery,
    selectedTypes,
    selectedCountry,
    selectedUniversity,
    selectedSubject,
    selectedIntake,
    maxTuition,
    eligibleOnly,
    showShortlistedOnly,
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
          <aside className="lg:col-span-3 glass-panel rounded-2xl p-5 space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
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
                    {maxTuition >= 100000 ? 'Any Budget' : `€${maxTuition.toLocaleString()}`}
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="2000"
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
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="April">April</option>
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
                    onChange={(e) => {
                      setTwelfthPercent(Number(e.target.value));
                      setEligibleOnly(true);
                    }}
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
                    onChange={(e) => {
                      setDegreePercent(Number(e.target.value));
                      setEligibleOnly(true);
                    }}
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
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="16"
                    value={studentAge}
                    onChange={(e) => setStudentAge(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Study Gap (Yrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={studyGap}
                    onChange={(e) => setStudyGap(Number(e.target.value))}
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

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <input
                  type="checkbox"
                  checked={eligibleOnly}
                  onChange={(e) => setEligibleOnly(e.target.checked)}
                  className="accent-emerald-600 rounded cursor-pointer"
                />
                <span>Show Eligible Only (≥ 75% Match)</span>
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

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setShowShortlistedOnly((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                    showShortlistedOnly
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/15 hover:border-amber-500/40'
                  }`}
                  title="Filter to programmes you bookmarked"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${showShortlistedOnly ? 'fill-current' : ''}`} />
                  Shortlisted ({shortlistedIds.length})
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={filteredCourses.length === 0 || exportingExcel}
                  className="neon-btn-emerald px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Download displayed courses in Excel (.xlsx) format"
                >
                  {exportingExcel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {exportingExcel ? 'Preparing Excel...' : 'Download Excel (.xlsx)'}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  <option value="match">Sort by: Best Match %</option>
                  <option value="tuition_asc">Sort by: Lowest Tuition</option>
                  <option value="salary_desc">Sort by: Highest Avg Salary</option>
                </select>
              </div>
            </div>

            {loading && courses.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="glass-card rounded-2xl p-5 animate-pulse space-y-3"
                  >
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200/60 dark:border-white/10">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-20 rounded-full bg-slate-200 dark:bg-white/10" />
                          <div className="h-3 w-40 rounded bg-slate-200 dark:bg-white/10" />
                        </div>
                        <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                      </div>
                      <div className="h-7 w-24 rounded-full bg-slate-200 dark:bg-white/10" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                      <div className="h-8 rounded bg-slate-200 dark:bg-white/10" />
                      <div className="h-8 rounded bg-slate-200 dark:bg-white/10" />
                      <div className="h-8 rounded bg-slate-200 dark:bg-white/10" />
                      <div className="h-8 rounded bg-slate-200 dark:bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center space-y-3">
                <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {showShortlistedOnly
                    ? 'No shortlisted programmes yet'
                    : 'No programmes match these exact filters'}
                </h3>
                <button
                  onClick={() => {
                    setShowShortlistedOnly(false);
                    resetAll();
                  }}
                  className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {showShortlistedOnly ? 'Show All Programmes' : 'Clear All Filters'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCourses.slice(0, visibleCount).map((course) => {
                  const score = course.matchScore ?? 85;
                  const courseType = normalizeCourseType(course);
                  const isShortlisted = shortlistedIds.includes(course.id);

                  return (
                    <div
                      key={course.id}
                      onClick={() => handleSelectCourse(course)}
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

                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            onClick={(e) => toggleShortlist(course.id, e)}
                            className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                              isShortlisted
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-amber-500 border-slate-200 dark:border-white/10'
                            }`}
                            title={isShortlisted ? 'Remove from Shortlist' : 'Shortlist Programme'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isShortlisted ? 'fill-current' : ''}`} />
                          </button>
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
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

                {filteredCourses.length > visibleCount && (
                  <div className="pt-3 flex justify-center">
                    <button
                      onClick={() => setVisibleCount((prev) => prev + 30)}
                      className="px-6 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 hover:border-cyan-500 text-xs font-bold text-slate-800 dark:text-white cursor-pointer transition-colors"
                    >
                      Load More Programmes ({filteredCourses.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
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
            className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/15 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5"
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

            {(() => {
              const livingGuide = getLivingCostGuide(selectedCourse.university?.country);
              return (
                <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Wallet className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        Estimated Annual Living Cost ({selectedCourse.university?.country || 'Abroad'})
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">{livingGuide.note}</p>
                    </div>
                  </div>
                  <span className="font-bold text-cyan-700 dark:text-cyan-300 shrink-0">
                    {livingGuide.amount}
                  </span>
                </div>
              );
            })()}

            {loadingDetail && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                Loading full uploaded sheet details...
              </div>
            )}

            {selectedCourse.raw_excel_data && Object.keys(selectedCourse.raw_excel_data).length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Uploaded Sheet Details (Exact Headings)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  {Object.entries(selectedCourse.raw_excel_data).map(([key, val]) =>
                    val !== undefined && val !== '' ? (
                      <div key={key} className="bg-white dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/70 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">{key}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 break-words">{String(val)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <button
                onClick={() => exportCoursesToExcel([selectedCourse], 'course-details', true)}
                className="neon-btn-emerald px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel
              </button>
              <Link
                href={`/enquiry?course=${encodeURIComponent(selectedCourse.program_name)}&country=${encodeURIComponent(selectedCourse.university?.country || '')}`}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                Apply / Free Counseling <ArrowRight className="w-3.5 h-3.5" />
              </Link>
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
