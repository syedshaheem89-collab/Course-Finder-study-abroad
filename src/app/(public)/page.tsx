'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { COURSE_TYPES, CourseTypeOption } from '@/lib/course-utils';
import { useTheme } from '@/components/theme-provider';

const FEATURED_DESTINATIONS = [
  { country: 'United Kingdom', subtitle: '2-Year Graduate Route · Fast-track 1-yr Masters' },
  { country: 'Germany', subtitle: 'Public tuition from €0 · 18-month job-seeker visa' },
  { country: 'Ireland', subtitle: 'Tech hub · 2-year Stamp 1G post-study stay back' },
  { country: 'Netherlands', subtitle: 'Top global research · 1-year Orientation Year' },
  { country: 'Australia', subtitle: 'Up to 3-year post-study work rights · High salaries' },
  { country: 'Sweden', subtitle: 'Innovation-led Masters · 12-month residence permit' },
  { country: 'Malta', subtitle: 'English-taught EU · MOI accepted & 70% tax rebate' },
  { country: 'Poland', subtitle: 'Affordable EU degrees · Growing tech & business hub' },
  { country: 'Canada', subtitle: 'PGWP work pathway · Permanent residency options' },
];

const FEATURED_SUBJECTS = [
  {
    name: 'Computer Science & AI',
    description: 'Artificial Intelligence, Software Systems, Cybersecurity & Cloud.',
  },
  {
    name: 'Data Science',
    description: 'Machine Learning, Big Data Analytics & Quantitative Computing.',
  },
  {
    name: 'Engineering',
    description: 'Mechanical, Electrical, Sustainable Energy & Logistics Systems.',
  },
  {
    name: 'Business & Management',
    description: 'Global MBA, Finance, Supply Chain & Digital Marketing.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { brandName } = useTheme();
  const [totalCoursesCount, setTotalCoursesCount] = useState<number>(MOCK_COURSES.length);
  const [metaCountries, setMetaCountries] = useState<string[]>(() => {
    const s = new Set<string>();
    MOCK_COURSES.forEach((c) => c.university?.country && s.add(c.university.country));
    return Array.from(s).sort();
  });
  const [metaUniversitiesCount, setMetaUniversitiesCount] = useState<number>(() => {
    const s = new Set<string>();
    MOCK_COURSES.forEach((c) => c.university?.id && s.add(c.university.id));
    return s.size;
  });

  // Hero Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<CourseTypeOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('globalcourse_meta_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.totalCourses === 'number') {
          setTotalCoursesCount(parsed.totalCourses);
          if (Array.isArray(parsed.countries)) setMetaCountries(parsed.countries);
          if (typeof parsed.universitiesCount === 'number') setMetaUniversitiesCount(parsed.universitiesCount);
        }
      }
    } catch {}

    async function loadMeta(attempt = 0) {
      try {
        const res = await fetch('/api/courses?meta=true');
        const data = await res.json();
        if (data.success) {
          const payload = {
            totalCourses: data.totalCourses || 0,
            countries: Array.isArray(data.countries) ? data.countries : [],
            universitiesCount: Array.isArray(data.universities) ? data.universities.length : 0,
          };
          setTotalCoursesCount(payload.totalCourses);
          setMetaCountries(payload.countries);
          setMetaUniversitiesCount(payload.universitiesCount);
          try {
            sessionStorage.setItem('globalcourse_meta_v1', JSON.stringify(payload));
          } catch {}
        }
      } catch (e) {
        if (attempt < 2) {
          setTimeout(() => loadMeta(attempt + 1), 2000);
        }
        console.error('Error loading course metadata:', e);
      }
    }
    loadMeta();
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
    return Array.from(new Set([...metaCountries, ...globalList])).sort();
  }, [metaCountries]);
  const availableUniversitiesCount = metaUniversitiesCount;

  const availableSubjects = [
    'Computer Science & AI',
    'Data Science',
    'Engineering',
    'Business & Management',
  ];

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
    <div className="bg-[#F5F5F7] dark:bg-black transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-20 space-y-14">
        {/* 1. LEFT-ALIGNED APPLE STORE EDITORIAL HERO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
              Study Abroad.{' '}
              <span className="text-[#6E6E73] dark:text-[#A1A1A6]">
                Find the right programme for your future.
              </span>
            </h1>
          </div>

          <div className="text-left md:text-right shrink-0 space-y-0.5">
            <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              Have a student profile ready?
            </p>
            <Link
              href="/enquiry"
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
            >
              <span>Fill Qualification Enquiry</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 2. ELEVATED WHITE SEARCH CONTAINER */}
        <div className="space-y-5">
          <form
            onSubmit={handleSearch}
            className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none space-y-6"
          >
            {/* Prominent Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course name, university, or keyword (e.g. Logistics, MBA, Data Science)..."
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 focus:bg-white dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-[#0071E3]/30 rounded-2xl pl-11 pr-4 py-3.5 text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none transition-all"
              />
            </div>

            {/* 3 Borderless Minimalist Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Course Type */}
              <div className="relative" ref={dropdownRef}>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] mb-1.5 block">
                  Course Type
                </label>
                <button
                  type="button"
                  onClick={() => setTypeDropdownOpen((o) => !o)}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[13px] font-medium flex items-center justify-between cursor-pointer hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] transition-colors"
                >
                  <span className="truncate">
                    {selectedTypes.length === 0
                      ? 'All Course Types'
                      : selectedTypes.length === 1
                      ? selectedTypes[0]
                      : `${selectedTypes.length} types selected`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#6E6E73] shrink-0" />
                </button>

                {typeDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-2xl shadow-xl border border-black/[0.08] dark:border-white/15 z-50 py-2">
                    {COURSE_TYPES.map((type) => {
                      const checked = selectedTypes.includes(type);
                      return (
                        <label
                          key={type}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleCourseType(type);
                          }}
                          className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] cursor-pointer text-[13px] transition-colors"
                        >
                          <span
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-[#0071E3] border-[#0071E3] text-white'
                                : 'border-black/20 dark:border-white/25 bg-white dark:bg-[#2C2C2E]'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span className="font-normal">{type}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Destination Country */}
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] mb-1.5 block">
                  Destination Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
                >
                  <option value="">All Countries</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Group */}
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] mb-1.5 block">
                  Subject Group
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-black/[0.06] dark:border-white/10">
              <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
                {brandName} · Live eligibility cutoffs, MOI waivers &amp; post-study visa data
              </p>

              <button
                type="submit"
                className="w-full sm:w-auto px-7 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[14px] font-medium transition-colors cursor-pointer"
              >
                Search Programmes
              </button>
            </div>
          </form>

          {/* 3. UNDERSTATED HORIZONTAL TRUST STRIP */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 px-2 text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
            <span>
              <strong className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {totalCoursesCount.toLocaleString()}
              </strong>{' '}
              Programmes
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {availableUniversitiesCount.toLocaleString()}
              </strong>{' '}
              Institutions
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {availableCountries.length}
              </strong>{' '}
              Countries
            </span>
          </div>
        </div>

        {/* 4. QUICK BROWSE: DESTINATIONS CAROUSEL (Apple Store Strip) */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              Explore top destinations.{' '}
              <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
                Take a look at accredited study hubs.
              </span>
            </h2>
            <Link
              href="/courses"
              className="text-[13px] font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline shrink-0 inline-flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {FEATURED_DESTINATIONS.map((dest) => (
              <Link
                key={dest.country}
                href={`/courses?country=${encodeURIComponent(dest.country)}`}
                className="min-w-[240px] max-w-[260px] shrink-0 bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-5 group"
              >
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B]">
                    Destination
                  </span>
                  <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors">
                    {dest.country}
                  </h3>
                  <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-snug">
                    {dest.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF]">
                    Explore courses
                  </span>
                  <span className="w-7 h-7 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:bg-[#0071E3] group-hover:text-white transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5. BROWSE BY SUBJECT */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Browse by discipline.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              Compare tuition, intakes &amp; match scores.
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURED_SUBJECTS.map((subj) => (
              <Link
                key={subj.name}
                href={`/courses?subject=${encodeURIComponent(subj.name)}`}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors">
                    {subj.name}
                  </h3>
                  <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                    {subj.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF]">
                  Browse programmes <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
