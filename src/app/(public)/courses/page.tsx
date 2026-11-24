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
  Wallet,
  Scale,
  Award,
  FileCheck2,
  Sparkles,
  ChevronDown,
  Share2,
  Check
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course, InstitutionalRule } from '@/types/database';
import { calculateMatchScore, isAcademicallyEligible } from '@/lib/match-calculator';
import { COURSE_TYPES, CourseTypeOption, normalizeCourseType, pteToIelts } from '@/lib/course-utils';
import { exportCoursesToExcel } from '@/lib/excel-export';
import {
  CurrencyCode,
  formatCurrencyAmount,
  getLivingCostGuide,
  getCountryChecklist,
  getScholarshipInfo,
  hasBuiltInCountryGuide,
  resolveCourseUrl,
  getEndToEndJourney,
} from '@/lib/student-guides';
import { formatStayBack } from '@/lib/country-visa-intel';
import { matchesSmartSearch } from '@/lib/search-synonyms';

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
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');
  const [scholarshipsOnly, setScholarshipsOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [metaCountries, setMetaCountries] = useState<string[]>([]);
  const [metaUniversities, setMetaUniversities] = useState<{ id: string; name: string; country: string }[]>([]);
  const [serverPage, setServerPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newsUpdates, setNewsUpdates] = useState<{ country: string; title: string; summary: string; tag: string }[]>([]);
  const [showNewsPanel, setShowNewsPanel] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [modalJourneyTab, setModalJourneyTab] = useState<'roadmap' | 'admission' | 'visa'>('roadmap');
  const [checkingAiCourse, setCheckingAiCourse] = useState(false);
  const [discoveringAi, setDiscoveringAi] = useState(false);
  const [lastAiDiscoverKey, setLastAiDiscoverKey] = useState('');
  const [aiDiscoverError, setAiDiscoverError] = useState<string | null>(null);
  const [aiCourseCheckResult, setAiCourseCheckResult] = useState<{
    courseId: string;
    subjectRequirements?: string;
    summary?: string;
    sources?: { title: string; uri: string }[];
    error?: string;
  } | null>(null);
  const [countryIntelCache, setCountryIntelCache] = useState<
    Record<
      string,
      {
        showMoneyEur: number;
        showMoneyNote: string;
        deadlineWindow: string;
        docs: string[];
        stayBackYears: number;
        visaSummary: string;
      }
    >
  >({});

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
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const buildServerQueryParams = (pageNum: number) => {
    const params = new URLSearchParams();
    params.set('paginated', 'true');
    params.set('page', String(pageNum));
    params.set('limit', '120');
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedUniversity !== 'all') params.set('university', selectedUniversity);
    if (selectedSubject) params.set('subject', selectedSubject);
    if (selectedIntake !== 'all') params.set('intake', selectedIntake);
    if (maxTuition < 100000) params.set('maxTuition', String(maxTuition));
    if (showShortlistedOnly) params.set('ids', shortlistedIds.join(','));
    if (sortBy === 'tuition_asc' || sortBy === 'salary_desc') params.set('sort', sortBy);
    return params.toString();
  };

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

    async function loadMetaAndRules() {
      try {
        const [metaRes, rulesRes, newsRes] = await Promise.all([
          fetch('/api/courses?meta=true'),
          fetch('/api/rules'),
          fetch('/api/study-abroad-news'),
        ]);
        const metaData = await metaRes.json();
        if (metaData.success) {
          if (Array.isArray(metaData.countries)) setMetaCountries(metaData.countries);
          if (Array.isArray(metaData.universities)) setMetaUniversities(metaData.universities);
        }
        const rulesData = await rulesRes.json();
        if (rulesData.success && Array.isArray(rulesData.rules)) {
          setRules(rulesData.rules);
        }
        const newsData = await newsRes.json();
        if (newsData.success && Array.isArray(newsData.updates)) {
          setNewsUpdates(newsData.updates);
        }
      } catch (e) {
        console.error('Error loading metadata/rules:', e);
      }
    }
    loadMetaAndRules();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCoursesPage(attempt = 0) {
      if (attempt === 0) setLoading(true);
      try {
        const res = await fetch(`/api/courses?${buildServerQueryParams(1)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && Array.isArray(data.courses)) {
          setCourses(data.courses);
          setServerTotal(data.total ?? data.courses.length);
          setServerPage(1);
          setServerHasMore(Boolean(data.hasMore));
        } else {
          setCourses(MOCK_COURSES);
          setServerTotal(MOCK_COURSES.length);
          setServerHasMore(false);
        }
      } catch (e) {
        if (attempt < 2 && !cancelled) {
          setTimeout(() => loadCoursesPage(attempt + 1), 2000);
          return;
        }
        if (!cancelled) {
          setCourses(MOCK_COURSES);
          setServerTotal(MOCK_COURSES.length);
          setServerHasMore(false);
        }
        console.error('Error loading courses:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCoursesPage();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    selectedTypes,
    selectedCountry,
    selectedUniversity,
    selectedSubject,
    selectedIntake,
    maxTuition,
    showShortlistedOnly,
    shortlistedIds,
    sortBy,
  ]);

  const handleLoadMore = async () => {
    if (filteredCourses.length > visibleCount) {
      setVisibleCount((prev) => prev + 30);
      return;
    }
    if (!serverHasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = serverPage + 1;
      const res = await fetch(`/api/courses?${buildServerQueryParams(nextPage)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.courses)) {
        setCourses((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const uniqueNew = data.courses.filter((c: Course) => !seen.has(c.id));
          return [...prev, ...uniqueNew];
        });
        setServerPage(nextPage);
        setServerHasMore(Boolean(data.hasMore));
        setVisibleCount((prev) => prev + 30);
      }
    } catch (e) {
      console.error('Error loading more courses:', e);
    } finally {
      setLoadingMore(false);
    }
  };

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

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const handleSelectCourse = async (course: Course & { matchScore?: number }) => {
    setSelectedCourse(course);
    setAiCourseCheckResult(null);
    const ctry = course.university?.country || '';
    const deg = normalizeCourseType(course);
    const cacheKey = `${ctry}::${deg}`;

    if (ctry && !hasBuiltInCountryGuide(ctry) && !countryIntelCache[cacheKey]) {
      fetch(`/api/country-intel?country=${encodeURIComponent(ctry)}&degree=${encodeURIComponent(deg)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setCountryIntelCache((prev) => ({ ...prev, [cacheKey]: d }));
          }
        })
        .catch(() => {});
    }

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

  const handleAiVerifyCourse = async () => {
    if (!selectedCourse || checkingAiCourse) return;
    setCheckingAiCourse(true);
    setAiCourseCheckResult(null);
    try {
      const res = await fetch('/api/ai-course-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          programName: selectedCourse.program_name,
          universityName: selectedCourse.university?.name || '',
          country: selectedCourse.university?.country || '',
          degreeLevel: normalizeCourseType(selectedCourse),
          courseUrl: selectedCourse.course_url,
          saveToDb: true,
        }),
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        setAiCourseCheckResult({
          courseId: selectedCourse.id,
          error: json.error || 'Could not verify live requirements right now.',
        });
        return;
      }
      const d = json.data;
      const updatedPatch = (c: Course): Course => ({
        ...c,
        tuition_fees_eur: d.tuitionFeesEur || c.tuition_fees_eur,
        intake_months: d.intakes?.length ? d.intakes : c.intake_months,
        course_url: d.officialUrl || c.course_url,
        eligibility_rules: {
          id: c.eligibility_rules?.id || '',
          course_id: c.id,
          min_12th_percent: d.min12thPercent,
          min_degree_percent: d.minDegreePercent,
          min_ielts: d.minIelts,
          min_toefl: c.eligibility_rules?.min_toefl ?? 85,
          interview_required: c.eligibility_rules?.interview_required ?? false,
          work_experience_months: c.eligibility_rules?.work_experience_months ?? 0,
          english_requirement_type: d.englishPolicy,
        },
      });
      setSelectedCourse((prev) => (prev ? { ...updatedPatch(prev), matchScore: prev.matchScore } : prev));
      setCourses((prev) => prev.map((c) => (c.id === selectedCourse.id ? updatedPatch(c) : c)));
      setAiCourseCheckResult({
        courseId: selectedCourse.id,
        subjectRequirements: d.subjectRequirements,
        summary: d.summary,
        sources: d.sources,
      });
    } catch (e: any) {
      setAiCourseCheckResult({
        courseId: selectedCourse.id,
        error: e?.message || 'Network error during AI verification.',
      });
    } finally {
      setCheckingAiCourse(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredCourses.length === 0 || exportingExcel) return;
    setExportingExcel(true);
    try {
      const needsRaw = filteredCourses.some((c) => !c.raw_excel_data);
      let coursesToExport = filteredCourses;
      if (needsRaw) {
        const idsToFetch = filteredCourses.slice(0, 500).map((c) => c.id).join(',');
        const res = await fetch(`/api/courses?include_raw=true&ids=${encodeURIComponent(idsToFetch)}`);
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

  const handleAiDiscoverCourses = async () => {
    const targetCountry = selectedCountry.trim();
    const targetQuery = searchQuery.trim();
    if (!targetCountry && !targetQuery) return;

    const discoverKey = `${targetCountry}::${targetQuery}::${selectedTypes.join(',')}`;
    setLastAiDiscoverKey(discoverKey);
    setDiscoveringAi(true);
    setAiDiscoverError(null);
    try {
      const res = await fetch('/api/ai-discover-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: targetCountry,
          query: targetQuery,
          courseTypes: selectedTypes,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
        setCourses(data.courses);
        setServerTotal(data.courses.length);
        setServerHasMore(false);
      } else {
        setAiDiscoverError(data.error || 'No programmes found via AI discovery.');
      }
    } catch (e: any) {
      setAiDiscoverError(e?.message || 'AI discovery error');
    } finally {
      setDiscoveringAi(false);
    }
  };

  useEffect(() => {
    if (loading || discoveringAi || showShortlistedOnly) return;
    if (courses.length === 0 && (selectedCountry || debouncedSearch.trim())) {
      const discoverKey = `${selectedCountry.trim()}::${debouncedSearch.trim()}::${selectedTypes.join(',')}`;
      if (discoverKey !== lastAiDiscoverKey) {
        handleAiDiscoverCourses();
      }
    }
  }, [loading, courses.length, selectedCountry, debouncedSearch, selectedTypes, showShortlistedOnly]);

  const availableCountries = useMemo(() => {
    const globalList = [
      'Poland',
      'Canada',
      'USA',
      'Ireland',
      'France',
      'Italy',
      'Denmark',
      'Finland',
      'Spain',
      'New Zealand',
      'Norway',
    ];
    const set = new Set<string>([...metaCountries, ...globalList]);
    courses.forEach((c) => {
      if (c.university?.country) set.add(c.university.country);
    });
    return Array.from(set).sort();
  }, [metaCountries, courses]);

  const availableUniversities = useMemo(() => {
    if (metaUniversities.length > 0) {
      return metaUniversities
        .filter((u) => !selectedCountry || u.country === selectedCountry)
        .map((u) => [u.id, `${u.name} (${u.country})`] as [string, string]);
    }
    const map = new Map<string, string>();
    courses.forEach((c) => {
      if (c.university) map.set(c.university.id, `${c.university.name} (${c.university.country})`);
    });
    return Array.from(map.entries());
  }, [metaUniversities, selectedCountry, courses]);

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
        if (searchQuery && !matchesSmartSearch(course, searchQuery)) {
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

        if (scholarshipsOnly && !getScholarshipInfo(course).hasScholarship) {
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
    scholarshipsOnly,
    shortlistedIds,
    sortBy,
  ]);

  const compareCourses = useMemo(() => {
    return compareIds
      .map((id) => filteredCourses.find((c) => c.id === id) || courses.find((c) => c.id === id))
      .filter((c): c is Course & { matchScore?: number } => Boolean(c));
  }, [compareIds, filteredCourses, courses]);

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
    scholarshipsOnly,
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
                    {maxTuition >= 100000 ? 'Any Budget' : formatCurrencyAmount(maxTuition, currency)}
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

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <input
                  type="checkbox"
                  checked={scholarshipsOnly}
                  onChange={(e) => setScholarshipsOnly(e.target.checked)}
                  className="accent-amber-500 rounded cursor-pointer"
                />
                <span>Scholarships / Tuition-Free Only</span>
              </label>
            </div>
          </aside>

          {/* RIGHT SIDE RESULTS LIST */}
          <main className="lg:col-span-9 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {serverTotal > filteredCourses.length && !eligibleOnly && !scholarshipsOnly && selectedTypes.length === 0
                    ? `${serverTotal.toLocaleString()} programmes found`
                    : `${filteredCourses.length.toLocaleString()} programmes shown${serverHasMore ? ` (of ${serverTotal.toLocaleString()} total)` : ''}`}
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
                <div className="inline-flex rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 p-0.5 text-xs font-bold">
                  <button
                    onClick={() => setCurrency('EUR')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      currency === 'EUR'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    € EUR
                  </button>
                  <button
                    onClick={() => setCurrency('INR')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      currency === 'INR'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ₹ INR
                  </button>
                </div>
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

            {newsUpdates.length > 0 && (() => {
              const relevantNews = selectedCountry
                ? newsUpdates.filter((n) => n.country.toLowerCase() === selectedCountry.toLowerCase())
                : newsUpdates;
              const listToShow = relevantNews.length > 0 ? relevantNews : newsUpdates;
              return (
                <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 px-4 py-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowNewsPanel((p) => !p)}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-bold text-indigo-800 dark:text-indigo-200 shrink-0">
                        2026 Visa &amp; Policy Updates:
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 truncate">
                        {listToShow[0].country} — {listToShow[0].title}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-indigo-500 shrink-0 transition-transform ${
                        showNewsPanel ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {showNewsPanel && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 mt-2.5 border-t border-indigo-500/15">
                      {listToShow.map((item, idx) => (
                        <div
                          key={`${item.country}-${idx}`}
                          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-white/10"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-slate-900 dark:text-white">{item.country}: {item.title}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shrink-0">
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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
            ) : discoveringAi ? (
              <div className="glass-card rounded-2xl p-12 text-center space-y-3">
                <Sparkles className="w-10 h-10 text-indigo-500 mx-auto animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Searching {selectedCountry || searchQuery} universities &amp; courses with AI...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCountry || 'This destination'} is not in your uploaded sheets yet — fetching accredited universities, tuition fees, and entry rules.
                </p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center space-y-3">
                <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {showShortlistedOnly
                    ? 'No shortlisted programmes yet'
                    : 'No uploaded programmes match these exact filters'}
                </h3>
                {aiDiscoverError && (
                  <p className="text-xs text-rose-500">{aiDiscoverError}</p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {!showShortlistedOnly && (selectedCountry || searchQuery.trim()) && (
                    <button
                      onClick={handleAiDiscoverCourses}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Search {selectedCountry || searchQuery} Universities with AI
                    </button>
                  )}
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
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCourses.slice(0, visibleCount).map((course) => {
                  const score = course.matchScore ?? 85;
                  const courseType = normalizeCourseType(course);
                  const isShortlisted = shortlistedIds.includes(course.id);
                  const isCompared = compareIds.includes(course.id);
                  const scholarship = getScholarshipInfo(course);

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
                            {(course as any).is_ai_discovered && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                                <Sparkles className="w-2.5 h-2.5" />
                                AI Global Discovery
                              </span>
                            )}
                            {scholarship.hasScholarship && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                <Award className="w-3 h-3" />
                                {scholarship.badge}
                              </span>
                            )}
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
                            onClick={(e) => toggleCompare(course.id, e)}
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isCompared
                                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-cyan-600 border-slate-200 dark:border-white/10'
                            }`}
                            title={isCompared ? 'Remove from comparison' : 'Select to compare (up to 3)'}
                          >
                            <Scale className="w-3 h-3" />
                            {isCompared ? 'Selected' : 'Compare'}
                          </button>
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
                            {course.duration_months} mo • {formatStayBack(course.stay_back_visa_years)} Stay Back
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Tuition Fees
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyAmount(course.tuition_fees_eur, currency, true)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(filteredCourses.length > visibleCount || serverHasMore) && (
                  <div className="pt-3 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 hover:border-cyan-500 text-xs font-bold text-slate-800 dark:text-white cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {loadingMore
                        ? 'Loading more programmes...'
                        : `Load More Programmes (${Math.max(0, (serverHasMore ? serverTotal : filteredCourses.length) - Math.min(visibleCount, filteredCourses.length)).toLocaleString()} remaining)`}
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
                  {formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Stay Back</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatStayBack(selectedCourse.stay_back_visa_years)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Avg Salary</span>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  {formatCurrencyAmount(selectedCourse.average_graduate_salary, currency)}
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

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-slate-900 dark:text-white">Admission &amp; Eligibility Criteria</h4>
                <button
                  type="button"
                  onClick={handleAiVerifyCourse}
                  disabled={checkingAiCourse}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Check live university website via AI & update this course"
                >
                  <Sparkles className={`w-3 h-3 ${checkingAiCourse ? 'animate-spin' : ''}`} />
                  {checkingAiCourse ? 'Checking Live Website...' : 'Verify Live Criteria (AI Web Check)'}
                </button>
              </div>
              {aiCourseCheckResult && aiCourseCheckResult.courseId === selectedCourse.id && (
                <div
                  className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                    aiCourseCheckResult.error
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
                      : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-800 dark:text-indigo-200'
                  }`}
                >
                  {aiCourseCheckResult.error ? (
                    <span>{aiCourseCheckResult.error}</span>
                  ) : (
                    <>
                      <p className="font-semibold">{aiCourseCheckResult.summary}</p>
                      {aiCourseCheckResult.subjectRequirements && (
                        <p className="text-slate-600 dark:text-slate-300">
                          <strong>Specific Requirements:</strong> {aiCourseCheckResult.subjectRequirements}
                        </p>
                      )}
                      {aiCourseCheckResult.sources && aiCourseCheckResult.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Sources:</span>
                          {aiCourseCheckResult.sources.map((s, idx) => (
                            <a
                              key={idx}
                              href={s.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-cyan-600 dark:text-cyan-400 truncate max-w-[180px]"
                            >
                              {s.title || s.uri}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
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
              {(() => {
                const cType = normalizeCourseType(selectedCourse);
                const isPG = cType === 'Masters' || cType === 'PG Diploma' || cType === 'PG Certificate';
                const reqPct = isPG
                  ? selectedCourse.eligibility_rules?.min_degree_percent || 50
                  : selectedCourse.eligibility_rules?.min_12th_percent || 50;
                const studentPct = isPG ? degreePercent : twelfthPercent;
                const acadOk = studentPct >= reqPct;
                const engType = selectedCourse.eligibility_rules?.english_requirement_type || 'MOI_ACCEPTED';
                const reqIelts = selectedCourse.eligibility_rules?.min_ielts || 6.0;
                const engOk =
                  engType === 'WAIVED' ||
                  engType === 'NO_REQUIREMENT' ||
                  (engType === 'MOI_ACCEPTED' && hasMoi) ||
                  effectiveIelts >= reqIelts;

                return (
                  <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        acadOk
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {isPG ? 'Bachelor' : '+2 / 12th'}: {studentPct}% vs Min {reqPct}% {acadOk ? '✓' : '✗'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        engOk
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      Language: {engType === 'MOI_ACCEPTED' && hasMoi ? 'MOI Accepted ✓' : `${effectiveIelts} vs Min ${reqIelts} ${engOk ? '✓' : '✗'}`}
                    </span>
                  </div>
                );
              })()}
            </div>

            {(() => {
              const ctry = selectedCourse.university?.country || '';
              const deg = normalizeCourseType(selectedCourse);
              const aiIntel = countryIntelCache[`${ctry}::${deg}`];
              const livingGuide = aiIntel
                ? { amountEur: aiIntel.showMoneyEur, note: aiIntel.showMoneyNote }
                : getLivingCostGuide(ctry);
              const scholarship = getScholarshipInfo(selectedCourse);
              const checklist = aiIntel
                ? { deadlineWindow: aiIntel.deadlineWindow, docs: aiIntel.docs }
                : getCountryChecklist(ctry);
              const isPostgrad =
                deg === 'Masters' || deg === 'PG Diploma' || deg === 'PG Certificate';
              const journey = getEndToEndJourney(ctry, isPostgrad);
              const totalYear1Eur = (selectedCourse.tuition_fees_eur || 0) + (livingGuide.amountEur || 0);
              return (
                <>
                  <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Wallet className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">
                            Show Money &amp; Parent Year-1 Total Budget ({ctry || 'Abroad'})
                          </h4>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">{livingGuide.note}</p>
                        </div>
                      </div>
                      <span className="font-bold text-cyan-700 dark:text-cyan-300 shrink-0">
                        ~{formatCurrencyAmount(livingGuide.amountEur, currency)} / yr
                      </span>
                    </div>
                    <div className="pt-2 border-t border-cyan-500/15 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300">
                        Tuition ({formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true)}) + Show Money (~{formatCurrencyAmount(livingGuide.amountEur, currency)})
                      </span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300">
                        Total Year 1: ~{formatCurrencyAmount(totalYear1Eur, currency)}
                      </span>
                    </div>
                  </div>

                  {scholarship.hasScholarship && (
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/25 flex items-start gap-2.5 text-xs">
                      <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          Scholarship &amp; Funding Opportunity — {scholarship.badge}
                        </h4>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">{scholarship.detail}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          End-to-End Application &amp; Visa Guide ({ctry || 'International'})
                        </h4>
                      </div>
                      <div className="inline-flex rounded-xl border border-emerald-500/25 bg-white/80 dark:bg-slate-900 p-0.5 text-[11px] font-bold self-start">
                        {[
                          { id: 'roadmap' as const, label: '6-Step Process' },
                          { id: 'admission' as const, label: `Admission Docs (${journey.admissionDocs.length})` },
                          { id: 'visa' as const, label: `Visa Docs (${journey.visaDocs.length})` },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setModalJourneyTab(tab.id)}
                            className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                              modalJourneyTab === tab.id
                                ? 'bg-emerald-500 text-slate-950'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      Target Intake Window: {checklist.deadlineWindow}
                    </p>

                    {modalJourneyTab === 'roadmap' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {journey.steps.map((s) => (
                          <div
                            key={s.step}
                            className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-emerald-500/15"
                          >
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 block">
                              STEP {s.step}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white block">{s.title}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{s.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {modalJourneyTab === 'admission' && (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600 dark:text-slate-300 pt-1">
                        {journey.admissionDocs.map((doc) => {
                          const key = `adm::${doc}`;
                          const checked = Boolean(checkedDocs[key]);
                          return (
                            <li key={doc}>
                              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCheckedDocs((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                  className="accent-emerald-600 mt-0.5 rounded cursor-pointer"
                                />
                                <span className={checked ? 'line-through text-slate-400' : ''}>{doc}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {modalJourneyTab === 'visa' && (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600 dark:text-slate-300 pt-1">
                        {(aiIntel?.docs?.length ? aiIntel.docs : journey.visaDocs).map((doc) => {
                          const key = `visa::${doc}`;
                          const checked = Boolean(checkedDocs[key]);
                          return (
                            <li key={doc}>
                              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCheckedDocs((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                  className="accent-emerald-600 mt-0.5 rounded cursor-pointer"
                                />
                                <span className={checked ? 'line-through text-slate-400' : ''}>{doc}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
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
                onClick={() => {
                  const linkInfo = resolveCourseUrl(selectedCourse);
                  const living = getLivingCostGuide(selectedCourse.university?.country);
                  const text = `${selectedCourse.program_name}\nUniversity: ${selectedCourse.university?.name} (${selectedCourse.university?.country})\nTuition: ${formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true)}\nShow Money/Living: ~${formatCurrencyAmount(living.amountEur, currency)}/yr\nStay Back: ${formatStayBack(selectedCourse.stay_back_visa_years)}\nMatch Fit: ${selectedCourse.matchScore}%\nOfficial Link: ${linkInfo.url}`;
                  navigator.clipboard?.writeText(text);
                  setCopiedSummary(true);
                  setTimeout(() => setCopiedSummary(false), 2500);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                title="Copy course summary for WhatsApp / Parents / Counselor"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                {copiedSummary ? 'Copied Summary!' : 'Share Summary'}
              </button>
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
              {(() => {
                const linkInfo = resolveCourseUrl(selectedCourse);
                return (
                  <a
                    href={linkInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    {linkInfo.isDirect ? 'Visit Official Course Page' : 'Find Official Course Page'}{' '}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING COMPARISON BAR */}
      {compareCourses.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-3xl bg-slate-900/95 dark:bg-[#0b101b]/95 text-white border border-cyan-500/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-bold">{compareCourses.length}/3 selected to compare</span>
            <span className="hidden sm:inline text-slate-400">
              ({compareCourses.map((c) => c.university?.name || c.program_name).join(' vs ')})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareIds([])}
              className="px-3 py-1.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={() => setShowCompareModal(true)}
              disabled={compareCourses.length < 2}
              className="neon-btn-cyan px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Compare Side-by-Side ({compareCourses.length})
            </button>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE COMPARISON MODAL */}
      {showCompareModal && compareCourses.length >= 2 && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            className="bg-white dark:bg-[#0f1420] border border-slate-200 dark:border-white/15 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Side-by-Side Programme Comparison
                </h2>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[10px] w-36">
                      Criteria
                    </th>
                    {compareCourses.map((c) => (
                      <th key={c.id} className="py-3 px-3 min-w-[200px] align-top">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                          {normalizeCourseType(c)}
                        </span>
                        <div className="font-bold text-sm text-slate-900 dark:text-white mt-1.5">
                          {c.program_name}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.university?.name} • {c.university?.country}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Match Fit</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {c.matchScore ?? 85}% Match
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Tuition Fees</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyAmount(c.tuition_fees_eur, currency, true)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Est. Living Cost</td>
                    {compareCourses.map((c) => {
                      const living = getLivingCostGuide(c.university?.country);
                      return (
                        <td key={c.id} className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                          <span className="font-semibold">~{formatCurrencyAmount(living.amountEur, currency)} / yr</span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Language Policy</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                        {c.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                          ? 'MOI Accepted'
                          : c.eligibility_rules?.english_requirement_type === 'WAIVED'
                          ? 'English Waived'
                          : `IELTS ${c.eligibility_rules?.min_ielts || 6.0}`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Min Academics</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                        12th: {c.eligibility_rules?.min_12th_percent || 50}% • Degree: {c.eligibility_rules?.min_degree_percent || 50}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Intakes</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                        {c.intake_months?.join(', ') || 'September'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Duration &amp; Stay Back</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 text-purple-600 dark:text-purple-300 font-semibold">
                        {c.duration_months} mo • {formatStayBack(c.stay_back_visa_years)} Stay Back
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Avg Grad Salary</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400 font-bold">
                        {formatCurrencyAmount(c.average_graduate_salary, currency)} / yr
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400">Scholarships</td>
                    {compareCourses.map((c) => {
                      const s = getScholarshipInfo(c);
                      return (
                        <td key={c.id} className="py-2.5 px-3 text-amber-700 dark:text-amber-300 font-medium">
                          {s.hasScholarship ? s.badge : 'Check University'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-500 dark:text-slate-400">Action</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3">
                        <Link
                          href={`/enquiry?course=${encodeURIComponent(c.program_name)}&country=${encodeURIComponent(c.university?.country || '')}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                        >
                          Apply Now <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
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
