'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  GraduationCap,
  Globe2,
  BookOpen,
  ChevronDown,
  Check,
  Sparkles,
  ArrowRight,
  ClipboardList,
  Building2
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import { COURSE_TYPES, CourseTypeOption, normalizeCourseType } from '@/lib/course-utils';
import { useTheme } from '@/components/theme-provider';

export default function HomePage() {
  const router = useRouter();
  const { brandName } = useTheme();
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);

  // Hero Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<CourseTypeOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('globalcourse_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCourses(parsed);
        }
      }
    } catch {}

    async function loadCourses(attempt = 0) {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          try {
            sessionStorage.setItem('globalcourse_cache_v1', JSON.stringify(data.courses));
          } catch {}
        }
      } catch (e) {
        if (attempt < 2) {
          setTimeout(() => loadCourses(attempt + 1), 2000);
        }
        console.error('Error loading courses:', e);
      }
    }
    loadCourses();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.university?.country) set.add(c.university.country);
    });
    return Array.from(set).sort();
  }, [courses]);

  const availableUniversitiesCount = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.university?.id) set.add(c.university.id);
    });
    return set.size;
  }, [courses]);

  const availableSubjects = [
    'Computer Science & AI',
    'Data Science',
    'Engineering',
    'Business & Management',
  ];

  const matchingCount = useMemo(() => {
    return courses.filter((c) => {
      if (
        searchQuery &&
        !c.program_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.university?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeCourseType(c))) {
        return false;
      }
      if (selectedCountry && c.university?.country !== selectedCountry) {
        return false;
      }
      if (selectedSubject && c.category !== selectedSubject) {
        return false;
      }
      return true;
    }).length;
  }, [courses, searchQuery, selectedTypes, selectedCountry, selectedSubject]);

  const toggleCourseType = (type: CourseTypeOption) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedSubject) params.set('subject', selectedSubject);
    router.push(`/courses?${params.toString()}`);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Subtle 2026 Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[780px] h-[360px] bg-gradient-to-tr from-cyan-500/15 via-sky-500/10 to-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 relative z-10 space-y-10">
        {/* 1. CLEAN 2026 HERO TITLE */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{brandName} • 2026 / 2027 Programmes</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Find Your Ideal{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 dark:from-cyan-400 dark:via-sky-300 dark:to-indigo-400 bg-clip-text text-transparent">
              Study Programme
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Search <strong className="text-slate-900 dark:text-white">{courses.length}</strong> accredited courses across{' '}
            <strong className="text-slate-900 dark:text-white">{availableCountries.length}</strong> countries with live eligibility &amp; MOI rules.
          </p>
        </div>

        {/* 2. MODERN 2026 SEARCH CARD (DAAD Format, 2026 UI) */}
        <form
          onSubmit={handleSearch}
          className="glass-card rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl shadow-slate-200/60 dark:shadow-cyan-950/20"
        >
          {/* Main Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course name, university, or keyword (e.g. Logistics, MBA, AI)..."
              className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>

          {/* 3 Clean Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. COURSE TYPE (Multi-select checkboxes) */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Course Type
              </label>
              <button
                type="button"
                onClick={() => setTypeDropdownOpen((o) => !o)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between cursor-pointer border border-slate-300 dark:border-white/15 hover:border-cyan-500/50 transition-colors"
              >
                <span className="truncate">
                  {selectedTypes.length === 0
                    ? 'All Course Types'
                    : selectedTypes.length === 1
                    ? selectedTypes[0]
                    : `${selectedTypes.length} types selected`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {typeDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#0f1420] text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/15 z-50 py-2">
                  {COURSE_TYPES.map((type) => {
                    const checked = selectedTypes.includes(type);
                    return (
                      <label
                        key={type}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleCourseType(type);
                        }}
                        className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-cyan-600 border-cyan-600 text-white'
                                : 'border-slate-300 dark:border-white/25 bg-white dark:bg-slate-900'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span className="font-medium">{type}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          ({typeCounts[type] || 0})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. DESTINATION COUNTRY */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Destination Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold border border-slate-300 dark:border-white/15 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Countries</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SUBJECT GROUP */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-purple-400" /> Subject Group
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold border border-slate-300 dark:border-white/15 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200/80 dark:border-white/10">
            <Link
              href="/enquiry"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
              Have a student profile? Fill Qualification Enquiry Form →
            </Link>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-cyan-600 dark:text-cyan-400">{matchingCount}</strong> programmes found
              </span>
              <button
                type="submit"
                className="neon-btn-cyan px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <span>Search Programmes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* 3. CLEAN 2026 STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white block leading-none">
                {availableCountries.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                Destination Countries
              </span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-purple-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white block leading-none">
                {availableUniversitiesCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                Participating Institutions
              </span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white block leading-none">
                {courses.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                Available Programmes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
