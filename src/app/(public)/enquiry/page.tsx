'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Phone, Mail, MessageCircle } from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mock-data';
import { mergeCountryLists } from '@/lib/countries';
import { BRAND_CONTACT } from '@/lib/seo-content';
import StudentEnquiryForm from '@/components/student-enquiry-form';

export default function EnquiryPage() {
  const [availableCountries, setAvailableCountries] = useState<string[]>(() => {
    const dbCountries: string[] = [];
    MOCK_COURSES.forEach((c) => {
      if (c.university?.country) dbCountries.push(c.university.country);
    });
    return mergeCountryLists(dbCountries);
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/courses?meta=true');
        const data = await res.json();
        if (data.success && Array.isArray(data.countries) && data.countries.length > 0) {
          setAvailableCountries(mergeCountryLists(data.countries));
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

      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Prefer to speak with an Orbis advisor directly?
          </p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
            {BRAND_CONTACT.address}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
          <a
            href={BRAND_CONTACT.phoneHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
            Call {BRAND_CONTACT.phoneDisplay}
          </a>
          <a
            href={BRAND_CONTACT.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
          <a
            href={`mailto:${BRAND_CONTACT.email}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
            {BRAND_CONTACT.email}
          </a>
        </div>
      </div>
    </div>
  );
}
