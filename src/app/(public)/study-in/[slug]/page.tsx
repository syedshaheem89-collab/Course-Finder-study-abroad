import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronRight,
  Clock,
  Wallet,
  Briefcase,
  Calendar,
  Building2,
  CheckCircle2,
  FileCheck2,
  Award,
  ArrowRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  DEFAULT_BRAND_NAME,
  SEO_DESTINATION_GUIDES,
  SITE_URL,
  getAllDestinationSlugs,
  getDestinationGuideBySlug,
} from '@/lib/seo-content';
import { formatStayBack, getCountryVisaIntel } from '@/lib/country-visa-intel';
import { getLivePolicyStoreCached } from '@/lib/live-policy-store';
import {
  findLiveCountryOverride,
  mergeCountryVisaIntel,
  mergeLivingCostGuide,
} from '@/lib/live-policy-types';
import {
  formatCurrencyAmount,
  getCountryBillingCurrency,
  getCountryChecklist,
  getEndToEndJourney,
  getLivingCostGuide,
  getScholarshipInfo,
} from '@/lib/student-guides';
import { getDestinationImage, getExactDestinationImage } from '@/lib/destination-media';

export function generateStaticParams() {
  return getAllDestinationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getDestinationGuideBySlug(slug);
  if (!guide) {
    return {
      title: 'Study Abroad Destination Guide',
      robots: { index: false, follow: false },
    };
  }

  const image = getDestinationImage(guide.country);
  const canonicalUrl = `${SITE_URL}/study-in/${guide.slug}`;

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    alternates: {
      canonical: `/study-in/${guide.slug}`,
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      siteName: DEFAULT_BRAND_NAME,
      title: guide.metaTitle,
      description: guide.metaDescription,
      images: [
        {
          url: image,
          width: 1200,
          height: 675,
          alt: `${guide.country} university campus study guide`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.metaTitle,
      description: guide.metaDescription,
      images: [image],
    },
  };
}

export default async function DestinationStudyGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getDestinationGuideBySlug(slug);
  if (!guide) notFound();

  const liveStore = await getLivePolicyStoreCached();
  const liveOverride = findLiveCountryOverride(liveStore.countryOverrides, guide.country);
  const visaIntel = mergeCountryVisaIntel(
    getCountryVisaIntel(guide.country, 'Master'),
    liveOverride,
    'Master'
  );
  const bachelorVisa = mergeCountryVisaIntel(
    getCountryVisaIntel(guide.country, 'Bachelor'),
    liveOverride,
    'Bachelor'
  );
  const livingGuide = mergeLivingCostGuide(getLivingCostGuide(guide.country), liveOverride);
  const checklist = getCountryChecklist(guide.country);
  const journey = getEndToEndJourney(guide.country, true);
  const scholarship = getScholarshipInfo(
    {
      program_name: '',
      tuition_fees_eur: 10000,
      university: { country: guide.country },
    } as any,
    'Public'
  );
  const heroImage = getExactDestinationImage(guide.country);
  const siblingGuides = SEO_DESTINATION_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 8);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Programme Directory',
        item: `${SITE_URL}/courses`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `Study in ${guide.country}`,
        item: `${SITE_URL}/study-in/${guide.slug}`,
      },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="bg-[#F5F5F7] dark:bg-black transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 space-y-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
          <Link href="/" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/courses" className="hover:text-[#0066CC] dark:hover:text-[#2997FF] transition-colors">
            Programme Directory
          </Link>
          <span>/</span>
          <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
            Study in {guide.country}
          </span>
        </nav>

        {/* Split Apple Editorial Hero */}
        <header className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden border border-black/[0.06] dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none grid grid-cols-1 lg:grid-cols-12">
          <div className={`${heroImage ? 'lg:col-span-7' : 'lg:col-span-12'} p-7 sm:p-10 flex flex-col justify-between gap-6`}>
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066CC] dark:text-[#2997FF] block">
                {guide.heroEyebrow}
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
                {guide.heroHeadline}
              </h1>
              <p className="text-[15px] sm:text-[16px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed max-w-2xl">
                {guide.heroSubheadline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/courses?country=${encodeURIComponent(guide.country)}`}
                className="px-6 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#40A9FF] text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Browse {guide.country} Programmes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/enquiry?country=${encodeURIComponent(guide.country)}`}
                className="px-6 py-2.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] text-[13px] font-medium inline-flex items-center gap-1 transition-colors"
              >
                <span>Get Free 12-Course Shortlist</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {heroImage && (
            <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-[340px] bg-[#F5F5F7] dark:bg-[#2C2C2E]">
              <img
                src={heroImage}
                alt={`${guide.country} higher education university architecture`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </header>

        {/* 4-Card 2026 Verified Figures Grid */}
        <section aria-label="2026 Official Country Benchmarks" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
              2026 Stay-Back Permit
            </span>
            <p className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {formatStayBack(visaIntel.stayBackYears)}
            </p>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
              {visaIntel.stayBackYears <= 0
                ? 'All degree levels · Employer work permit required'
                : `Master level${bachelorVisa.stayBackYears !== visaIntel.stayBackYears ? ` · Bachelor: ${formatStayBack(bachelorVisa.stayBackYears)}` : ''}`}
            </p>
            {liveOverride?.lastVerifiedAt && (
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#E8F8EE] dark:bg-[#34C759]/15 text-[#1D7A39] dark:text-[#34C759]">
                Live Verified {new Date(liveOverride.lastVerifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {(() => {
            const nativeBilling = getCountryBillingCurrency(guide.country);
            const isNonEur = nativeBilling.code !== 'EUR';
            const localLiving = formatCurrencyAmount(livingGuide.amountEur, 'LOCAL', false, undefined, { country: guide.country });
            const localSalary = formatCurrencyAmount(visaIntel.avgSalaryEur, 'LOCAL', false, undefined, { country: guide.country });
            return (
              <>
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
                    Living Funds Proof
                  </span>
                  <p className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    ~{localLiving} / yr{isNonEur ? ` (~€${livingGuide.amountEur.toLocaleString()})` : ''}
                  </p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] line-clamp-2">
                    {livingGuide.note}
                  </p>
                </div>

                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
                    Avg Graduate Salary
                  </span>
                  <p className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    ~{localSalary} / yr{isNonEur ? ` (~€${visaIntel.avgSalaryEur.toLocaleString()})` : ''}
                  </p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                    Early-career baseline ({nativeBilling.code}) across STEM &amp; business roles
                  </p>
                </div>
              </>
            );
          })()}

          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0066CC] dark:text-[#2997FF]" />
              Application Windows
            </span>
            <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug pt-0.5">
              {checklist.deadlineWindow}
            </p>
          </div>
        </section>

        {/* Overview & Official Policy Summary */}
        <section className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 sm:p-9 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-5">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Why international students choose {guide.country} in 2026
          </h2>
          <div className="space-y-4 text-[15px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
            {guide.editorialOverview.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-start gap-3 text-[13px]">
            <Info className="w-4 h-4 text-[#0066CC] dark:text-[#2997FF] shrink-0 mt-0.5" />
            <p className="text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
              <strong className="font-semibold">Official 2026 Stay-Back Benchmark: </strong>
              <span className="text-[#6E6E73] dark:text-[#A1A1A6]">{visaIntel.visaSummary}</span>
            </p>
          </div>
        </section>

        {/* Two-Column Public vs Private + English & MOI Policy */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0066CC] dark:text-[#2997FF]" />
                Public vs. Private Universities
              </h2>
              <p className="text-[14px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                {guide.publicVsPrivateSummary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                href={`/courses?country=${encodeURIComponent(guide.country)}&sector=Public`}
                className="px-4 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
              >
                Filter Public Universities →
              </Link>
              <Link
                href={`/courses?country=${encodeURIComponent(guide.country)}&sector=Private`}
                className="px-4 py-2 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
              >
                Filter Private Colleges →
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#0066CC] dark:text-[#2997FF]" />
                English &amp; MOI Admission Policy
              </h2>
              <p className="text-[14px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                {guide.englishAndMoiPolicy}
              </p>
            </div>
            {scholarship.hasScholarship && (
              <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066CC] dark:text-[#2997FF] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Scholarships — {scholarship.badge}
                </span>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">{scholarship.detail}</p>
              </div>
            )}
          </div>
        </section>

        {/* Featured Accredited Universities & Top Subjects */}
        <section className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 sm:p-9 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              Featured Institutions &amp; High-Demand Fields in {guide.country}
            </h2>
            <p className="text-[14px] text-[#6E6E73] dark:text-[#A1A1A6]">
              Select any institution or discipline to explore live tuition, intakes, and cutoffs inside the directory.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {guide.featuredUniversities.map((uni) => (
              <Link
                key={uni.name}
                href={`/courses?country=${encodeURIComponent(guide.country)}&q=${encodeURIComponent(uni.name.split('(')[0].trim())}`}
                className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#2997FF] truncate transition-colors">
                    {uni.name}
                  </p>
                  <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
                    {uni.sector} University
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#86868B] shrink-0" />
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#86868B]">
              Popular Study Subjects
            </h3>
            <div className="flex flex-wrap gap-2">
              {guide.topSubjects.map((subject) => (
                <Link
                  key={subject}
                  href={`/courses?country=${encodeURIComponent(guide.country)}&q=${encodeURIComponent(subject.split('&')[0].trim())}`}
                  className="px-3.5 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:text-[#0066CC] dark:hover:text-[#2997FF] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
                >
                  {subject}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 6-Step Roadmap & Document Checklist */}
        <section className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 sm:p-9 border border-black/[0.06] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none space-y-6">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Admission &amp; Visa Roadmap for {guide.country}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {journey.steps.map((s) => (
              <div key={s.step} className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1">
                <span className="text-[11px] font-semibold text-[#0066CC] dark:text-[#2997FF]">
                  STEP {s.step}
                </span>
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {s.title}
                </p>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">{s.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2.5">
              <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Admission Documents Required
              </h3>
              <ul className="space-y-2 text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
                {journey.admissionDocs.map((doc, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0066CC] dark:text-[#2997FF] shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2.5">
              <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                2026 Student Visa Checklist
              </h3>
              <ul className="space-y-2 text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
                {checklist.docs.map((doc, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0066CC] dark:text-[#2997FF] shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Frequently asked questions about studying in {guide.country}.
          </h2>
          <div className="space-y-3">
            {guide.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.06] dark:border-white/10 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none"
              >
                <summary className="flex items-center justify-between gap-4 font-semibold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer list-none">
                  <span>{faq.question}</span>
                  <ChevronDown className="w-4 h-4 text-[#6E6E73] shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/10 text-[14px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Internal SEO Discovery Links & Final CTA */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
            Explore more 2026 study destination guides
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblingGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/study-in/${g.slug}`}
                className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 hover:text-[#0066CC] dark:hover:text-[#2997FF] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
              >
                Study in {g.country}
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-[#1D1D1F] text-white rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2997FF]">
              Free 30-Second Matcher
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
              Ready to see which {guide.country} universities fit your marks?
            </h2>
            <p className="text-[14px] text-[#D1D1D6]">
              Check your exact percentage, backlogs, MOI/IELTS, and budget to receive a shortlist of up to 12 matching Public and Private options.
            </p>
          </div>
          <Link
            href={`/enquiry?country=${encodeURIComponent(guide.country)}`}
            className="px-6 py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium inline-flex items-center gap-2 shrink-0 self-start md:self-auto transition-colors"
          >
            <span>Check My {guide.country} Eligibility</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </article>
    </div>
  );
}
