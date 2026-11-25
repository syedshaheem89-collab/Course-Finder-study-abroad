'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Globe,
  ShieldCheck,
  GraduationCap,
  Compass,
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { COURSE_TYPES, CourseTypeOption } from '@/lib/course-utils';
import { mergeCountryLists } from '@/lib/countries';
import { SectorFilter, SUBJECT_GROUPS } from '@/lib/university-classification';
import { trackAnalyticsEvent } from '@/lib/analytics-tracker';
import { useTheme } from '@/components/theme-provider';
import { getDestinationImage, HELP_IMAGES } from '@/lib/destination-media';
import {
  HOMEPAGE_FAQS,
  HOW_IT_WORKS_STEPS,
  SEO_DESTINATION_GUIDES,
} from '@/lib/seo-content';

const FEATURED_DESTINATIONS = [
  {
    country: 'United Kingdom',
    subtitle: '18-Month Standard Post-Study · Fast-track 1-yr Masters',
    image: '/images/dest-uk.jpg',
    dark: true,
  },
  {
    country: 'Germany',
    subtitle: 'Public tuition from €0 · 18-month job-seeker visa',
    image: '/images/dest-germany.jpg',
    dark: false,
  },
  {
    country: 'Sweden',
    subtitle: 'Innovation-led Masters · 12-month residence permit',
    image: '/images/dest-sweden.jpg',
    dark: false,
  },
  {
    country: 'Ireland',
    subtitle: 'Tech hub · 2-year Stamp 1G post-study stay back',
    image: '/images/dest-ireland.jpg',
    dark: true,
  },
  {
    country: 'Netherlands',
    subtitle: 'Top global research · 1-year Orientation Year',
    image: '/images/dest-netherlands.jpg',
    dark: false,
  },
  {
    country: 'Australia',
    subtitle: '2–3 yr Subclass 485 stay-back · Global research',
    image: '/images/dest-australia.jpg',
    dark: false,
  },
  {
    country: 'Canada',
    subtitle: 'Up to 3-yr PGWP · Permanent residency pathways',
    image: '/images/dest-canada.jpg',
    dark: true,
  },
  {
    country: 'Poland',
    subtitle: 'Affordable EU degrees · 9-month stay-back permit',
    image: '/images/dest-poland.jpg',
    dark: false,
  },
  {
    country: 'Malta',
    subtitle: '9-month search · MOI accepted & 70% tax rebate',
    image: '/images/dest-malta.jpg',
    dark: false,
  },
];

