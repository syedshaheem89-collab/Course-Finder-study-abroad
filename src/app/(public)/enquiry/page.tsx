'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { Course } from '@/types/database';
import StudentEnquiryForm from '@/components/student-enquiry-form';

export default function EnquiryPage() {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);

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

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.university?.country) set.add(c.university.country);
    });
    return Array.from(set).sort();
  }, [courses]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <Link
          href="/courses"
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          Browse All Programmes →
        </Link>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading enquiry form...</div>}>
        <StudentEnquiryForm availableCountries={availableCountries} />
      </Suspense>
    </div>
  );
}
