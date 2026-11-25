'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import StudentEnquiryForm from '@/components/student-enquiry-form';

export default function EnquiryPage() {
  const [availableCountries, setAvailableCountries] = useState<string[]>(() => {
    const set = new Set<string>();
    MOCK_COURSES.forEach((c) => {
      if (c.university?.country) set.add(c.university.country);
    });
    return Array.from(set).sort();
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/courses?meta=true');
        const data = await res.json();
        if (data.success && Array.isArray(data.countries) && data.countries.length > 0) {
          setAvailableCountries(data.countries);
        }
      } catch (e) {
        console.error('Error loading countries:', e);
      }
    }
    loadMeta();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between text-[12px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-0.5 font-medium text-[#0071E3] dark:text-[#2997FF] hover:underline"
        >
          Browse All Programmes
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-10 text-center text-[13px] text-[#6E6E73]">
            Loading qualification form...
          </div>
        }
      >
        <StudentEnquiryForm availableCountries={availableCountries} />
      </Suspense>
    </div>
  );
}
