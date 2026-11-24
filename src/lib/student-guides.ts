import { Course } from '@/types/database';

export type CurrencyCode = 'EUR' | 'INR';

export const EUR_TO_INR = 92;

export function formatCurrencyAmount(
  eurAmount: number,
  currency: CurrencyCode,
  isTuition = false
): string {
  if (eurAmount === 0 && isTuition) {
    return currency === 'EUR' ? 'Free (€0)' : 'Free (₹0)';
  }
  if (currency === 'EUR') {
    return `€${eurAmount.toLocaleString()}`;
  }
  const inr = Math.round(eurAmount * EUR_TO_INR);
  if (inr >= 100000) {
    const lakhs = (inr / 100000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return `₹${lakhs}L`;
  }
  return `₹${inr.toLocaleString('en-IN')}`;
}

const LIVING_COST_BY_COUNTRY: Record<string, { amountEur: number; note: string }> = {
  Germany: { amountEur: 11904, note: 'Show Money: Blocked Account (Sperrkonto) €992/mo' },
  Malta: { amountEur: 8000, note: 'Show Money: Bank statement / sponsor financial proof' },
  Ireland: { amountEur: 10000, note: 'Show Money: IRP liquid financial proof (€10,000+)' },
  UK: { amountEur: 13500, note: 'Show Money: 28-day bank statement (£1,023–£1,334/mo + tuition)' },
  'United Kingdom': { amountEur: 13500, note: 'Show Money: 28-day bank statement (£1,023–£1,334/mo + tuition)' },
  France: { amountEur: 9600, note: 'Show Money: €615–€800/mo financial proof (CAF aid available)' },
  Netherlands: { amountEur: 12000, note: 'Show Money: IND living proof benchmark (~€1,000+/mo)' },
  Spain: { amountEur: 8400, note: 'Show Money: IPREM (~€600–€700/mo) student visa proof' },
  Italy: { amountEur: 8500, note: 'Show Money: ~€6,000–€8,500/yr bank balance (DSU aid available)' },
  Portugal: { amountEur: 8000, note: 'Show Money: Means of subsistence proof (~€8,000/yr)' },
  Latvia: { amountEur: 8400, note: 'Show Money: Minimum €700/mo (~€8,400/yr) bank balance proof' },
  Denmark: { amountEur: 11000, note: 'Show Money: ~DKK 6,820/mo (~€11,000/yr) living proof' },
  Sweden: { amountEur: 11500, note: 'Show Money: Migrationsverket ~SEK 10,314/mo (~€11,500/yr)' },
  Australia: { amountEur: 18000, note: 'Show Money: AUD 29,710/yr (~€18,000) living capacity proof' },
  Canada: { amountEur: 14000, note: 'Show Money: CAD 20,635/yr GIC + 1st year tuition' },
  USA: { amountEur: 18000, note: 'Show Money: I-20 liquid bank funds covering 1st year tuition + living' },
  Finland: { amountEur: 9600, note: 'Show Money: Migri €800/mo (€9,600/yr) bank balance proof' },
};

export function hasBuiltInCountryGuide(country?: string): boolean {
  if (!country) return false;
  return Object.keys(LIVING_COST_BY_COUNTRY).some(
    (k) => k.toLowerCase() === country.trim().toLowerCase()
  );
}

export function getLivingCostGuide(country?: string): { amountEur: number; note: string } {
  if (!country) {
    return { amountEur: 10000, note: 'Typical European student budget' };
  }
  const match = Object.keys(LIVING_COST_BY_COUNTRY).find(
    (k) => k.toLowerCase() === country.trim().toLowerCase()
  );
  return match
    ? LIVING_COST_BY_COUNTRY[match]
    : { amountEur: 10000, note: `Estimated living cost in ${country}` };
}

const CHECKLIST_BY_COUNTRY: Record<string, { deadlineWindow: string; docs: string[] }> = {
  Germany: {
    deadlineWindow: 'Jan 15 (Summer) • Jul 15 (Winter) — Apply 4–6 months early',
    docs: [
      'APS Certificate (Mandatory for Indian/Vietnamese/Chinese applicants)',
      'Blocked Account (Sperrkonto) financial proof',
      'SOP, Europass CV & 2 Letters of Recommendation',
      '10th, 12th & Bachelor Transcripts (Degree / Provisional)',
      'IELTS / MOI / German proficiency & Valid Passport',
    ],
  },
  Malta: {
    deadlineWindow: '2–3 months before Oct / Feb / Apr intakes',
    docs: [
      'Valid Passport & University Offer Letter',
      '10th, 12th & Bachelor Marksheets / Certificates',
      'IELTS (5.5–6.0) or Medium of Instruction (MOI) Letter',
      'Bank Statement / Sponsor Affidavit & Travel Insurance',
      'Police Clearance Certificate (PCC) for visa',
    ],
  },
  Ireland: {
    deadlineWindow: 'Feb – May for Sept intake • Rolling for Jan intake',
    docs: [
      'Academic Transcripts & Degree Certificate',
      'IELTS / PTE / Duolingo Official Score Report',
      'Statement of Purpose (SOP) & 2 LORs',
      'Education Loan / Liquid Bank Funds (€10,000+)',
      'Private Medical Insurance for IRP Registration',
    ],
  },
  UK: {
    deadlineWindow: 'Jan (UCAS UG) • Rolling until May/June (PG)',
    docs: [
      'CAS Letter from UK University',
      'Academic Transcripts & 12th / Degree Certificates',
      'IELTS / UKVI IELTS or Accepted MOI Waiver',
      '28-Day Uninterrupted Bank Statement (Tuition + Living)',
      'TB Test Certificate & IHS Health Surcharge',
    ],
  },
  France: {
    deadlineWindow: 'Dec – Mar via Études en France / Campus France',
    docs: [
      'Campus France / Études en France Portal Approval',
      'Academic Transcripts, SOP & CV',
      'IELTS / MOI Certificate',
      'Financial Proof (~€7,380–€9,600/yr)',
      'OFII Long-Stay Student Visa & Birth Certificate (Apostilled)',
    ],
  },
  Italy: {
    deadlineWindow: 'Mar – May (Universitaly Pre-enrollment)',
    docs: [
      'Universitaly Pre-enrollment & DoV / CIMEA Equivalency',
      'Apostilled Academic Transcripts & Degree',
      'IELTS / MOI Letter',
      'ISEE Parificato / Income Docs for DSU Scholarship',
      'Financial Proof & Schengen Health Insurance',
    ],
  },
  Netherlands: {
    deadlineWindow: 'May 1 (Non-EU deadline for Sept intake)',
    docs: [
      'Nuffic / Credential Evaluation & Transcripts',
      'IELTS (6.0–6.5+) or TOEFL Score',
      'Motivation Letter & Detailed CV',
      'IND Living Proof Transfer (~€12,000/yr)',
      'MVV Entry Visa & TB Test (if applicable)',
    ],
  },
  Latvia: {
    deadlineWindow: 'May – Jul (Autumn) • Nov – Dec (Spring)',
    docs: [
      'AIC Academic Information Centre Degree Verification',
      '10th, 12th & Bachelor Transcripts (Apostilled)',
      'IELTS / MOI Letter + University Online Interview',
      'Application Fee + 1st Year Tuition & Security Deposit',
      'Bank Statement / Financial Proof & Residence Permit (OCMA)',
    ],
  },
  Sweden: {
    deadlineWindow: 'Oct – Jan 15 (Universityadmissions.se Autumn)',
    docs: [
      'Universityadmissions.se Application & Fee',
      'Official Academic Transcripts & Degree Certificate',
      'IELTS (6.5) / TOEFL / Accepted MOI',
      'Motivation Letter & CV',
      'Migrationsverket Bank Balance Proof (~€11,500/yr)',
    ],
  },
  Australia: {
    deadlineWindow: '3–5 months prior to Feb / Jul / Nov intakes',
    docs: [
      'Genuine Student (GS) Statement & SOP',
      'Academic Transcripts & Degree Certificate',
      'IELTS / PTE Academic Score Report',
      'CoE (Confirmation of Enrolment) & OSHC Health Cover',
      'Financial Capacity Proof (Tuition + AUD 29,710 living)',
    ],
  },
};

export function getCountryChecklist(country?: string): { deadlineWindow: string; docs: string[] } {
  if (country) {
    const match = Object.keys(CHECKLIST_BY_COUNTRY).find(
      (k) => k.toLowerCase() === country.trim().toLowerCase()
    );
    if (match) return CHECKLIST_BY_COUNTRY[match];
  }
  return {
    deadlineWindow: '3–5 months prior to your target intake month',
    docs: [
      'Valid Passport & Academic Transcripts (10th, 12th, Degree)',
      'IELTS / PTE Score or MOI Certificate',
      'Statement of Purpose (SOP) & Updated CV',
      '2 Letters of Recommendation (Academic / Work)',
      'Financial Proof / Education Loan & Health Insurance',
    ],
  };
}

const SCHOLARSHIP_BY_COUNTRY: Record<string, { badge: string; detail: string }> = {
  Germany: {
    badge: 'DAAD / Merit Aid',
    detail: 'Eligible for DAAD Scholarships & Deutschlandstipendium (€300/month).',
  },
  Italy: {
    badge: 'DSU / Regional Aid',
    detail: 'Eligible for Italian DSU need-based scholarship (tuition waiver + stipend).',
  },
  Malta: {
    badge: '70% Tax Rebate',
    detail: 'Get Qualified Scheme offers up to 70% tax rebate on tuition after graduating & working in Malta.',
  },
  Ireland: {
    badge: 'GOI / Merit Aid',
    detail: 'Government of Ireland (GOI-IES) & university merit scholarships (€2,000–€5,000).',
  },
  UK: {
    badge: 'GREAT / Bursary',
    detail: 'Eligible for GREAT Scholarships & automatic international merit bursaries.',
  },
  France: {
    badge: 'Eiffel / Charpak',
    detail: 'Campus France Charpak / Eiffel excellence scholarships & CAF housing subsidy.',
  },
  Netherlands: {
    badge: 'NL Scholarship',
    detail: 'NL Scholarship (€5,000) & university excellence fellowships available.',
  },
  Latvia: {
    badge: 'Latvian State Aid',
    detail: 'Latvian State Scholarships & university merit tuition discounts available.',
  },
  Sweden: {
    badge: 'SI Scholarship',
    detail: 'Swedish Institute (SI) & university tuition-waiver scholarships available.',
  },
  Australia: {
    badge: 'Merit Bursary (15–30%)',
    detail: 'Destination Australia & university international merit scholarships (15–30% fee waiver).',
  },
};

export function getScholarshipInfo(course: Course): {
  hasScholarship: boolean;
  badge: string;
  detail: string;
} {
  if (course.tuition_fees_eur === 0) {
    return {
      hasScholarship: true,
      badge: '100% Tuition-Free',
      detail: 'Public / zero-tuition programme — only nominal semester contribution applies.',
    };
  }
  const country = course.university?.country;
  if (country) {
    const match = Object.keys(SCHOLARSHIP_BY_COUNTRY).find(
      (k) => k.toLowerCase() === country.trim().toLowerCase()
    );
    if (match) {
      return {
        hasScholarship: true,
        ...SCHOLARSHIP_BY_COUNTRY[match],
      };
    }
  }
  const text = `${course.program_name} ${JSON.stringify(course.raw_excel_data || '')}`.toLowerCase();
  if (text.includes('scholarship') || text.includes('waiver') || text.includes('bursary')) {
    return {
      hasScholarship: true,
      badge: 'Scholarship Available',
      detail: 'Merit scholarship or tuition waiver noted in programme details.',
    };
  }
  return { hasScholarship: false, badge: '', detail: '' };
}
