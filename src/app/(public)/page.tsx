'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  GraduationCap,
  Globe2,
  BookOpen,
  ChevronDown,
  Check
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import { COURSE_TYPES, CourseTypeOption, normalizeCourseType } from '@/lib/course-utils';
import StudentEnquiryForm from '@/components/student-enquiry-form';

export default function HomePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);

  // Hero Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<CourseTypeOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
        }
      } catch (e) {
        console.error('Error loading courses:', e);
      }
    }
    loadCourses();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live counts per Course Type (just like Screenshot 3)
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

  // Live preview count matching hero selections
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
    <div>
      {/* 1. CLEAN DAAD-STYLE HERO SEARCH BANNER */}
      <section className="relative bg-gradient-to-r from-[#0a3154] via-[#0d416e] to-[#0a3154] text-white py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide uppercase text-white">
            International Programmes 2026 / 2027
          </h1>
          <p className="text-sm sm:text-base text-sky-100 font-medium">
            {courses.length} Programmes available across {availableCountries.length} Countries
          </p>
        </div>

        {/* Search Box Container */}
        <form
          onSubmit={handleSearch}
          className="max-w-5xl mx-auto bg-[#072642]/90 border border-white/15 rounded-lg p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4"
        >
          <p className="text-center text-sm font-medium text-sky-100">
            Choose your programme!
          </p>

          {/* Top Full-Width Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-sky-200 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search course name, university, or keyword..."
              className="w-full bg-transparent border border-white/40 focus:border-white rounded px-10 py-2.5 text-sm text-white placeholder-sky-200/70 focus:outline-none"
            />
          </div>

          {/* 3 Dropdowns Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* 1. COURSE TYPE (Checkbox Multi-Select Dropdown like Screenshot 3) */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-sky-100 mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Course Type
              </label>
              <button
                type="button"
                onClick={() => setTypeDropdownOpen((o) => !o)}
                className="w-full bg-white text-slate-800 rounded px-3 py-2 text-xs font-medium flex items-center justify-between cursor-pointer border border-slate-300"
              >
                <span className="truncate">
                  {selectedTypes.length === 0
                    ? 'Please select'
                    : selectedTypes.length === 1
                    ? selectedTypes[0]
                    : `${selectedTypes.length} options chosen`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
              </button>

              {typeDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white text-slate-800 rounded shadow-xl border border-slate-200 z-50 py-1.5">
                  {COURSE_TYPES.map((type) => {
                    const checked = selectedTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex items-center justify-between px-3 py-2 hover:bg-sky-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              toggleCourseType(type);
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              checked
                                ? 'bg-sky-700 border-sky-700 text-white'
                                : 'border-slate-400 bg-white'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              toggleCourseType(type);
                            }}
                            className="font-medium text-slate-800"
                          >
                            {type} ({typeCounts[type] || 0})
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. DESTINATION COUNTRY */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-sky-100 mb-1.5 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5" /> Destination Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-white text-slate-800 rounded px-3 py-2 text-xs font-medium border border-slate-300 focus:outline-none"
              >
                <option value="">Please select</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SUBJECT GROUPS */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-sky-100 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Subject Groups
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-white text-slate-800 rounded px-3 py-2 text-xs font-medium border border-slate-300 focus:outline-none"
              >
                <option value="">Please select</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Button & Live Match Count */}
          <div className="flex items-center justify-end gap-4 pt-2">
            <span className="text-xs text-sky-100">
              <strong>{matchingCount}</strong> programmes available
            </span>
            <button
              type="submit"
              className="bg-white hover:bg-sky-50 text-[#0a3154] px-6 py-2 rounded text-xs font-bold uppercase tracking-wider shadow cursor-pointer transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {/* 2. CLEAN STAT BAR (Like Screenshot 1) */}
      <section className="bg-[#4b4f54] dark:bg-[#111622] text-white py-6 px-4 border-b border-slate-300 dark:border-white/10">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-white/40 text-lg font-bold">
              {availableCountries.length}
            </span>
            <span className="text-xs text-slate-200 mt-1.5">Countries</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-white/40 text-lg font-bold">
              {availableUniversitiesCount}
            </span>
            <span className="text-xs text-slate-200 mt-1.5">Participating institutions</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-white/40 text-lg font-bold">
              {courses.length}
            </span>
            <span className="text-xs text-slate-200 mt-1.5">Programmes</span>
          </div>
        </div>
      </section>

      {/* 3. STUDENT & COUNSELOR QUALIFICATION ENQUIRY FORM */}
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <StudentEnquiryForm availableCountries={availableCountries} />
      </div>
    </div>
  );
}