const QUICK_DESTINATIONS = [
  'United Kingdom',
  'Germany',
  'Ireland',
  'Netherlands',
  'Sweden',
  'Australia',
  'Canada',
  'Poland',
  'Malta',
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
  const [selectedSector, setSelectedSector] = useState<SectorFilter>('all');
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
    return mergeCountryLists(metaCountries);
  }, [metaCountries]);
  const availableUniversitiesCount = metaUniversitiesCount;

  const availableSubjects = SUBJECT_GROUPS;

  const toggleCourseType = (type: CourseTypeOption) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    trackAnalyticsEvent({
      event_type: 'search',
      country: selectedCountry,
      query: searchQuery.trim(),
      degree_level: selectedTypes.join(', '),
      subject: selectedSubject,
    });
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    if (selectedSector !== 'all') params.set('sector', selectedSector);
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedSubject) params.set('subject', selectedSubject);
    router.push(`/courses?${params.toString()}`);
  };

  const homeFaqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOMEPAGE_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return (
    <div className="bg-[#F5F5F7] dark:bg-black transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-16 pb-16 sm:pb-20 space-y-10 sm:space-y-14">
        {/* 1. LEFT-ALIGNED APPLE STORE EDITORIAL HERO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div className="max-w-3xl">
            <h1 className="text-[34px] sm:text-5xl lg:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
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
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline"
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
            className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 sm:p-8 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none space-y-5 sm:space-y-6"
          >
            {/* Prominent Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course name, university, or keyword (e.g. Logistics, MBA, Data Science)..."
                className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-0 focus:bg-white dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-[#0071E3]/30 rounded-2xl pl-11 pr-4 py-3 sm:py-3.5 text-[16px] sm:text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none transition-all"
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
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 min-h-[44px] text-[15px] sm:text-[13px] font-medium flex items-center justify-between cursor-pointer hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] transition-colors"
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
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 min-h-[44px] text-[15px] sm:text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-3.5 py-2.5 min-h-[44px] text-[15px] sm:text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
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
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="inline-flex rounded-full bg-[#E5E5EA]/75 dark:bg-[#2C2C2E] p-1 text-[12px] font-medium">
                  {(['all', 'Public', 'Private'] as const).map((sec) => {
                    const active = selectedSector === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedSector(sec)}
                        className={`px-3 py-1 rounded-full cursor-pointer transition-all ${
                          active
                            ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                            : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                        }`}
                      >
                        {sec === 'all' ? 'All Unis' : sec}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
                  {brandName} · Verified 2026 eligibility cutoffs, MOI waivers &amp; post-study stay-back rules
                </p>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-7 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[14px] font-medium transition-colors cursor-pointer shrink-0"
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

        {/* 4. APPLE STORE DESTINATION ICON STRIP */}
        <section className="space-y-3">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 no-scrollbar">
            {QUICK_DESTINATIONS.map((c) => (
              <Link
                key={c}
                href={`/courses?country=${encodeURIComponent(c)}`}
                onClick={() => trackAnalyticsEvent({ event_type: 'country_select', country: c })}
                className="group shrink-0 snap-start flex flex-col items-center gap-2 w-22 sm:w-24 text-center"
              >
                <div className="w-20 h-14 rounded-2xl overflow-hidden bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.03)] group-hover:scale-105 transition-transform">
                  <img
                    src={getDestinationImage(c)}
                    alt={`${c} university hub`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] leading-tight transition-colors">
                  {c}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 5. QUICK BROWSE: DESTINATIONS SHOWCASE (Apple Store Photo Cards) */}
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
              className="text-[13px] font-medium text-[#0066CC] dark:text-[#2997FF] hover:underline shrink-0 inline-flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 no-scrollbar">
            {FEATURED_DESTINATIONS.map((dest) => (
              <Link
                key={dest.country}
                href={`/courses?country=${encodeURIComponent(dest.country)}`}
                onClick={() =>
                  trackAnalyticsEvent({ event_type: 'country_select', country: dest.country })
                }
                className={`min-w-[80vw] max-w-[84vw] sm:min-w-[270px] sm:max-w-[290px] snap-start shrink-0 rounded-3xl overflow-hidden border transition-all flex flex-col justify-between min-h-[330px] sm:min-h-[340px] hover:-translate-y-0.5 group ${
                  dest.dark
                    ? 'bg-[#1D1D1F] text-white border-black/20 shadow-[0_8px_28px_rgba(0,0,0,0.12)]'
                    : 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
                }`}
              >
                <div className="p-6 pb-4 space-y-1.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider block ${
                      dest.dark ? 'text-[#A1A1A6]' : 'text-[#6E6E73] dark:text-[#86868B]'
                    }`}
                  >
                    2026 Destination
                  </span>
                  <h3 className="text-[21px] font-semibold tracking-[-0.02em] leading-tight">
                    {dest.country}
                  </h3>
                  <p
                    className={`text-[13px] leading-snug ${
                      dest.dark ? 'text-[#D1D1D6]' : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                    }`}
                  >
                    {dest.subtitle}
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span
                      className={`text-[12px] font-medium group-hover:underline ${
                        dest.dark ? 'text-[#2997FF]' : 'text-[#0066CC] dark:text-[#2997FF]'
                      }`}
                    >
                      Explore courses
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        dest.dark
                          ? 'bg-white/10 text-white group-hover:bg-[#0071E3]'
                          : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:bg-[#0071E3] group-hover:text-white'
                      }`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
                <div className="relative h-44 w-full overflow-hidden mt-auto">
                  <img
                    src={dest.image}
                    alt={`${dest.country} university campus`}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 6. THE PLATFORM DIFFERENCE (Apple Store Difference Strip) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            The {brandName} difference.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              Verified data for every step.
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Globe,
                title: 'Verified 2026 stay-back & visa rules.',
                highlight: 'Updated 2026',
                href: '/news',
              },
              {
                icon: GraduationCap,
                title: 'Filter by Public or Private sector.',
                highlight: 'Public & Private',
                href: '/courses?sector=Public',
              },
              {
                icon: ShieldCheck,
                title: 'Check MOI & IELTS eligibility fit.',
                highlight: 'Instant Match %',
                href: '/courses',
              },
              {
                icon: Compass,
                title: 'Get 12 tailored programme options.',
                highlight: 'AI Shortlist',
                href: '/enquiry',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-5 group"
                >
                  <div className="space-y-3">
                    <Icon className="w-6 h-6 text-[#0066CC] dark:text-[#2997FF]" />
                    <p className="text-[17px] font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                      <span className="text-[#0066CC] dark:text-[#2997FF]">{item.highlight}.</span>{' '}
                      {item.title}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <span className="w-7 h-7 rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:bg-[#0071E3] group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 7. HELP IS HERE (3 Photographic Support Cards) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Help is here.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              Whenever and however you need it.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                eyebrow: 'QUALIFICATION ENQUIRY',
                title: 'Get a personalized 12-course AI shortlist.',
                href: '/enquiry',
                image: HELP_IMAGES.counselor,
                alt: 'Academic counselor helping student',
              },
              {
                eyebrow: 'COMPARE & SHORTLIST',
                title: 'Side-by-side tuition, MOI & salary check.',
                href: '/courses',
                image: HELP_IMAGES.students,
                alt: 'Students comparing study abroad options',
              },
              {
                eyebrow: '2026 VISA BRIEFINGS',
                title: 'Official show money & stay-back updates.',
                href: '/news',
                image: HELP_IMAGES.guide,
                alt: 'Study abroad visa and planning guide',
              },
            ].map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between"
              >
                <div className="p-6 pb-4 space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] block">
                    {card.eyebrow}
                  </span>
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] transition-colors leading-snug">
                    {card.title}
                  </h3>
                </div>
                <div className="relative h-48 w-full overflow-hidden mt-auto">
                  <img
                    src={card.image}
                    alt={card.alt}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 8. BROWSE BY SUBJECT */}
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
                onClick={() => trackAnalyticsEvent({ event_type: 'search', subject: subj.name })}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] transition-colors">
                    {subj.name}
                  </h3>
                  <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                    {subj.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#0066CC] dark:text-[#2997FF]">
                  Browse programmes <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 9. HOW IT WORKS (3 Clear Steps) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            How it works.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              From shortlisting to 2026 visa clarity.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div
                key={item.step}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-2.5"
              >
                <span className="text-[11px] font-semibold tracking-wider text-[#0066CC] dark:text-[#2997FF]">
                  STEP {item.step}
                </span>
                <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {item.title}
                </h3>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 10. 2026 COUNTRY STUDY GUIDES (SEO Internal Discovery) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            2026 Country Study Guides.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              Tuition benchmarks, MOI policies &amp; stay-back visas.
            </span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SEO_DESTINATION_GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/study-in/${g.slug}`}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl px-4 py-3.5 border border-black/[0.06] dark:border-white/10 hover:border-[#0066CC]/40 dark:hover:border-[#2997FF]/40 transition-colors flex items-center justify-between gap-2 group"
              >
                <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] truncate transition-colors">
                  Study in {g.country}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* 11. FREQUENTLY ASKED QUESTIONS (FAQPage SEO) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Frequently asked questions.{' '}
            <span className="text-[#6E6E73] dark:text-[#A1A1A6] font-normal">
              Everything students ask before applying.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {HOMEPAGE_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.06] dark:border-white/10 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none"
              >
                <summary className="flex items-center justify-between gap-3 font-semibold text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer list-none">
                  <span>{faq.question}</span>
                  <ChevronDown className="w-4 h-4 text-[#6E6E73] shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/10 text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
