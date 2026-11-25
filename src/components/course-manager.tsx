'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Building2,
  ShieldCheck,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ExternalLink
} from 'lucide-react';
import { Course } from '@/types/database';
import { exportCoursesToExcel } from '@/lib/excel-export';
import { mergeCountryLists } from '@/lib/countries';

interface UniversitySummary {
  id: string;
  name: string;
  country: string;
  course_count: number;
}

function clearPublicCourseCaches() {
  try {
    sessionStorage.removeItem('globalcourse_meta_v1');
    sessionStorage.removeItem('globalcourse_cache_v1');
  } catch {
    // Ignore storage errors
  }
}

export default function CourseManager() {
  const [viewMode, setViewMode] = useState<'courses' | 'universities'>('courses');

  // Courses state (server-paginated across 25,000+ courses)
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [universityFilter, setUniversityFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const PAGE_SIZE = 100;

  // Universities state
  const [universities, setUniversities] = useState<UniversitySummary[]>([]);
  const [loadingUnis, setLoadingUnis] = useState<boolean>(false);
  const [uniSearch, setUniSearch] = useState<string>('');
  const [uniCountryFilter, setUniCountryFilter] = useState<string>('');
  const [selectedUniIds, setSelectedUniIds] = useState<string[]>([]);
  const [deletingUnis, setDeletingUnis] = useState<boolean>(false);
  const [editingUniId, setEditingUniId] = useState<string | null>(null);
  const [draftUniName, setDraftUniName] = useState<string>('');
  const [draftUniCountry, setDraftUniCountry] = useState<string>('');

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (type: 'success' | 'error', text: string, durationMs = 4500) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActionBanner({ type, text });
    bannerTimerRef.current = setTimeout(() => setActionBanner(null), durationMs);
  };

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Bulk Selection & Rectify State (Courses)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDegreePercent, setBulkDegreePercent] = useState<number>(50);
  const [bulk12thPercent, setBulk12thPercent] = useState<number>(50);
  const [bulkIelts, setBulkIelts] = useState<number>(6.0);
  const [bulkJustPass, setBulkJustPass] = useState<boolean>(false);
  const [bulkUpdating, setBulkUpdating] = useState<boolean>(false);

  // Single-row Edit draft state
  const [draftProgramName, setDraftProgramName] = useState<string>('');
  const [draftFees, setDraftFees] = useState<number>(0);
  const [draftMin12th, setDraftMin12th] = useState<number>(60);
  const [draftMinDegree, setDraftMinDegree] = useState<number>(60);
  const [draftMinIelts, setDraftMinIelts] = useState<number>(6.5);
  const [draftInterview, setDraftInterview] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUniversities = async () => {
    setLoadingUnis(true);
    try {
      const res = await fetch('/api/courses/manage?mode=universities');
      const data = await res.json();
      if (data.success && Array.isArray(data.universities)) {
        setUniversities(data.universities);
      }
    } catch (err) {
      console.error('Failed to load universities:', err);
    } finally {
      setLoadingUnis(false);
    }
  };

  const fetchCourses = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('paginated', 'true');
      params.set('page', String(targetPage));
      params.set('limit', String(PAGE_SIZE));
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (countryFilter) params.set('country', countryFilter);
      if (universityFilter !== 'all') params.set('university', universityFilter);

      const res = await fetch(`/api/courses?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.courses)) {
        setCourses(data.courses);
        setTotalCourses(data.total ?? data.courses.length);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    fetchCourses(page);
  }, [page, debouncedSearch, countryFilter, universityFilter]);

  const availableCountries = useMemo(() => {
    return mergeCountryLists(universities.map((u) => u.country).filter(Boolean));
  }, [universities]);

  const filteredDropdownUniversities = useMemo(() => {
    return universities.filter((u) => !countryFilter || u.country === countryFilter);
  }, [universities, countryFilter]);

  const filteredUniversities = useMemo(() => {
    return universities.filter((u) => {
      if (uniCountryFilter && u.country !== uniCountryFilter) return false;
      if (
        uniSearch.trim() &&
        !u.name.toLowerCase().includes(uniSearch.toLowerCase()) &&
        !u.country.toLowerCase().includes(uniSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [universities, uniCountryFilter, uniSearch]);

  const totalPages = Math.max(1, Math.ceil(totalCourses / PAGE_SIZE));

  // Course selection helpers
  const allPageSelected =
    courses.length > 0 && courses.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const pageSet = new Set(courses.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...courses.map((c) => c.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // University selection helpers
  const allFilteredUnisSelected =
    filteredUniversities.length > 0 &&
    filteredUniversities.every((u) => selectedUniIds.includes(u.id));

  const toggleSelectAllUnis = () => {
    if (allFilteredUnisSelected) {
      const set = new Set(filteredUniversities.map((u) => u.id));
      setSelectedUniIds((prev) => prev.filter((id) => !set.has(id)));
    } else {
      const merged = new Set([...selectedUniIds, ...filteredUniversities.map((u) => u.id)]);
      setSelectedUniIds(Array.from(merged));
    }
  };

  const toggleSelectOneUni = (id: string) => {
    setSelectedUniIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    const targetDegree = bulkJustPass ? 35 : bulkDegreePercent;
    const target12th = bulkJustPass ? 35 : bulk12thPercent;

    try {
      const res = await fetch('/api/courses/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          min_degree_percent: targetDegree,
          min_12th_percent: target12th,
          min_ielts: bulkIelts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setCourses((prev) =>
          prev.map((c) =>
            selectedIds.includes(c.id)
              ? {
                  ...c,
                  eligibility_rules: {
                    id: c.eligibility_rules?.id || '',
                    course_id: c.id,
                    min_12th_percent: target12th,
                    min_degree_percent: targetDegree,
                    min_ielts: bulkIelts,
                    min_toefl: c.eligibility_rules?.min_toefl ?? 85,
                    interview_required: c.eligibility_rules?.interview_required ?? false,
                    work_experience_months: c.eligibility_rules?.work_experience_months ?? 0,
                  },
                }
              : c
          )
        );
        clearPublicCourseCaches();
        showBanner(
          'success',
          `Updated ${selectedIds.length} courses to ${bulkJustPass ? 'Just Pass (35%)' : `${targetDegree}%`} & IELTS ${bulkIelts} in Supabase!`
        );
        setSelectedIds([]);
      } else {
        showBanner('error', data.error || 'Failed to update selected courses');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to update selected courses');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} selected courses from Supabase?`)) {
      return;
    }
    setBulkUpdating(true);
    try {
      const res = await fetch(`/api/courses/manage?ids=${encodeURIComponent(selectedIds.join(','))}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        showBanner('success', `Deleted ${selectedIds.length} courses from Supabase.`);
        setSelectedIds([]);
        await Promise.all([fetchCourses(page), fetchUniversities()]);
      } else {
        showBanner('error', data.error || 'Failed to delete selected courses');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to delete selected courses');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDeleteUniversity = async (uni: UniversitySummary) => {
    if (
      !confirm(
        `Permanently delete "${uni.name}" (${uni.country}) AND all ${uni.course_count} of its courses? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingUnis(true);
    try {
      const res = await fetch(`/api/courses/manage?university_id=${encodeURIComponent(uni.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        setUniversities((prev) => prev.filter((u) => u.id !== uni.id));
        setSelectedUniIds((prev) => prev.filter((id) => id !== uni.id));
        if (universityFilter === uni.id) setUniversityFilter('all');
        showBanner('success', `Deleted "${uni.name}" and its ${uni.course_count} courses.`);
        fetchCourses(1);
      } else {
        showBanner('error', data.error || 'Failed to delete university');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to delete university');
    } finally {
      setDeletingUnis(false);
    }
  };

  const handleBulkDeleteUniversities = async () => {
    if (selectedUniIds.length === 0) return;
    const totalAffected = universities
      .filter((u) => selectedUniIds.includes(u.id))
      .reduce((acc, u) => acc + u.course_count, 0);

    if (
      !confirm(
        `Permanently delete ${selectedUniIds.length} selected universities AND all ${totalAffected.toLocaleString()} associated courses?`
      )
    ) {
      return;
    }
    setDeletingUnis(true);
    try {
      const res = await fetch(
        `/api/courses/manage?university_ids=${encodeURIComponent(selectedUniIds.join(','))}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        const deletedSet = new Set(selectedUniIds);
        setUniversities((prev) => prev.filter((u) => !deletedSet.has(u.id)));
        setSelectedUniIds([]);
        setUniversityFilter('all');
        showBanner(
          'success',
          `Deleted ${deletedSet.size} universities and ${totalAffected.toLocaleString()} courses.`,
          5000
        );
        fetchCourses(1);
      } else {
        showBanner('error', data.error || 'Failed to delete selected universities');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to delete selected universities');
    } finally {
      setDeletingUnis(false);
    }
  };

  const saveUniEdit = async (uniId: string) => {
    try {
      const res = await fetch('/api/courses/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'university',
          id: uniId,
          name: draftUniName,
          country: draftUniCountry,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        setUniversities((prev) =>
          prev.map((u) =>
            u.id === uniId ? { ...u, name: draftUniName.trim(), country: draftUniCountry.trim() } : u
          )
        );
        setEditingUniId(null);
        showBanner('success', 'University updated in Supabase!', 3000);
      } else {
        showBanner('error', data.error || 'Failed to update university');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to update university');
    }
  };

  const startEdit = (course: Course) => {
    setEditingCourseId(course.id);
    setDraftProgramName(course.program_name);
    setDraftFees(course.tuition_fees_eur);
    setDraftMin12th(course.eligibility_rules?.min_12th_percent || 60);
    setDraftMinDegree(course.eligibility_rules?.min_degree_percent || 60);
    setDraftMinIelts(course.eligibility_rules?.min_ielts || 6.5);
    setDraftInterview(course.eligibility_rules?.interview_required || false);
  };

  const cancelEdit = () => {
    setEditingCourseId(null);
  };

  const saveEdit = async (courseId: string) => {
    try {
      const res = await fetch('/api/courses/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: courseId,
          program_name: draftProgramName,
          tuition_fees_eur: draftFees,
          eligibility_rules: {
            min_12th_percent: draftMin12th,
            min_degree_percent: draftMinDegree,
            min_ielts: draftMinIelts,
            interview_required: draftInterview,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        setEditingCourseId(null);
        showBanner('success', 'Course updated in Supabase!', 3000);
        setCourses((prev) =>
          prev.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  program_name: draftProgramName,
                  tuition_fees_eur: draftFees,
                  eligibility_rules: {
                    id: c.eligibility_rules?.id || '',
                    course_id: courseId,
                    min_12th_percent: draftMin12th,
                    min_degree_percent: draftMinDegree,
                    min_ielts: draftMinIelts,
                    min_toefl: 85,
                    interview_required: draftInterview,
                    work_experience_months: 0,
                  },
                }
              : c
          )
        );
      } else {
        showBanner('error', data.error || 'Failed to update course');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to update course');
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!confirm('Permanently delete this course from Supabase?')) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/manage?id=${encodeURIComponent(courseId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        clearPublicCourseCaches();
        showBanner('success', 'Course deleted from database.', 3000);
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
        setSelectedIds((prev) => prev.filter((id) => id !== courseId));
        setTotalCourses((prev) => Math.max(0, prev - 1));
        fetchUniversities();
      } else {
        showBanner('error', data.error || 'Failed to delete course');
      }
    } catch (err) {
      console.error(err);
      showBanner('error', 'Failed to delete course');
    }
  };

  return (
    <section id="course-manager" className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none p-6 rounded-2xl space-y-5">
      <datalist id="admin-country-options">
        {availableCountries.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/10">
        <div>
          <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
            Course &amp; University Manager
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
              {totalCourses.toLocaleString()} Courses
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
              {universities.length.toLocaleString()} Universities
            </span>
          </h2>
          <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
            Search all courses across every page, or switch to Universities Manager to remove institutions in bulk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-xs font-medium">
            <button
              onClick={() => setViewMode('courses')}
              className={`px-3.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'courses'
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Courses
            </button>
            <button
              onClick={() => setViewMode('universities')}
              className={`px-3.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'universities'
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Universities ({universities.length})
            </button>
          </div>

          <button
            onClick={() => {
              fetchUniversities();
              fetchCourses(page);
            }}
            disabled={loading || loadingUnis}
            className="px-3.5 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6E6E73] ${loading || loadingUnis ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {actionBanner && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            actionBanner.type === 'error'
              ? 'bg-[#FFEBE9] dark:bg-[#FF3B30]/15 border-[#FF3B30]/30 text-[#C41E1E] dark:text-[#FF6961]'
              : 'bg-[#E8F8EE] dark:bg-[#34C759]/15 border-[#34C759]/30 text-[#1D7A39] dark:text-[#34C759]'
          }`}
        >
          {actionBanner.text}
        </div>
      )}

      {/* ==================== VIEW 1: COURSES MANAGER ==================== */}
      {viewMode === 'courses' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search any course or university (e.g. East London)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl pl-8.5 pr-3 py-2 text-xs text-[#1D1D1F] dark:text-white placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
            </div>

            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setUniversityFilter('all');
                setPage(1);
              }}
              className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-xs font-medium text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            >
              <option value="">All Countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <select
                value={universityFilter}
                onChange={(e) => {
                  setUniversityFilter(e.target.value);
                  setPage(1);
                }}
                className="flex-1 min-w-0 bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-xs font-medium text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              >
                <option value="all">All Universities ({filteredDropdownUniversities.length})</option>
                {filteredDropdownUniversities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.course_count})
                  </option>
                ))}
              </select>

              <button
                onClick={() => exportCoursesToExcel(courses, 'admin-courses-page', false)}
                disabled={courses.length === 0}
                className="px-3.5 py-2 rounded-full bg-white dark:bg-[#2C2C2E] border border-black/[0.08] dark:border-white/15 hover:bg-[#F5F5F7] text-[#1D1D1F] dark:text-white text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                title="Download displayed courses as Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-[#1D7A39]" />
                .xlsx
              </button>
            </div>
          </div>

          {/* BULK RECTIFY BAR */}
          {selectedIds.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.08] dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-[#1D1D1F] dark:text-white">
                  {selectedIds.length} courses selected
                </span>

                <label className="flex items-center gap-1.5 font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkJustPass}
                    onChange={(e) => setBulkJustPass(e.target.checked)}
                    className="accent-[#0071E3] rounded cursor-pointer"
                  />
                  <span>Just Pass (35%)</span>
                </label>

                {!bulkJustPass && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#6E6E73] dark:text-[#A1A1A6]">Min Degree %:</span>
                      <input
                        type="number"
                        value={bulkDegreePercent}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setBulkDegreePercent(v);
                          setBulk12thPercent(v);
                        }}
                        className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-lg px-2 py-1 text-xs font-semibold text-[#1D1D1F] dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#6E6E73] dark:text-[#A1A1A6]">Min 12th %:</span>
                      <input
                        type="number"
                        value={bulk12thPercent}
                        onChange={(e) => setBulk12thPercent(Number(e.target.value))}
                        className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-lg px-2 py-1 text-xs font-semibold text-[#1D1D1F] dark:text-white"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="text-[#6E6E73] dark:text-[#A1A1A6]">Min IELTS:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={bulkIelts}
                    onChange={(e) => setBulkIelts(Number(e.target.value))}
                    className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/15 rounded-lg px-2 py-1 text-xs font-semibold text-[#1D1D1F] dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating}
                  className="px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  {bulkUpdating ? 'Updating...' : 'Apply to Selected'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                  className="px-3.5 py-1.5 rounded-full bg-[#FFEBE9] hover:bg-[#FFDCD9] text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30] text-xs font-medium cursor-pointer"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-full text-xs text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-xs text-[#6E6E73] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#0071E3]" />
              Loading courses from Supabase...
            </div>
          ) : courses.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6E6E73]">
              No courses found for these filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/10">
                <table className="w-full text-left text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <thead className="bg-[#F5F5F7] dark:bg-[#2C2C2E] uppercase text-[10px] text-[#6E6E73] dark:text-[#86868B] tracking-wider border-b border-black/[0.06] dark:border-white/10">
                    <tr>
                      <th className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          className="accent-[#0071E3] rounded cursor-pointer"
                          title="Select all on this page"
                        />
                      </th>
                      <th className="px-3 py-3">Program &amp; University</th>
                      <th className="px-3 py-3">Fees (EUR)</th>
                      <th className="px-3 py-3">Min Degree %</th>
                      <th className="px-3 py-3">Min 12th %</th>
                      <th className="px-3 py-3">Min IELTS</th>
                      <th className="px-3 py-3">Interview</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/5">
                    {courses.map((course) => {
                      const isEditing = editingCourseId === course.id;
                      const isSelected = selectedIds.includes(course.id);

                      return (
                        <tr
                          key={course.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-[#0071E3]/5' : 'hover:bg-[#F5F5F7]/70 dark:hover:bg-[#2C2C2E]/60'
                          }`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(course.id)}
                              className="accent-[#0071E3] rounded cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3 max-w-xs">
                            {isEditing ? (
                              <input
                                type="text"
                                value={draftProgramName}
                                onChange={(e) => setDraftProgramName(e.target.value)}
                                className="w-full bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white mb-1"
                              />
                            ) : (
                              <span className="font-semibold text-[#1D1D1F] dark:text-white block truncate">
                                {course.program_name}
                              </span>
                            )}
                            <span className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#86868B]" />
                              {course.university?.name} ({course.university?.country})
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                value={draftFees}
                                onChange={(e) => setDraftFees(Number(e.target.value))}
                                className="w-20 bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white"
                              />
                            ) : (
                              <span className="font-semibold text-[#1D1D1F] dark:text-white">
                                {course.tuition_fees_eur === 0
                                  ? '€0'
                                  : `€${course.tuition_fees_eur.toLocaleString()}`}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                value={draftMinDegree}
                                onChange={(e) => setDraftMinDegree(Number(e.target.value))}
                                className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white"
                              />
                            ) : (
                              <span>
                                {(course.eligibility_rules?.min_degree_percent ?? 60) <= 35
                                  ? 'Just Pass (35%)'
                                  : `${course.eligibility_rules?.min_degree_percent ?? 60}%`}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                value={draftMin12th}
                                onChange={(e) => setDraftMin12th(Number(e.target.value))}
                                className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white"
                              />
                            ) : (
                              <span>
                                {(course.eligibility_rules?.min_12th_percent ?? 60) <= 35
                                  ? 'Just Pass (35%)'
                                  : `${course.eligibility_rules?.min_12th_percent ?? 60}%`}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.5"
                                value={draftMinIelts}
                                onChange={(e) => setDraftMinIelts(Number(e.target.value))}
                                className="w-16 bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-[#1D1D1F] dark:text-white"
                              />
                            ) : (
                              <span className="font-medium text-[#1D1D1F] dark:text-white">
                                {course.eligibility_rules?.min_ielts || 6.5}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={draftInterview}
                                onChange={(e) => setDraftInterview(e.target.checked)}
                                className="accent-[#0071E3] cursor-pointer"
                              />
                            ) : course.eligibility_rules?.interview_required ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#2997FF]/15 dark:text-[#2997FF] text-[10px] font-medium">
                                Required
                              </span>
                            ) : (
                              <span className="text-[#86868B] text-[11px]">Waived</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => saveEdit(course.id)}
                                  className="p-1.5 rounded-full bg-[#E8F8EE] text-[#1D7A39] hover:opacity-80 cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded-full bg-[#FFEBE9] text-[#C41E1E] hover:opacity-80 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => startEdit(course)}
                                  className="p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#EBEBF0] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white transition-colors cursor-pointer"
                                  title="Edit Course"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteCourse(course.id)}
                                  className="p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#FFEBE9] text-[#6E6E73] hover:text-[#FF3B30] transition-colors cursor-pointer"
                                  title="Delete Course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#A1A1A6] pt-1">
                <span>
                  Page <strong className="text-[#1D1D1F] dark:text-white">{page}</strong> of <strong className="text-[#1D1D1F] dark:text-white">{totalPages}</strong> ({totalCourses.toLocaleString()} total courses)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3.5 py-1.5 rounded-full border border-black/[0.08] dark:border-white/15 bg-white dark:bg-[#2C2C2E] flex items-center gap-1 font-medium text-[#1D1D1F] dark:text-white cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3.5 py-1.5 rounded-full border border-black/[0.08] dark:border-white/15 bg-white dark:bg-[#2C2C2E] flex items-center gap-1 font-medium text-[#1D1D1F] dark:text-white cursor-pointer disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== VIEW 2: UNIVERSITIES & COLLEGES MANAGER ==================== */}
      {viewMode === 'universities' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search any university or college (e.g. East London, Sixth Form)..."
                value={uniSearch}
                onChange={(e) => setUniSearch(e.target.value)}
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl pl-8.5 pr-3 py-2 text-xs text-[#1D1D1F] dark:text-white placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
            </div>
            <select
              value={uniCountryFilter}
              onChange={(e) => setUniCountryFilter(e.target.value)}
              className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 rounded-xl px-3 py-2 text-xs font-medium text-[#1D1D1F] dark:text-white"
            >
              <option value="">All Countries ({availableCountries.length})</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {selectedUniIds.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#FFEBE9] dark:bg-[#FF3B30]/15 border border-[#FF3B30]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-[#C41E1E] dark:text-[#FF3B30]">
                {selectedUniIds.length} universities selected (
                {universities
                  .filter((u) => selectedUniIds.includes(u.id))
                  .reduce((acc, u) => acc + u.course_count, 0)
                  .toLocaleString()}{' '}
                courses)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDeleteUniversities}
                  disabled={deletingUnis}
                  className="px-4 py-1.5 rounded-full bg-[#FF3B30] hover:opacity-90 text-white font-medium cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingUnis ? 'Deleting...' : `Delete ${selectedUniIds.length} Universities & Courses`}
                </button>
                <button
                  onClick={() => setSelectedUniIds([])}
                  className="px-3 py-1.5 rounded-full text-xs text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loadingUnis ? (
            <div className="py-10 text-center text-xs text-[#6E6E73] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#0071E3]" />
              Loading universities...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/10 max-h-[540px]">
              <table className="w-full text-left text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                <thead className="bg-[#F5F5F7] dark:bg-[#2C2C2E] sticky top-0 uppercase text-[10px] text-[#6E6E73] dark:text-[#86868B] tracking-wider border-b border-black/[0.06] dark:border-white/10">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allFilteredUnisSelected}
                        onChange={toggleSelectAllUnis}
                        className="accent-[#FF3B30] rounded cursor-pointer"
                        title="Select all visible universities"
                      />
                    </th>
                    <th className="px-3 py-3">University / Institution</th>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">Courses</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/5">
                  {filteredUniversities.map((uni) => {
                    const isSelected = selectedUniIds.includes(uni.id);
                    const isEditing = editingUniId === uni.id;
                    return (
                      <tr
                        key={uni.id}
                        className={isSelected ? 'bg-[#FFEBE9]/50 dark:bg-[#FF3B30]/10' : 'hover:bg-[#F5F5F7]/70 dark:hover:bg-[#2C2C2E]/60'}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOneUni(uni.id)}
                            className="accent-[#FF3B30] rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#1D1D1F] dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={draftUniName}
                              onChange={(e) => setDraftUniName(e.target.value)}
                              className="w-full bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            uni.name
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#6E6E73] dark:text-[#A1A1A6]">
                          {isEditing ? (
                            <input
                              type="text"
                              list="admin-country-options"
                              value={draftUniCountry}
                              onChange={(e) => setDraftUniCountry(e.target.value)}
                              className="w-32 bg-white dark:bg-[#1C1C1E] border border-black/15 dark:border-white/20 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            uni.country
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">
                            {uni.course_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => saveUniEdit(uni.id)}
                                className="p-1.5 rounded-full bg-[#E8F8EE] text-[#1D7A39] cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingUniId(null)}
                                className="p-1.5 rounded-full bg-[#FFEBE9] text-[#C41E1E] cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setCountryFilter(uni.country);
                                  setUniversityFilter(uni.id);
                                  setPage(1);
                                  setViewMode('courses');
                                }}
                                className="px-3 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#EBEBF0] text-[#0071E3] dark:text-[#2997FF] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                                title="View courses for this university"
                              >
                                Courses <ExternalLink className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUniId(uni.id);
                                  setDraftUniName(uni.name);
                                  setDraftUniCountry(uni.country);
                                }}
                                className="p-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#EBEBF0] text-[#6E6E73] cursor-pointer"
                                title="Rename University"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUniversity(uni)}
                                disabled={deletingUnis}
                                className="px-3 py-1 rounded-full bg-[#FFEBE9] hover:bg-[#FFDCD9] text-[#C41E1E] dark:bg-[#FF3B30]/15 dark:text-[#FF3B30] text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Delete this university and all its courses"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
