'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Building2,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Course } from '@/types/database';

export default function CourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Edit draft state
  const [draftProgramName, setDraftProgramName] = useState<string>('');
  const [draftFees, setDraftFees] = useState<number>(0);
  const [draftMin12th, setDraftMin12th] = useState<number>(60);
  const [draftMinDegree, setDraftMinDegree] = useState<number>(60);
  const [draftMinIelts, setDraftMinIelts] = useState<number>(6.5);
  const [draftInterview, setDraftInterview] = useState<boolean>(false);

  // Fetch live courses from Supabase
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

  // Real PUT to Supabase
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
        setActionMessage('Course successfully updated in Supabase!');
        setTimeout(() => setActionMessage(null), 3000);
        // Update local state
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

  // Real DELETE from Supabase
  const deleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to permanently delete this course from Supabase?')) {
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

  const filtered = courses.filter(
    (c) =>
      c.program_name.toLowerCase().includes(search.toLowerCase()) ||
      c.university?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section id="course-manager" className="glass-card p-6 rounded-2xl space-y-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Course Manager & Eligibility Rules Editor
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Supabase ({courses.length} courses)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Edit tuition, admission cutoffs, or delete courses directly with live database synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCourses}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {actionMessage}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          Loading database courses...
        </div>
      )}

      {/* Data Table */}
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] text-slate-400 tracking-wider border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Program & University</th>
                <th className="px-3 py-3">Fees (EUR)</th>
                <th className="px-3 py-3">Min Degree %</th>
                <th className="px-3 py-3">Min 12th %</th>
                <th className="px-3 py-3">Min IELTS</th>
                <th className="px-3 py-3">Interview</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((course) => {
                const isEditing = editingCourseId === course.id;

                return (
                  <tr key={course.id} className="hover:bg-white/5 transition-colors">
                    {/* Program and University */}
                    <td className="px-4 py-3 max-w-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draftProgramName}
                          onChange={(e) => setDraftProgramName(e.target.value)}
                          className="w-full bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white mb-1"
                        />
                      ) : (
                        <span className="font-semibold text-white block truncate">{course.program_name}</span>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {course.university?.name} ({course.university?.country})
                      </span>
                    </td>

                    {/* Fees */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draftFees}
                          onChange={(e) => setDraftFees(Number(e.target.value))}
                          className="w-20 bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span className="font-medium text-emerald-400">
                          {course.tuition_fees_eur === 0 ? '€0' : `€${course.tuition_fees_eur.toLocaleString()}`}
                        </span>
                      )}
                    </td>

                    {/* Min Degree % */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draftMinDegree}
                          onChange={(e) => setDraftMinDegree(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span>{course.eligibility_rules?.min_degree_percent || 60}%</span>
                      )}
                    </td>

                    {/* Min 12th % */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draftMin12th}
                          onChange={(e) => setDraftMin12th(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span>{course.eligibility_rules?.min_12th_percent || 60}%</span>
                      )}
                    </td>

                    {/* Min IELTS */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={draftMinIelts}
                          onChange={(e) => setDraftMinIelts(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span className="font-bold text-cyan-400">
                          {course.eligibility_rules?.min_ielts || 6.5}
                        </span>
                      )}
                    </td>

                    {/* Interview Required */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={draftInterview}
                          onChange={(e) => setDraftInterview(e.target.checked)}
                          className="accent-cyan-400 cursor-pointer"
                        />
                      ) : course.eligibility_rules?.interview_required ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                          Required
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Waived</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => saveEdit(course.id)}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            title="Save Changes to Database"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(course)}
                            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 transition-colors"
                            title="Edit Course in Supabase"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteCourse(course.id)}
                            className="p-1.5 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Course from Supabase"
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
