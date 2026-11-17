'use client';

import { useState, useEffect } from 'react';
import {
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Building2,
  ShieldCheck,
  RefreshCw,
  Download
} from 'lucide-react';
import { Course } from '@/types/database';
import { exportCoursesToExcel } from '@/lib/excel-export';

export default function CourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Bulk Selection & Rectify State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDegreePercent, setBulkDegreePercent] = useState<number>(50);
  const [bulk12thPercent, setBulk12thPercent] = useState<number>(50);
  const [bulkJustPass, setBulkJustPass] = useState<boolean>(false);
  const [bulkUpdating, setBulkUpdating] = useState<boolean>(false);

  // Single-row Edit draft state
  const [draftProgramName, setDraftProgramName] = useState<string>('');
  const [draftFees, setDraftFees] = useState<number>(0);
  const [draftMin12th, setDraftMin12th] = useState<number>(60);
  const [draftMinDegree, setDraftMinDegree] = useState<number>(60);
  const [draftMinIelts, setDraftMinIelts] = useState<number>(6.5);
  const [draftInterview, setDraftInterview] = useState<boolean>(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      if (data.success && data.courses) {
        setCourses(data.courses);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const filtered = courses.filter(
    (c) =>
      c.program_name.toLowerCase().includes(search.toLowerCase()) ||
      c.university?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.university?.country?.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filtered.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filtered.map((c) => c.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
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
                    min_ielts: c.eligibility_rules?.min_ielts ?? 6.0,
                    min_toefl: c.eligibility_rules?.min_toefl ?? 85,
                    interview_required: c.eligibility_rules?.interview_required ?? false,
                    work_experience_months: c.eligibility_rules?.work_experience_months ?? 0,
                  },
                }
              : c
          )
        );
        setActionMessage(
          `Updated ${selectedIds.length} courses to ${bulkJustPass ? 'Just Pass (35%)' : `${targetDegree}%`} in Supabase!`
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
        setCourses((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
        setActionMessage(`Deleted ${selectedIds.length} courses from Supabase.`);
        setSelectedIds([]);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBulkUpdating(false);
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
        setActionMessage('Course deleted from database.');
        setTimeout(() => setActionMessage(null), 3000);
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section id="course-manager" className="glass-card p-6 rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Course Manager &amp; Eligibility Rules
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
              {courses.length} Live Courses
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Filter by university/country, select courses to bulk-rectify percentages, or edit single rows inline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportCoursesToExcel(filtered, 'admin-updated-courses', false)}
            disabled={filtered.length === 0}
            className="neon-btn-emerald px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download all updated courses as Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            Download Excel (.xlsx)
          </button>
          <button
            onClick={fetchCourses}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search university or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* BULK RECTIFY BAR (Appears when courses are checked) */}
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

      {actionMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {actionMessage}
        </div>
      )}

      {loading && (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
          Loading courses from Supabase...
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-white/5 uppercase text-[10px] text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="accent-cyan-600 rounded cursor-pointer"
                    title="Select all matching courses"
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
              {filtered.map((course) => {
                const isEditing = editingCourseId === course.id;
                const isSelected = selectedIds.includes(course.id);

                return (
                  <tr
                    key={course.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/5'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
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
      )}
    </section>
  );
}
