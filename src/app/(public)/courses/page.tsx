'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  MapPin,
  GraduationCap,
  Clock,
  ExternalLink,
  ShieldCheck,
  X,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Briefcase,
  Calendar,
  SlidersHorizontal,
  Download,
  Bookmark,
  ArrowRight,
  Loader2,
  Wallet,
  Scale,
  Award,
  FileCheck2,
  Info,
  Globe,
  Database,
  ChevronDown,
  Share2,
  Check,
  Star,
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
import { mergeCountryLists, normalizeCountryName } from '@/lib/countries';
import {
  classifyUniversityType,
  getPriorityUniversityMatch,
  matchesSubjectGroup,
  PriorityUniversityRule,
  SectorFilter,
  SUBJECT_GROUPS,
  UniversitySector,
} from '@/lib/university-classification';
import PublicLeadGate, { loadSavedLeadProfile } from '@/components/public-lead-gate';
import { setStaffAnalyticsBypass, trackAnalyticsEvent } from '@/lib/analytics-tracker';

function CoursesResultsContent() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<
    (Course & { matchScore?: number; sector?: UniversitySector; isPriority?: boolean; priorityNote?: string }) | null
  >(null);
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
  const [priorityUniversities, setPriorityUniversities] = useState<PriorityUniversityRule[]>([]);
  const [serverPage, setServerPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreAi, setLoadingMoreAi] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [newsUpdates, setNewsUpdates] = useState<{ country: string; title: string; summary: string; tag: string }[]>([]);
  const [showNewsPanel, setShowNewsPanel] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [modalJourneyTab, setModalJourneyTab] = useState<'roadmap' | 'admission' | 'visa'>('roadmap');
  const [checkingAiCourse, setCheckingAiCourse] = useState(false);
  const [discoveringAi, setDiscoveringAi] = useState(false);
  const [lastAiDiscoverKey, setLastAiDiscoverKey] = useState('');
  const [aiDiscoverError, setAiDiscoverError] = useState<string | null>(null);
  const [loadingTipIdx, setLoadingTipIdx] = useState(0);
  const [savingAiCourse, setSavingAiCourse] = useState(false);
  const [savedAiCourseIds, setSavedAiCourseIds] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [hasRegisteredLead, setHasRegisteredLead] = useState(false);
  const [showLeadGate, setShowLeadGate] = useState(false);
  const [leadGateHard, setLeadGateHard] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: 'course'; course: Course & { matchScore?: number } }
    | { type: 'export' }
    | { type: 'compare' }
    | null
  >(null);
  const lastTrackedSearchRef = useRef('');

  useEffect(() => {
    setHasRegisteredLead(Boolean(loadSavedLeadProfile()));
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const staffOk = Boolean(d?.isStaff || d?.authenticated);
        const adminOk = Boolean(d?.isAdmin);
        setStaffAnalyticsBypass(staffOk);
        setIsStaff(staffOk);
        setIsAdmin(adminOk);
        setStaffName(String(d?.user?.name || ''));
      })
      .catch(() => {})
      .finally(() => setAdminAuthChecked(true));
  }, []);

  // Gentle auto-prompt for public visitors after 6s (once per browser session)
  useEffect(() => {
    if (!adminAuthChecked || isStaff || hasRegisteredLead || loading) return;
    try {
      if (sessionStorage.getItem('gc_gate_prompted')) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (sessionStorage.getItem('gc_gate_prompted')) return;
        sessionStorage.setItem('gc_gate_prompted', '1');
      } catch {
        // Ignore storage errors
      }
      setLeadGateHard(false);
      setShowLeadGate(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [adminAuthChecked, isStaff, hasRegisteredLead, loading]);

  useEffect(() => {
    if (!discoveringAi) return;
    const interval = setInterval(() => {
      setLoadingTipIdx((prev) => (prev + 1) % 4);
    }, 1800);
    return () => clearInterval(interval);
  }, [discoveringAi]);
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
  const [selectedSector, setSelectedSector] = useState<SectorFilter>(() => {
    const s = searchParams.get('sector');
    return s === 'Public' || s === 'Private' ? s : 'all';
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
    const s = searchParams.get('sector');
    setSelectedSector(s === 'Public' || s === 'Private' ? s : 'all');
    const nextCountry = searchParams.get('country') || '';
    setSelectedCountry(nextCountry);
    setSelectedUniversity('all');
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
  const [debouncedMaxTuition, setDebouncedMaxTuition] = useState(maxTuition);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMaxTuition(maxTuition), 250);
    return () => clearTimeout(timer);
  }, [maxTuition]);

  const shortlistQueryKey = showShortlistedOnly ? shortlistedIds.join(',') : '';

  // Track unique user search / filter demand events (skipping admin & counselor staff sessions)
  useEffect(() => {
    if (!adminAuthChecked || isStaff) return;
    if (!selectedCountry && !debouncedSearch.trim() && !selectedSubject) return;
    const key = `${selectedCountry}::${debouncedSearch.trim().toLowerCase()}::${selectedSubject}::${selectedTypes.join(',')}::${selectedSector}`;
    if (key === lastTrackedSearchRef.current) return;
    lastTrackedSearchRef.current = key;
    trackAnalyticsEvent({
      event_type: 'search',
      country: selectedCountry,
      query: debouncedSearch.trim(),
      degree_level: selectedTypes.join(', '),
      subject: selectedSubject,
    });
  }, [adminAuthChecked, isStaff, selectedCountry, debouncedSearch, selectedSubject, selectedTypes, selectedSector]);

  const buildServerQueryParams = (pageNum: number) => {
    const params = new URLSearchParams();
    params.set('paginated', 'true');
    params.set('page', String(pageNum));
    params.set('limit', '120');
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    if (selectedSector !== 'all') params.set('sector', selectedSector);
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedUniversity !== 'all') params.set('university', selectedUniversity);
    if (selectedSubject) params.set('subject', selectedSubject);
    if (selectedIntake !== 'all') params.set('intake', selectedIntake);
    if (debouncedMaxTuition < 100000) params.set('maxTuition', String(debouncedMaxTuition));
    if (showShortlistedOnly) params.set('ids', shortlistQueryKey);
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
        const [metaRes, rulesRes, newsRes, settingsRes] = await Promise.all([
          fetch('/api/courses?meta=true'),
          fetch('/api/rules'),
          fetch('/api/study-abroad-news'),
          fetch('/api/site-settings', { cache: 'no-store' }),
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
        const settingsData = await settingsRes.json();
        if (settingsData?.success && Array.isArray(settingsData.priorityUniversities)) {
          setPriorityUniversities(settingsData.priorityUniversities);
        }
      } catch (e) {
        console.error('Error loading metadata/rules:', e);
      }
    }
    loadMetaAndRules();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCoursesPage(attempt = 0) {
      if (attempt === 0) {
        if (!hasLoadedOnceRef.current) setLoading(true);
        else setIsFetching(true);
      }
      try {
        const res = await fetch(`/api/courses?${buildServerQueryParams(1)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled || controller.signal.aborted) return;
        hasLoadedOnceRef.current = true;
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
      } catch (e: any) {
        if (e?.name === 'AbortError' || controller.signal.aborted) return;
        if (attempt < 2 && !cancelled) {
          setTimeout(() => loadCoursesPage(attempt + 1), 2000);
          return;
        }
        if (!cancelled) {
          hasLoadedOnceRef.current = true;
          setCourses(MOCK_COURSES);
          setServerTotal(MOCK_COURSES.length);
          setServerHasMore(false);
        }
        console.error('Error loading courses:', e);
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    }
    loadCoursesPage();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    debouncedSearch,
    selectedTypes,
    selectedSector,
    selectedCountry,
    selectedUniversity,
    selectedSubject,
    selectedIntake,
    debouncedMaxTuition,
    showShortlistedOnly,
    shortlistQueryKey,
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

  const openCourseDetailUnlocked = async (course: Course & { matchScore?: number }) => {
    setSelectedCourse(course);
    setAiCourseCheckResult(null);
    if (!isStaff) {
      trackAnalyticsEvent({
        event_type: 'course_view',
        country: course.university?.country,
        course_name: course.program_name,
        university_name: course.university?.name,
        degree_level: normalizeCourseType(course),
      });
    }
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

  const handleSelectCourse = async (course: Course & { matchScore?: number }) => {
    if (!isStaff && !hasRegisteredLead) {
      setPendingAction({ type: 'course', course });
      setLeadGateHard(true);
      setShowLeadGate(true);
      return;
    }
    await openCourseDetailUnlocked(course);
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
          saveToDb: isAdmin,
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

  const runExportExcelUnlocked = async () => {
    if (filteredCourses.length === 0 || exportingExcel) return;
    if (!isStaff) {
      trackAnalyticsEvent({
        event_type: 'excel_export',
        country: selectedCountry,
        query: searchQuery.trim(),
      });
    }
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

  const handleExportExcel = async () => {
    if (filteredCourses.length === 0 || exportingExcel) return;
    if (!isStaff && !hasRegisteredLead) {
      setPendingAction({ type: 'export' });
      setLeadGateHard(true);
      setShowLeadGate(true);
      return;
    }
    await runExportExcelUnlocked();
  };

  const handleOpenCompare = () => {
    if (!isStaff && !hasRegisteredLead) {
      setPendingAction({ type: 'compare' });
      setLeadGateHard(true);
      setShowLeadGate(true);
      return;
    }
    setShowCompareModal(true);
  };

  const handleAiDiscoverCourses = async (appendMore = false) => {
    const targetCountry = selectedCountry.trim();
    const targetQuery = searchQuery.trim();
    if (!targetCountry && !targetQuery) return;

    const discoverKey = `${targetCountry}::${targetQuery}::${selectedTypes.join(',')}::${selectedSector}`;

    if (!appendMore) {
      setLastAiDiscoverKey(discoverKey);
      try {
        const cachedAi = sessionStorage.getItem(`ai_discover_${discoverKey}`);
        if (cachedAi) {
          const parsed = JSON.parse(cachedAi);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCourses(parsed);
            setServerTotal(parsed.length);
            setServerHasMore(false);
            return;
          }
        }
      } catch {
        // Ignore storage errors
      }
      setDiscoveringAi(true);
    } else {
      setLoadingMoreAi(true);
    }

    setAiDiscoverError(null);
    const excludeUniversities = appendMore
      ? Array.from(new Set(courses.map((c) => c.university?.name).filter((n): n is string => Boolean(n))))
      : [];

    try {
      const res = await fetch('/api/ai-discover-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: targetCountry,
          query: targetQuery,
          courseTypes: selectedTypes,
          sector: selectedSector,
          excludeUniversities,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
        if (appendMore) {
          setCourses((prev) => {
            const seen = new Set(prev.map((c) => `${c.university?.name}::${c.program_name}`.toLowerCase()));
            const added = data.courses.filter(
              (c: Course) => !seen.has(`${c.university?.name}::${c.program_name}`.toLowerCase())
            );
            const next = [...prev, ...added];
            setServerTotal(next.length);
            return next;
          });
          setVisibleCount((prev) => prev + 15);
        } else {
          setCourses(data.courses);
          setServerTotal(data.courses.length);
          setServerHasMore(false);
          try {
            sessionStorage.setItem(`ai_discover_${discoverKey}`, JSON.stringify(data.courses));
          } catch {
            // Ignore quota errors
          }
        }
      } else if (!appendMore) {
        setAiDiscoverError(data.error || 'No programmes found via AI discovery.');
      }
    } catch (e: any) {
      if (!appendMore) {
        setAiDiscoverError(e?.message || 'AI discovery error');
      }
    } finally {
      setDiscoveringAi(false);
      setLoadingMoreAi(false);
    }
  };

  const availableCountries = useMemo(() => {
    const courseCountries = courses
      .map((c) => c.university?.country || '')
      .filter(Boolean);
    return mergeCountryLists([...metaCountries, ...courseCountries]);
  }, [metaCountries, courses]);

  const availableUniversities = useMemo(() => {
    const targetNormCountry = selectedCountry
      ? normalizeCountryName(selectedCountry) || selectedCountry
      : '';
    if (metaUniversities.length > 0) {
      return metaUniversities
        .filter((u) => {
          const uNorm = normalizeCountryName(u.country) || u.country;
          if (targetNormCountry && uNorm !== targetNormCountry) return false;
          if (selectedSector !== 'all') {
            const sec = classifyUniversityType(u.name, u.country, undefined, priorityUniversities);
            if (sec !== selectedSector) return false;
          }
          return true;
        })
        .map((u) => [u.id, `${u.name} (${u.country})`] as [string, string]);
    }
    const map = new Map<string, string>();
    courses.forEach((c) => {
      if (c.university) {
        const sec = classifyUniversityType(
          c.university.name,
          c.university.country,
          c.raw_excel_data,
          priorityUniversities
        );
        if (selectedSector === 'all' || sec === selectedSector) {
          map.set(c.university.id, `${c.university.name} (${c.university.country})`);
        }
      }
    });
    return Array.from(map.entries());
  }, [metaUniversities, selectedCountry, selectedSector, priorityUniversities, courses]);

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
    setSelectedSector('all');
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
    const normalizedFilterCountry = selectedCountry
      ? normalizeCountryName(selectedCountry) || selectedCountry
      : '';

    const list = courses
      .map((course) => {
        const courseType = normalizeCourseType(course);
        const uniName = course.university?.name || '';
        const uniCountry = course.university?.country || '';

        const priorityMatch = getPriorityUniversityMatch(uniName, uniCountry, priorityUniversities);
        const apiSector = (course as any).institution_type as UniversitySector | undefined;
        const sector: UniversitySector =
          priorityMatch.rule?.sector_override === 'Public' ||
          priorityMatch.rule?.sector_override === 'Private'
            ? priorityMatch.rule.sector_override
            : apiSector ||
              classifyUniversityType(uniName, uniCountry, course.raw_excel_data, priorityUniversities);

        const isPriority = Boolean((course as any).is_priority_university || priorityMatch.isPriority);
        const priorityRank = priorityMatch.isPriority
          ? priorityMatch.rank
          : (course as any).priority_rank ?? 9999;
        const priorityNote = priorityMatch.rule?.note || (course as any).priority_note || '';

        const matchingRule =
          rules.find((r) => r.scope === 'UNIVERSITY' && r.target_name.toLowerCase() === uniName.toLowerCase()) ||
          rules.find((r) => r.scope === 'COUNTRY' && r.target_name.toLowerCase() === uniCountry.toLowerCase());

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

        return {
          ...course,
          matchScore,
          academicallyEligible,
          sector,
          isPriority,
          priorityRank,
          priorityNote,
        };
      })
      .filter((course) => {
        if (searchQuery && !matchesSmartSearch(course, searchQuery)) {
          return false;
        }

        if (selectedSector !== 'all' && course.sector !== selectedSector) {
          return false;
        }

        if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeCourseType(course))) {
          return false;
        }

        if (normalizedFilterCountry) {
          const courseCountry = normalizeCountryName(course.university?.country || '') || course.university?.country || '';
          if (courseCountry.toLowerCase() !== normalizedFilterCountry.toLowerCase()) {
            return false;
          }
        }

        if (selectedUniversity !== 'all' && course.university_id !== selectedUniversity) {
          return false;
        }

        if (selectedSubject && !matchesSubjectGroup(course, selectedSubject)) {
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

        if (scholarshipsOnly && !getScholarshipInfo(course, course.sector).hasScholarship) {
          return false;
        }

        return true;
      });

    if (sortBy === 'match') {
      list.sort((a, b) => {
        const prioDiff = (a.isPriority ? 0 : 1) - (b.isPriority ? 0 : 1);
        if (prioDiff !== 0) return prioDiff;
        if (a.isPriority && b.isPriority && a.priorityRank !== b.priorityRank) {
          return a.priorityRank - b.priorityRank;
        }
        return (b.matchScore || 0) - (a.matchScore || 0);
      });
    } else if (sortBy === 'tuition_asc') {
      list.sort((a, b) => a.tuition_fees_eur - b.tuition_fees_eur);
    } else if (sortBy === 'salary_desc') {
      list.sort((a, b) => b.average_graduate_salary - a.average_graduate_salary);
    }

    return list;
  }, [
    courses,
    searchQuery,
    selectedSector,
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
    priorityUniversities,
    eligibleOnly,
    showShortlistedOnly,
    scholarshipsOnly,
    shortlistedIds,
    sortBy,
  ]);

  useEffect(() => {
    if (loading || isFetching || discoveringAi || showShortlistedOnly) return;
    if (searchQuery.trim() !== debouncedSearch.trim()) return;
    if (maxTuition !== debouncedMaxTuition) return;
    if (
      serverTotal === 0 &&
      filteredCourses.length === 0 &&
      !eligibleOnly &&
      !scholarshipsOnly &&
      (selectedCountry || debouncedSearch.trim())
    ) {
      const discoverKey = `${selectedCountry.trim()}::${debouncedSearch.trim()}::${selectedTypes.join(',')}::${selectedSector}`;
      if (discoverKey !== lastAiDiscoverKey) {
        handleAiDiscoverCourses(false);
      }
    }
  }, [
    loading,
    isFetching,
    discoveringAi,
    filteredCourses.length,
    serverTotal,
    selectedCountry,
    debouncedSearch,
    searchQuery,
    selectedTypes,
    selectedSector,
    maxTuition,
    debouncedMaxTuition,
    showShortlistedOnly,
    eligibleOnly,
    scholarshipsOnly,
    lastAiDiscoverKey,
  ]);

  const compareCourses = useMemo(() => {
    return compareIds
      .map((id) => filteredCourses.find((c) => c.id === id) || courses.find((c) => c.id === id))
      .filter((c): c is Course & { matchScore?: number; sector?: UniversitySector } => Boolean(c));
  }, [compareIds, filteredCourses, courses]);

  useEffect(() => {
    setVisibleCount(30);
  }, [
    searchQuery,
    selectedSector,
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
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black transition-colors">
      {/* Minimal Translucent Breadcrumb Bar */}
      <div className="bg-white/75 dark:bg-black/75 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px]">
            <Link
              href="/"
              className="text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white inline-flex items-center gap-1 font-medium transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Home
            </Link>
            <span className="text-black/20 dark:text-white/20">/</span>
            <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              Programme Directory
            </span>
          </div>

          <Link
            href="/enquiry"
            className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
          >
            <span>Fill Qualification Enquiry</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* LEFT SIDEBAR FILTERS */}
          <aside className="lg:col-span-3 bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
              <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#6E6E73]" />
                Filters
              </span>
              <button
                onClick={resetAll}
                className="text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Minimal Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by keyword..."
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl pl-8.5 pr-3 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
            </div>

            {/* University Type (Public / Private) */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                University Type
              </label>
              <div className="grid grid-cols-3 bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 rounded-xl text-[12px] font-medium">
                {(['all', 'Public', 'Private'] as const).map((sec) => {
                  const active = selectedSector === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setSelectedSector(sec);
                        setSelectedUniversity('all');
                      }}
                      className={`py-1.5 rounded-lg cursor-pointer transition-all ${
                        active
                          ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                          : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      {sec === 'all' ? 'All' : sec}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Course Type Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                Course Type
              </label>
              <div className="space-y-1.5">
                {COURSE_TYPES.map((type) => {
                  const c = typeCounts[type] || 0;
                  return (
                    <label
                      key={type}
                      className="flex items-center justify-between text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer py-0.5 hover:text-[#0071E3] transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(type)}
                          onChange={() => toggleType(type)}
                          className="w-4 h-4 accent-[#0071E3] rounded cursor-pointer"
                        />
                        <span className="font-normal">{type}</span>
                      </span>
                      <span className="text-[12px] text-[#86868B]">
                        ({c.toLocaleString()}{serverHasMore && c > 0 ? '+' : ''})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Subject Groups */}
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/10">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-2">
                Subject Group
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
              >
                <option value="">All Subjects</option>
                {SUBJECT_GROUPS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj === 'Engineering' ? 'Engineering & Logistics' : subj}
                  </option>
                ))}
              </select>
            </div>

            {/* Location / Country & Institution */}
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 space-y-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                Location
              </span>
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setSelectedUniversity('all');
                }}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] mb-2">
                  <span>Max Tuition Fees</span>
                  <strong className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
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
                  className="w-full apple-slider accent-[#0071E3]"
                />
              </div>

              <select
                value={selectedIntake}
                onChange={(e) => setSelectedIntake(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 space-y-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                Student Qualification
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    +2 / 12th %
                  </label>
                  <input
                    type="number"
                    value={twelfthPercent}
                    onChange={(e) => {
                      setTwelfthPercent(Number(e.target.value));
                      setEligibleOnly(true);
                    }}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    Bachelor %
                  </label>
                  <input
                    type="number"
                    value={degreePercent}
                    onChange={(e) => {
                      setDegreePercent(Number(e.target.value));
                      setEligibleOnly(true);
                    }}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    Backlogs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={backlogs}
                    onChange={(e) => setBacklogs(Number(e.target.value))}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    Work Exp (Mo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={workExpMonths}
                    onChange={(e) => setWorkExpMonths(Number(e.target.value))}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    IELTS Score
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={ieltsScore}
                    onChange={(e) => setIeltsScore(Number(e.target.value))}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    PTE Score
                  </label>
                  <input
                    type="number"
                    value={pteScore}
                    onChange={(e) => setPteScore(Number(e.target.value))}
                    placeholder="e.g. 58"
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="16"
                    value={studentAge}
                    onChange={(e) => setStudentAge(Number(e.target.value))}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block mb-1">
                    Study Gap (Yrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={studyGap}
                    onChange={(e) => setStudyGap(Number(e.target.value))}
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <input
                    type="checkbox"
                    checked={hasMoi}
                    onChange={(e) => setHasMoi(e.target.checked)}
                    className="w-4 h-4 accent-[#0071E3] rounded cursor-pointer"
                  />
                  <span>MOI (Medium of Instruction)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <input
                    type="checkbox"
                    checked={eligibleOnly}
                    onChange={(e) => setEligibleOnly(e.target.checked)}
                    className="w-4 h-4 accent-[#0071E3] rounded cursor-pointer"
                  />
                  <span>Show Eligible Only (≥ 75% Match)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <input
                    type="checkbox"
                    checked={scholarshipsOnly}
                    onChange={(e) => setScholarshipsOnly(e.target.checked)}
                    className="w-4 h-4 accent-[#0071E3] rounded cursor-pointer"
                  />
                  <span>Scholarships / Tuition-Free Only</span>
                </label>
              </div>
            </div>
          </aside>

          {/* RIGHT SIDE RESULTS LIST */}
          <main className="lg:col-span-9 space-y-4">
            {/* Top Utility Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/10">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2.5">
                  <span>
                    {serverTotal > filteredCourses.length && !eligibleOnly && !scholarshipsOnly && selectedTypes.length === 0
                      ? `${serverTotal.toLocaleString()} programmes found`
                      : `${filteredCourses.length.toLocaleString()} programmes shown${serverHasMore ? ` (of ${serverTotal.toLocaleString()} total)` : ''}`}
                  </span>
                  {isFetching && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0071E3] dark:text-[#2997FF] shrink-0" />
                  )}
                </h1>
                {(selectedTypes.length > 0 || selectedCountry || selectedSector !== 'all' || selectedSubject) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {selectedSector !== 'all' && (
                      <span
                        onClick={() => setSelectedSector('all')}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                          selectedSector === 'Public'
                            ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                            : 'bg-[#E5E5EA]/80 dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7]'
                        }`}
                      >
                        {selectedSector} Universities <X className="w-3 h-3" />
                      </span>
                    )}
                    {selectedTypes.map((t) => (
                      <span
                        key={t}
                        onClick={() => toggleType(t)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#E5E5EA]/80 dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-[#D1D1D6] dark:hover:bg-[#3A3A3C] transition-colors"
                      >
                        {t} <X className="w-3 h-3" />
                      </span>
                    ))}
                    {selectedSubject && (
                      <span
                        onClick={() => setSelectedSubject('')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#E5E5EA]/80 dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-[#D1D1D6] dark:hover:bg-[#3A3A3C] transition-colors"
                      >
                        {selectedSubject} <X className="w-3 h-3" />
                      </span>
                    )}
                    {selectedCountry && (
                      <span
                        onClick={() => {
                          setSelectedCountry('');
                          setSelectedUniversity('all');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#E5E5EA]/80 dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-[#D1D1D6] dark:hover:bg-[#3A3A3C] transition-colors"
                      >
                        {selectedCountry} <X className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Apple Segmented Control: € EUR | ₹ INR */}
                <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[12px] font-medium">
                  <button
                    onClick={() => setCurrency('EUR')}
                    className={`px-3 py-1 rounded-full cursor-pointer transition-all ${
                      currency === 'EUR'
                        ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                        : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                    }`}
                  >
                    € EUR
                  </button>
                  <button
                    onClick={() => setCurrency('INR')}
                    className={`px-3 py-1 rounded-full cursor-pointer transition-all ${
                      currency === 'INR'
                        ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                        : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                    }`}
                  >
                    ₹ INR
                  </button>
                </div>

                <button
                  onClick={() => setShowShortlistedOnly((prev) => !prev)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 cursor-pointer border transition-colors ${
                    showShortlistedOnly
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
                      : 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] border-black/[0.08] dark:border-white/10 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
                  }`}
                  title="Filter to programmes you bookmarked"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${showShortlistedOnly ? 'fill-current' : 'text-[#6E6E73]'}`} />
                  Shortlisted ({shortlistedIds.length})
                </button>

                <button
                  onClick={handleExportExcel}
                  disabled={filteredCourses.length === 0 || exportingExcel}
                  className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Download displayed courses in Excel (.xlsx) format"
                >
                  {exportingExcel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D7A39]" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#1D7A39] dark:text-[#34C759]" />
                  )}
                  {exportingExcel ? 'Preparing Excel...' : 'Download Excel (.xlsx)'}
                </button>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
                >
                  <option value="match">Sort by: Priority &amp; Best Match</option>
                  <option value="tuition_asc">Sort by: Lowest Tuition</option>
                  <option value="salary_desc">Sort by: Highest Avg Salary</option>
                </select>
              </div>
            </div>

            {/* Clean White Collapsible Visa & Policy Callout */}
            {newsUpdates.length > 0 && (() => {
              const relevantNews = selectedCountry
                ? newsUpdates.filter((n) => n.country.toLowerCase() === selectedCountry.toLowerCase())
                : newsUpdates;
              const listToShow = relevantNews.length > 0 ? relevantNews : newsUpdates;
              return (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/10 px-5 py-3 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setShowNewsPanel((p) => !p)}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Info className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF] shrink-0" />
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] shrink-0">
                        2026 Visa &amp; Policy Updates:
                      </span>
                      <span className="text-[#6E6E73] dark:text-[#A1A1A6] truncate">
                        {listToShow[0].country} — {listToShow[0].title}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#6E6E73] shrink-0 transition-transform ${
                        showNewsPanel ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {showNewsPanel && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3.5 mt-3 border-t border-black/[0.06] dark:border-white/10">
                      {listToShow.map((item, idx) => (
                        <div
                          key={`${item.country}-${idx}`}
                          className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {item.country}: {item.title}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#A1A1A6] shrink-0">
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">{item.summary}</p>
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
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.05] dark:border-white/10 animate-pulse space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-black/[0.05] dark:border-white/10">
                      <div className="space-y-2 flex-1">
                        <div className="h-3.5 w-48 rounded bg-[#E5E5EA] dark:bg-[#2C2C2E]" />
                        <div className="h-5 w-2/3 rounded bg-[#E5E5EA] dark:bg-[#2C2C2E]" />
                      </div>
                      <div className="h-7 w-24 rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E]" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="h-8 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                      <div className="h-8 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                      <div className="h-8 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                      <div className="h-8 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : discoveringAi ? (() => {
              const targetLabel = selectedCountry || searchQuery || 'Global';
              const intel = getLivingCostGuide(selectedCountry);
              const tips = [
                `Searching accredited universities & English-taught degrees in ${targetLabel}...`,
                `Estimated living proof: ${intel.note} (~${formatCurrencyAmount(intel.amountEur, currency)}/yr).`,
                `Many European universities accept an MOI (Medium of Instruction) letter in place of IELTS.`,
                `Matching entry cutoffs, intakes, and post-study stay-back rules for your profile...`,
              ];
              return (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-10 text-center space-y-4 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                  <div className="w-11 h-11 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#0071E3] flex items-center justify-center mx-auto">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      Searching {targetLabel} Global Catalogue...
                    </h3>
                    <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] min-h-[1.25rem]">
                      {tips[loadingTipIdx % tips.length]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] pt-1">
                    <span className={`px-3 py-1 rounded-full ${loadingTipIdx >= 0 ? 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-medium' : 'text-[#86868B]'}`}>
                      1. Universities
                    </span>
                    <span className={`px-3 py-1 rounded-full ${loadingTipIdx >= 1 ? 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-medium' : 'text-[#86868B]'}`}>
                      2. Tuition &amp; Living
                    </span>
                    <span className={`px-3 py-1 rounded-full ${loadingTipIdx >= 2 ? 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-medium' : 'text-[#86868B]'}`}>
                      3. Eligibility &amp; Stay-Back
                    </span>
                  </div>
                </div>
              );
            })() : filteredCourses.length === 0 ? (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-12 text-center space-y-3 border border-black/[0.06] dark:border-white/10">
                <GraduationCap className="w-10 h-10 text-[#86868B] mx-auto" />
                <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {showShortlistedOnly
                    ? 'No shortlisted programmes yet'
                    : 'No uploaded programmes match these exact filters'}
                </h3>
                {aiDiscoverError && (
                  <p className="text-xs text-[#FF3B30]">{aiDiscoverError}</p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  {!showShortlistedOnly && (selectedCountry || searchQuery.trim()) && (
                    <button
                      onClick={() => handleAiDiscoverCourses(false)}
                      className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Search {selectedCountry || searchQuery} Global Catalogue
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowShortlistedOnly(false);
                      resetAll();
                    }}
                    className="px-5 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer transition-colors"
                  >
                    {showShortlistedOnly ? 'Show All Programmes' : 'Clear All Filters'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`space-y-4 transition-opacity duration-150 ${isFetching ? 'opacity-65' : 'opacity-100'}`}>
                {filteredCourses.slice(0, visibleCount).map((course) => {
                  const score = course.matchScore ?? 85;
                  const courseType = normalizeCourseType(course);
                  const isShortlisted = shortlistedIds.includes(course.id);
                  const isCompared = compareIds.includes(course.id);
                  const scholarship = getScholarshipInfo(course, course.sector);

                  return (
                    <div
                      key={course.id}
                      onClick={() => handleSelectCourse(course)}
                      className={`bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all cursor-pointer group ${
                        course.isPriority
                          ? 'border-[#0071E3]/30 dark:border-[#2997FF]/30'
                          : 'border-black/[0.05] dark:border-white/10'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
                              {course.university?.name} · {course.university?.country}
                            </span>
                            {course.isPriority && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0071E3] dark:bg-[#2997FF]/15 dark:text-[#2997FF]"
                                title={course.priorityNote || `Admin Priority Rank #${course.priorityRank}`}
                              >
                                <Star className="w-3 h-3 fill-current" />
                                Partner Priority
                              </span>
                            )}
                            <span
                              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                                course.sector === 'Public'
                                  ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                                  : 'bg-[#F5F5F7] text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]'
                              }`}
                            >
                              {course.sector}
                            </span>
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]">
                              {courseType}
                            </span>
                            {(course as any).is_ai_discovered && (
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7]">
                                Global Catalogue
                              </span>
                            )}
                            {scholarship.hasScholarship && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]">
                                <Award className="w-3 h-3 text-[#6E6E73]" />
                                {scholarship.badge}
                              </span>
                            )}
                          </div>
                          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors leading-snug">
                            {course.program_name}
                          </h2>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            onClick={(e) => toggleCompare(course.id, e)}
                            className={`px-3 py-1 rounded-full border text-[12px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                              isCompared
                                ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
                                : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] border-transparent'
                            }`}
                            title={isCompared ? 'Remove from comparison' : 'Select to compare (up to 3)'}
                          >
                            <Scale className="w-3 h-3" />
                            {isCompared ? 'Selected' : 'Compare'}
                          </button>
                          <button
                            onClick={(e) => toggleShortlist(course.id, e)}
                            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                              isShortlisted
                                ? 'bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF]'
                                : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] hover:text-[#1D1D1F]'
                            }`}
                            title={isShortlisted ? 'Remove from Shortlist' : 'Shortlist Programme'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isShortlisted ? 'fill-current' : ''}`} />
                          </button>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${
                              score >= 80
                                ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                                : score >= 60
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                : 'bg-[#FFEBE9] text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30]'
                            }`}
                          >
                            {score}% Match
                          </span>
                        </div>
                      </div>

                      {/* Clean Hairline 4-Column Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-black/[0.06] dark:border-white/10 pt-4 mt-4">
                        <div>
                          <span className="text-[11px] uppercase font-medium tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-1">
                            Language Policy
                          </span>
                          <span className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {course.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                              ? 'MOI Accepted'
                              : course.eligibility_rules?.english_requirement_type === 'WAIVED'
                              ? 'English Waived'
                              : `IELTS ${course.eligibility_rules?.min_ielts || 6.0}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-medium tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-1">
                            Intakes
                          </span>
                          <span className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {course.intake_months?.join(', ') || 'September'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-medium tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-1">
                            Duration &amp; Visa
                          </span>
                          <span className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {course.duration_months} mo · {formatStayBack(course.stay_back_visa_years)} Stay Back
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-medium tracking-wider text-[#6E6E73] dark:text-[#86868B] block mb-1">
                            Tuition Fees
                          </span>
                          <span className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {formatCurrencyAmount(course.tuition_fees_eur, currency, true, course.sector)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(filteredCourses.length > visibleCount || serverHasMore) && (
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 hover:bg-[#EBEBF0] dark:hover:bg-[#2C2C2E] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {loadingMore
                        ? 'Loading more programmes...'
                        : `Load More Programmes (${Math.max(0, (serverHasMore ? serverTotal : filteredCourses.length) - Math.min(visibleCount, filteredCourses.length)).toLocaleString()} remaining)`}
                    </button>
                  </div>
                )}

                {!serverHasMore && courses.some((c: any) => c.is_ai_discovered) && (selectedCountry || searchQuery.trim()) && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => handleAiDiscoverCourses(true)}
                      disabled={loadingMoreAi}
                      className="px-6 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {loadingMoreAi ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      {loadingMoreAi ? 'Finding More Options...' : 'Load More Global Options'}
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
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCourse(null)}
        >
          <div
            className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] dark:border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]">
                  {normalizeCourseType(selectedCourse)}
                </span>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] mt-2">
                  {selectedCourse.program_name}
                </h2>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {selectedCourse.university?.name} ({selectedCourse.university?.country})
                </p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                <span className="text-[10px] uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] font-medium block">Tuition</span>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1 mt-1">
                  {formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true, selectedCourse.sector)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                <span className="text-[10px] uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] font-medium block">Stay Back</span>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5 text-[#6E6E73]" />
                  {formatStayBack(selectedCourse.stay_back_visa_years)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                <span className="text-[10px] uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] font-medium block">Avg Salary</span>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1 mt-1">
                  <Briefcase className="w-3.5 h-3.5 text-[#6E6E73]" />
                  {formatCurrencyAmount(selectedCourse.average_graduate_salary, currency)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#E8F8EE] dark:bg-[#34C759]/15">
                <span className="text-[10px] uppercase tracking-wider text-[#1D7A39]/80 dark:text-[#34C759]/80 font-medium block">Match Fit</span>
                <span className="text-sm font-semibold text-[#1D7A39] dark:text-[#34C759] flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedCourse.matchScore}%
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Admission &amp; Eligibility Criteria</h4>
                <button
                  type="button"
                  onClick={handleAiVerifyCourse}
                  disabled={checkingAiCourse}
                  className="px-3 py-1 rounded-full bg-white dark:bg-[#1C1C1E] hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] text-[#0071E3] dark:text-[#2997FF] border border-black/[0.08] dark:border-white/10 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Verify live university website criteria"
                >
                  {checkingAiCourse ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  {checkingAiCourse ? 'Checking Website...' : 'Verify Live Criteria'}
                </button>
              </div>
              {aiCourseCheckResult && aiCourseCheckResult.courseId === selectedCourse.id && (
                <div
                  className={`p-3 rounded-xl border text-[12px] space-y-1 ${
                    aiCourseCheckResult.error
                      ? 'bg-[#FFEBE9] border-[#FF3B30]/30 text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30]'
                      : 'bg-white dark:bg-[#1C1C1E] border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7]'
                  }`}
                >
                  {aiCourseCheckResult.error ? (
                    <span>{aiCourseCheckResult.error}</span>
                  ) : (
                    <>
                      <p className="font-medium">{aiCourseCheckResult.summary}</p>
                      {aiCourseCheckResult.subjectRequirements && (
                        <p className="text-[#6E6E73] dark:text-[#A1A1A6]">
                          <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Specific Requirements:</strong> {aiCourseCheckResult.subjectRequirements}
                        </p>
                      )}
                      {aiCourseCheckResult.sources && aiCourseCheckResult.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-medium uppercase text-[#86868B]">Sources:</span>
                          {aiCourseCheckResult.sources.map((s, idx) => (
                            <a
                              key={idx}
                              href={s.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-[#0071E3] dark:text-[#2997FF] truncate max-w-[180px]"
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
              <div className="grid grid-cols-2 gap-2.5 text-[#6E6E73] dark:text-[#A1A1A6]">
                <div>Min +2 / 12th %: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedCourse.eligibility_rules?.min_12th_percent || 50}%</strong></div>
                <div>Min Degree %: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedCourse.eligibility_rules?.min_degree_percent || 50}%</strong></div>
                <div>Min IELTS: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedCourse.eligibility_rules?.min_ielts || 6.0}</strong></div>
                <div>
                  Intakes:{' '}
                  <strong className="inline-flex items-center gap-1 text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <Calendar className="w-3 h-3 text-[#6E6E73]" /> {selectedCourse.intake_months?.join(', ')}
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
                  <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/10 flex flex-wrap gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-medium ${
                        acadOk
                          ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                          : 'bg-[#FFEBE9] text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30]'
                      }`}
                    >
                      {isPG ? 'Bachelor' : '+2 / 12th'}: {studentPct}% vs Min {reqPct}% {acadOk ? '✓' : '✗'}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-medium ${
                        engOk
                          ? 'bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#34C759]/15 dark:text-[#34C759]'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
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
              const scholarship = getScholarshipInfo(selectedCourse, selectedCourse.sector);
              const checklist = aiIntel
                ? { deadlineWindow: aiIntel.deadlineWindow, docs: aiIntel.docs }
                : getCountryChecklist(ctry);
              const isPostgrad =
                deg === 'Masters' || deg === 'PG Diploma' || deg === 'PG Certificate';
              const journey = getEndToEndJourney(ctry, isPostgrad);
              const totalYear1Eur = (selectedCourse.tuition_fees_eur || 0) + (livingGuide.amountEur || 0);
              return (
                <>
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Wallet className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF] shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            Show Money &amp; Year-1 Total Budget ({ctry || 'Abroad'})
                          </h4>
                          <p className="text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">{livingGuide.note}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] shrink-0">
                        ~{formatCurrencyAmount(livingGuide.amountEur, currency)} / yr
                      </span>
                    </div>
                    <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                      <span className="text-[#6E6E73] dark:text-[#A1A1A6]">
                        Tuition ({formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true, selectedCourse.sector)}) + Show Money (~{formatCurrencyAmount(livingGuide.amountEur, currency)})
                      </span>
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        Total Year 1: ~{formatCurrencyAmount(totalYear1Eur, currency)}
                      </span>
                    </div>
                  </div>

                  {scholarship.hasScholarship && (
                    <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-start gap-2.5 text-xs">
                      <Award className="w-4 h-4 text-[#6E6E73] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          Scholarship &amp; Funding Opportunity — {scholarship.badge}
                        </h4>
                        <p className="text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">{scholarship.detail}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#1D7A39] dark:text-[#34C759] shrink-0" />
                        <h4 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          Application &amp; Visa Guide ({ctry || 'International'})
                        </h4>
                      </div>
                      <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[11px] font-medium self-start">
                        {[
                          { id: 'roadmap' as const, label: '6-Step Process' },
                          { id: 'admission' as const, label: `Admission (${journey.admissionDocs.length})` },
                          { id: 'visa' as const, label: `Visa (${journey.visaDocs.length})` },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setModalJourneyTab(tab.id)}
                            className={`px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                              modalJourneyTab === tab.id
                                ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                                : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F]'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
                      Target Intake Window: <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{checklist.deadlineWindow}</span>
                    </p>

                    {modalJourneyTab === 'roadmap' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {journey.steps.map((s) => (
                          <div
                            key={s.step}
                            className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]"
                          >
                            <span className="text-[10px] font-semibold text-[#0071E3] dark:text-[#2997FF] block">
                              STEP {s.step}
                            </span>
                            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block mt-0.5">{s.title}</span>
                            <span className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">{s.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {modalJourneyTab === 'admission' && (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7] pt-1">
                        {journey.admissionDocs.map((doc) => {
                          const key = `adm::${doc}`;
                          const checked = Boolean(checkedDocs[key]);
                          return (
                            <li key={doc}>
                              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCheckedDocs((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                  className="accent-[#0071E3] mt-0.5 rounded cursor-pointer"
                                />
                                <span className={checked ? 'line-through text-[#86868B]' : ''}>{doc}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {modalJourneyTab === 'visa' && (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7] pt-1">
                        {(aiIntel?.docs?.length ? aiIntel.docs : journey.visaDocs).map((doc) => {
                          const key = `visa::${doc}`;
                          const checked = Boolean(checkedDocs[key]);
                          return (
                            <li key={doc}>
                              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCheckedDocs((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                  className="accent-[#0071E3] mt-0.5 rounded cursor-pointer"
                                />
                                <span className={checked ? 'line-through text-[#86868B]' : ''}>{doc}</span>
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
              <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071E3]" />
                Loading full uploaded sheet details...
              </div>
            )}

            {selectedCourse.raw_excel_data && Object.keys(selectedCourse.raw_excel_data).length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2.5 text-xs">
                <h4 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Uploaded Sheet Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#6E6E73] dark:text-[#A1A1A6]">
                  {Object.entries(selectedCourse.raw_excel_data).map(([key, val]) =>
                    val !== undefined && val !== '' ? (
                      <div key={key} className="bg-white dark:bg-[#1C1C1E] p-2.5 rounded-xl border border-black/[0.05] dark:border-white/5">
                        <span className="text-[10px] font-medium uppercase text-[#86868B] block">{key}</span>
                        <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] break-words">{String(val)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/10">
              {isAdmin && (selectedCourse as any).is_ai_discovered && (
                <button
                  onClick={async () => {
                    if (savingAiCourse || savedAiCourseIds[selectedCourse.id]) return;
                    setSavingAiCourse(true);
                    try {
                      const res = await fetch('/api/ingest-excel/commit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rows: [
                            {
                              university: selectedCourse.university?.name || 'Global University',
                              country: selectedCourse.university?.country || 'Global',
                              program_name: selectedCourse.program_name,
                              degree_level: selectedCourse.degree_level,
                              category: selectedCourse.category,
                              duration_months: selectedCourse.duration_months,
                              tuition_fees_eur: selectedCourse.tuition_fees_eur,
                              intake: selectedCourse.intake_months?.join(', ') || 'September',
                              course_url: selectedCourse.course_url,
                              stay_back_visa_years: selectedCourse.stay_back_visa_years,
                              average_graduate_salary: selectedCourse.average_graduate_salary,
                              min_12th_percent: selectedCourse.eligibility_rules?.min_12th_percent || 55,
                              min_degree_percent: selectedCourse.eligibility_rules?.min_degree_percent || 55,
                              min_ielts: selectedCourse.eligibility_rules?.min_ielts || 6.0,
                            },
                          ],
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setSavedAiCourseIds((prev) => ({ ...prev, [selectedCourse.id]: true }));
                      }
                    } catch {
                      // Ignore
                    } finally {
                      setSavingAiCourse(false);
                    }
                  }}
                  disabled={savingAiCourse || savedAiCourseIds[selectedCourse.id]}
                  className="px-4 py-2 rounded-full bg-[#1D1D1F] hover:opacity-90 dark:bg-[#F5F5F7] dark:text-[#1D1D1F] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {savedAiCourseIds[selectedCourse.id] ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Saved to Database
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      {savingAiCourse ? 'Saving...' : 'Save to My Database'}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  const linkInfo = resolveCourseUrl(selectedCourse);
                  const living = getLivingCostGuide(selectedCourse.university?.country);
                  const text = `${selectedCourse.program_name}\nUniversity: ${selectedCourse.university?.name} (${selectedCourse.university?.country})\nTuition: ${formatCurrencyAmount(selectedCourse.tuition_fees_eur, currency, true, selectedCourse.sector)}\nShow Money/Living: ~${formatCurrencyAmount(living.amountEur, currency)}/yr\nStay Back: ${formatStayBack(selectedCourse.stay_back_visa_years)}\nMatch Fit: ${selectedCourse.matchScore}%\nOfficial Link: ${linkInfo.url}`;
                  navigator.clipboard?.writeText(text);
                  setCopiedSummary(true);
                  setTimeout(() => setCopiedSummary(false), 2500);
                }}
                className="px-4 py-2 rounded-full border border-black/[0.08] dark:border-white/15 bg-white dark:bg-[#2C2C2E] hover:bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer"
                title="Copy course summary for WhatsApp / Parents / Counselor"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#1D7A39]" /> : <Share2 className="w-3.5 h-3.5" />}
                {copiedSummary ? 'Copied Summary!' : 'Share Summary'}
              </button>
              <button
                onClick={() => exportCoursesToExcel([selectedCourse], 'course-details', true)}
                className="px-4 py-2 rounded-full border border-black/[0.08] dark:border-white/15 bg-white dark:bg-[#2C2C2E] hover:bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#1D7A39] dark:text-[#34C759]" />
                Download Excel
              </button>
              <Link
                href={`/enquiry?course=${encodeURIComponent(selectedCourse.program_name)}&country=${encodeURIComponent(selectedCourse.university?.country || '')}`}
                className="px-4 py-2 rounded-full bg-[#1D1D1F] hover:opacity-90 dark:bg-[#F5F5F7] dark:text-[#1D1D1F] text-white text-xs font-medium flex items-center gap-1.5 transition-opacity"
              >
                Apply / Counseling <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {(() => {
                const linkInfo = resolveCourseUrl(selectedCourse);
                return (
                  <a
                    href={linkInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {linkInfo.isDirect ? 'Official Course Page' : 'Find Official Page'}{' '}
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-3xl bg-[#1D1D1F]/95 dark:bg-[#2C2C2E]/95 text-white border border-white/10 rounded-full px-5 py-3 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Scale className="w-4 h-4 text-[#2997FF] shrink-0" />
            <span className="font-semibold">{compareCourses.length}/3 selected to compare</span>
            <span className="hidden sm:inline text-white/60 truncate max-w-xs">
              ({compareCourses.map((c) => c.university?.name || c.program_name).join(' vs ')})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareIds([])}
              className="px-3 py-1.5 rounded-full border border-white/20 text-xs font-medium text-white/80 hover:text-white cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={handleOpenCompare}
              disabled={compareCourses.length < 2}
              className="px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium cursor-pointer disabled:opacity-40"
            >
              Compare ({compareCourses.length})
            </button>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE COMPARISON MODAL */}
      {showCompareModal && compareCourses.length >= 2 && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-[#0071E3]" />
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Side-by-Side Programme Comparison
                </h2>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/10">
                    <th className="py-3 px-3 font-medium text-[#6E6E73] uppercase text-[10px] tracking-wider w-36">
                      Criteria
                    </th>
                    {compareCourses.map((c) => (
                      <th key={c.id} className="py-3 px-3 min-w-[200px] align-top">
                        <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]">
                          {normalizeCourseType(c)}
                        </span>
                        <div className="font-semibold text-sm text-[#1D1D1F] dark:text-[#F5F5F7] mt-1.5">
                          {c.program_name}
                        </div>
                        <div className="text-[11px] font-normal text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
                          {c.university?.name} · {c.university?.country}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] dark:divide-white/10">
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Match Fit</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 font-semibold text-[#1D7A39] dark:text-[#34C759]">
                        {c.matchScore ?? 85}% Match
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Tuition Fees</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatCurrencyAmount(c.tuition_fees_eur, currency, true, c.sector)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Est. Living Cost</td>
                    {compareCourses.map((c) => {
                      const living = getLivingCostGuide(c.university?.country);
                      return (
                        <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7]">
                          <span className="font-medium">~{formatCurrencyAmount(living.amountEur, currency)} / yr</span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Language Policy</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {c.eligibility_rules?.english_requirement_type === 'MOI_ACCEPTED'
                          ? 'MOI Accepted'
                          : c.eligibility_rules?.english_requirement_type === 'WAIVED'
                          ? 'English Waived'
                          : `IELTS ${c.eligibility_rules?.min_ielts || 6.0}`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Min Academics</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7]">
                        12th: {c.eligibility_rules?.min_12th_percent || 50}% · Degree: {c.eligibility_rules?.min_degree_percent || 50}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Intakes</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {c.intake_months?.join(', ') || 'September'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Duration &amp; Stay Back</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">
                        {c.duration_months} mo · {formatStayBack(c.stay_back_visa_years)} Stay Back
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Avg Grad Salary</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3 text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                        {formatCurrencyAmount(c.average_graduate_salary, currency)} / yr
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Scholarships</td>
                    {compareCourses.map((c) => {
                      const s = getScholarshipInfo(c, c.sector);
                      return (
                        <td key={c.id} className="py-3 px-3 text-[#6E6E73] dark:text-[#A1A1A6]">
                          {s.hasScholarship ? s.badge : 'Check University'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-medium text-[#6E6E73]">Action</td>
                    {compareCourses.map((c) => (
                      <td key={c.id} className="py-3 px-3">
                        <Link
                          href={`/enquiry?course=${encodeURIComponent(c.program_name)}&country=${encodeURIComponent(c.university?.country || '')}`}
                          className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium transition-colors"
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

      {isAdmin ? (
        <div className="fixed bottom-5 left-5 z-40">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1D1D1F]/95 dark:bg-[#F5F5F7]/95 text-white dark:text-[#1D1D1F] shadow-xl backdrop-blur-md text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <ShieldCheck className="w-4 h-4 text-[#34C759]" />
            <span>Admin Session · Return to Admin Portal</span>
          </Link>
        </div>
      ) : isStaff ? (
        <div className="fixed bottom-5 left-5 z-40">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1D1D1F]/90 dark:bg-[#F5F5F7]/90 text-white dark:text-[#1D1D1F] shadow-lg backdrop-blur-md text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-[#2997FF]" />
            <span>
              Counselor Mode{staffName ? ` · ${staffName}` : ''} · Pop-ups &amp; Tracking Paused
            </span>
          </div>
        </div>
      ) : null}

      <PublicLeadGate
        isOpen={showLeadGate}
        isHardGate={leadGateHard}
        defaultCountry={selectedCountry}
        searchContext={[selectedCountry, searchQuery, selectedTypes.join(', ')].filter(Boolean).join(' · ')}
        availableCountries={availableCountries}
        onComplete={() => {
          setHasRegisteredLead(true);
          setShowLeadGate(false);
          const action = pendingAction;
          setPendingAction(null);
          if (action?.type === 'course') {
            openCourseDetailUnlocked(action.course);
          } else if (action?.type === 'export') {
            runExportExcelUnlocked();
          } else if (action?.type === 'compare') {
            setShowCompareModal(true);
          }
        }}
        onDismiss={() => {
          setShowLeadGate(false);
          setPendingAction(null);
        }}
      />
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
