'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
    const set = new Set<string>();
    universities.forEach((u) => u.country && set.add(u.country));
    return Array.from(set).sort();
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
      const data = await res.json();
      if (data.success) {
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
        setActionMessage(
          `Updated ${selectedIds.length} courses to ${bulkJustPass ? 'Just Pass (35%)' : `${targetDegree}%`} & IELTS ${bulkIelts} in Supabase!`
        );
        setSelectedIds([]);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
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
      const res = await fetch(`/api/courses/manage?ids=${selectedIds.join(',')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        setActionMessage(`Deleted ${selectedIds.length} courses from Supabase.`);
        setSelectedIds([]);
        await Promise.all([fetchCourses(page), fetchUniversities()]);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
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
      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        setUniversities((prev) => prev.filter((u) => u.id !== uni.id));
        setSelectedUniIds((prev) => prev.filter((id) => id !== uni.id));
        if (universityFilter === uni.id) setUniversityFilter('all');
        setActionMessage(`Deleted "${uni.name}" and its ${uni.course_count} courses.`);
        fetchCourses(1);
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setActionMessage(data.error || 'Failed to delete university');
      }
    } catch (err) {
      console.error(err);
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
      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        const deletedSet = new Set(selectedUniIds);
        setUniversities((prev) => prev.filter((u) => !deletedSet.has(u.id)));
        setSelectedUniIds([]);
        setUniversityFilter('all');
        setActionMessage(`Deleted ${deletedSet.size} universities and ${totalAffected.toLocaleString()} courses.`);
        fetchCourses(1);
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        setActionMessage(data.error || 'Failed to delete selected universities');
      }
    } catch (err) {
      console.error(err);
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
      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        setUniversities((prev) =>
          prev.map((u) =>
            u.id === uniId ? { ...u, name: draftUniName.trim(), country: draftUniCountry.trim() } : u
          )
        );
        setActionMessage('University updated in Supabase!');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingUniId(null);
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

      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        setActionMessage('Course updated in Supabase!');
        setTimeout(() => setActionMessage(null), 3000);
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingCourseId(null);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!confirm('Permanently delete this course from Supabase?')) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/manage?id=${courseId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        clearPublicCourseCaches();
        setActionMessage('Course deleted from database.');
        setTimeout(() => setActionMessage(null), 3000);
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
        setTotalCourses((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section id="course-manager" className="glass-card p-6 rounded-2xl space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Course &amp; University Manager
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
              {totalCourses.toLocaleString()} Courses
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-semibold">
              {universities.length.toLocaleString()} Universities
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search all courses across every page, or switch to Universities Manager to delete unwanted colleges in bulk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-slate-900 p-0.5 text-xs font-bold">
            <button
              onClick={() => setViewMode('courses')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'courses'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Courses
            </button>
            <button
              onClick={() => setViewMode('universities')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'universities'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingUnis ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {actionMessage}
        </div>
      )}

      {/* ==================== VIEW 1: COURSES MANAGER ==================== */}
      {viewMode === 'courses' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search any course or university (e.g. East London)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setUniversityFilter('all');
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
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
                className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
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
                className="neon-btn-emerald px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                title="Download displayed courses as Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                .xlsx
              </button>
            </div>
          </div>

          {/* BULK RECTIFY BAR */}
          {selectedIds.length > 0 && (
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-cyan-800 dark:text-cyan-300">
                  {selectedIds.length} courses selected
                </span>

                <label className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkJustPass}
                    onChange={(e) => setBulkJustPass(e.target.checked)}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                  <span>Just Pass (35%)</span>
                </label>

                {!bulkJustPass && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Min Degree %:</span>
                      <input
                        type="number"
                        value={bulkDegreePercent}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setBulkDegreePercent(v);
                          setBulk12thPercent(v);
                        }}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Min 12th %:</span>
                      <input
                        type="number"
                        value={bulk12thPercent}
                        onChange={(e) => setBulk12thPercent(Number(e.target.value))}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Min IELTS:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={bulkIelts}
                    onChange={(e) => setBulkIelts(Number(e.target.value))}
                    className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating}
                  className="neon-btn-cyan px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {bulkUpdating ? 'Updating...' : 'Apply to Selected'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
              Loading courses from Supabase...
            </div>
          ) : courses.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No courses found for these filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-white/5 uppercase text-[10px] text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          className="accent-cyan-600 rounded cursor-pointer"
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
                  <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                    {courses.map((course) => {
                      const isEditing = editingCourseId === course.id;
                      const isSelected = selectedIds.includes(course.id);

                      return (
                        <tr
                          key={course.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-cyan-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(course.id)}
                              className="accent-cyan-600 rounded cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3 max-w-xs">
                            {isEditing ? (
                              <input
                                type="text"
                                value={draftProgramName}
                                onChange={(e) => setDraftProgramName(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white mb-1"
                              />
                            ) : (
                              <span className="font-semibold text-slate-900 dark:text-white block truncate">
                                {course.program_name}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {course.university?.name} ({course.university?.country})
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                value={draftFees}
                                onChange={(e) => setDraftFees(Number(e.target.value))}
                                className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                              />
                            ) : (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
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
                                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
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
                                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
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
                                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                              />
                            ) : (
                              <span className="font-bold text-cyan-600 dark:text-cyan-400">
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
                                className="accent-cyan-500 cursor-pointer"
                              />
                            ) : course.eligibility_rules?.interview_required ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                                Required
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-[11px]">Waived</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => saveEdit(course.id)}
                                  className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => startEdit(course)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-cyan-500/15 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                                  title="Edit Course"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteCourse(course.id)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCourses.toLocaleString()} total courses)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-40"
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
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search any university or college (e.g. East London, Acupuncture, Sixth Form)..."
                value={uniSearch}
                onChange={(e) => setUniSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <select
              value={uniCountryFilter}
              onChange={(e) => setUniCountryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="">All Countries ({availableCountries.length})</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {selectedUniIds.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-rose-700 dark:text-rose-300">
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
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingUnis ? 'Deleting...' : `Delete ${selectedUniIds.length} Universities & All Their Courses`}
                </button>
                <button
                  onClick={() => setSelectedUniIds([])}
                  className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loadingUnis ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
              Loading universities...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 max-h-[540px]">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 uppercase text-[10px] text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allFilteredUnisSelected}
                        onChange={toggleSelectAllUnis}
                        className="accent-rose-600 rounded cursor-pointer"
                        title="Select all visible universities"
                      />
                    </th>
                    <th className="px-3 py-3">University / Institution</th>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">Courses</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                  {filteredUniversities.map((uni) => {
                    const isSelected = selectedUniIds.includes(uni.id);
                    const isEditing = editingUniId === uni.id;
                    return (
                      <tr
                        key={uni.id}
                        className={isSelected ? 'bg-rose-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOneUni(uni.id)}
                            className="accent-rose-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={draftUniName}
                              onChange={(e) => setDraftUniName(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            uni.name
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={draftUniCountry}
                              onChange={(e) => setDraftUniCountry(e.target.value)}
                              className="w-32 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            uni.country
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-bold">
                            {uni.course_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => saveUniEdit(uni.id)}
                                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingUniId(null)}
                                className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
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
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
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
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-cyan-500/15 text-slate-600 dark:text-slate-300 cursor-pointer"
                                title="Rename University"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUniversity(uni)}
                                disabled={deletingUnis}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
