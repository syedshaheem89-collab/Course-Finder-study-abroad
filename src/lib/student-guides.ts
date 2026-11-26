import { Course } from '@/types/database';
import { normalizeCountryName } from '@/lib/countries';

export type CurrencyCode = 'LOCAL' | 'EUR' | 'INR';

export const EUR_TO_INR = 92;

export const DEFAULT_FX_RATES_PER_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 0.85,
  USD: 1.08,
  CAD: 1.49,
  AUD: 1.65,
  NZD: 1.80,
  CHF: 0.94,
  SEK: 11.4,
  DKK: 7.46,
  NOK: 11.7,
  PLN: 4.30,
  CZK: 25.2,
  HUF: 398,
  JPY: 164,
  KRW: 1490,
  SGD: 1.44,
  AED: 3.97,
  GEL: 2.95,
  ALL: 99,
  BGN: 1.96,
  INR: EUR_TO_INR,
};

export interface BillingCurrencyInfo {
  code: string;
  symbol: string;
  prefixSpace?: boolean;
}

export const COUNTRY_BILLING_CURRENCY: Record<string, BillingCurrencyInfo> = {
  'United Kingdom': { code: 'GBP', symbol: '£' },
  Georgia: { code: 'USD', symbol: '$' },
  'United States': { code: 'USD', symbol: '$' },
  USA: { code: 'USD', symbol: '$' },
  Canada: { code: 'CAD', symbol: 'C$' },
  Australia: { code: 'AUD', symbol: 'A$' },
  'New Zealand': { code: 'NZD', symbol: 'NZ$' },
  Switzerland: { code: 'CHF', symbol: 'CHF ', prefixSpace: true },
  Sweden: { code: 'SEK', symbol: 'SEK ', prefixSpace: true },
  Denmark: { code: 'DKK', symbol: 'DKK ', prefixSpace: true },
  Norway: { code: 'NOK', symbol: 'NOK ', prefixSpace: true },
  Singapore: { code: 'SGD', symbol: 'S$' },
  'United Arab Emirates': { code: 'AED', symbol: 'AED ', prefixSpace: true },
  Japan: { code: 'JPY', symbol: '¥' },
  'South Korea': { code: 'KRW', symbol: '₩' },
};

const BILLING_SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  SGD: 'S$',
  CHF: 'CHF ',
  SEK: 'SEK ',
  DKK: 'DKK ',
  NOK: 'NOK ',
  AED: 'AED ',
  JPY: '¥',
  KRW: '₩',
  PLN: 'PLN ',
  CZK: 'CZK ',
  HUF: 'HUF ',
  GEL: 'GEL ',
  ALL: 'ALL ',
  INR: '₹',
};

export function getCountryBillingCurrency(country?: string | null): BillingCurrencyInfo {
  if (!country) return { code: 'EUR', symbol: '€' };
  const normalized = normalizeCountryName(country) || country.trim();
  if (COUNTRY_BILLING_CURRENCY[normalized]) return COUNTRY_BILLING_CURRENCY[normalized];
  const lower = normalized.toLowerCase();
  const key = Object.keys(COUNTRY_BILLING_CURRENCY).find((k) => k.toLowerCase() === lower);
  return key ? COUNTRY_BILLING_CURRENCY[key] : { code: 'EUR', symbol: '€' };
}

export function formatNativeAmount(amount: number, currencyCode = 'EUR'): string {
  const code = String(currencyCode || 'EUR').trim().toUpperCase();
  if (code === 'INR') {
    const inr = Math.round(amount);
    if (inr >= 100000) {
      const lakhs = (inr / 100000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
      return `₹${lakhs}L`;
    }
    return `₹${inr.toLocaleString('en-IN')}`;
  }
  const symbol = BILLING_SYMBOLS[code] || `${code} `;
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

export function formatCurrencyAmount(
  eurAmount: number,
  currency: CurrencyCode,
  isTuition = false,
  sector?: 'Public' | 'Private',
  options?: {
    country?: string | null;
    fxRates?: Record<string, number> | null;
    originalAmount?: number | null;
    originalCurrency?: string | null;
  }
): string {
  if (eurAmount === 0 && isTuition) {
    if (sector === 'Private') {
      return 'Verify Tuition';
    }
    if (currency === 'INR') return 'Free (₹0)';
    if (currency === 'LOCAL' && options?.country) {
      const billing = getCountryBillingCurrency(options.country);
      return `Free (${billing.symbol}0)`;
    }
    return 'Free (€0)';
  }

  if (currency === 'LOCAL') {
    if (
      options?.originalAmount !== null &&
      options?.originalAmount !== undefined &&
      Number.isFinite(Number(options.originalAmount)) &&
      options.originalCurrency
    ) {
      return formatNativeAmount(Number(options.originalAmount), options.originalCurrency);
    }
    const billing = getCountryBillingCurrency(options?.country);
    if (billing.code === 'EUR') {
      return `€${Math.round(eurAmount).toLocaleString()}`;
    }
    const rate =
      options?.fxRates?.[billing.code] ??
      DEFAULT_FX_RATES_PER_EUR[billing.code] ??
      1;
    const rawLocal = eurAmount * rate;
    const roundedLocal = rawLocal >= 1000 ? Math.round(rawLocal / 100) * 100 : Math.round(rawLocal);
    return formatNativeAmount(roundedLocal, billing.code);
  }

  if (currency === 'EUR') {
    return `€${Math.round(eurAmount).toLocaleString()}`;
  }

  const inrRate = options?.fxRates?.INR ?? EUR_TO_INR;
  const inr = Math.round(eurAmount * inrRate);
  if (inr >= 100000) {
    const lakhs = (inr / 100000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return `₹${lakhs}L`;
  }
  return `₹${inr.toLocaleString('en-IN')}`;
}

const LIVING_COST_BY_COUNTRY: Record<string, { amountEur: number; note: string }> = {
  Germany: {
    amountEur: 11904,
    note: 'Show Money: Blocked Account (Sperrkonto) €992/mo (€11,904/yr)',
  },
  Malta: {
    amountEur: 8500,
    note: 'Show Money: Bank statement / sponsor proof (~€8,500/yr) + paid tuition',
  },
  Ireland: {
    amountEur: 10000,
    note: 'Show Money: €10,000/yr liquid funds + tuition payment proof',
  },
  'United Kingdom': {
    amountEur: 14500,
    note: 'Show Money: 28-day bank statement (£1,171–£1,203/mo Outside London; £1,529–£1,570/mo London × 9 mo + tuition)',
  },
  France: {
    amountEur: 9600,
    note: 'Show Money: €615–€800/mo (~€7,380–€9,600/yr; CAF housing aid available)',
  },
  Netherlands: {
    amountEur: 13569,
    note: 'Show Money: IND 2026 study norm €1,130.77/mo (€13,569/yr) + tuition',
  },
  Spain: {
    amountEur: 8400,
    note: 'Show Money: 100% IPREM (~€600/mo / €7,200–€8,400/yr) bank statement proof',
  },
  Italy: {
    amountEur: 10180,
    note: 'Show Money: ~€10,180/yr visa financial proof (DSU aid for ISEE ≤ €28,340)',
  },
  Portugal: {
    amountEur: 10440,
    note: 'Show Money: 12 × Portuguese minimum wage (~€10,440/yr) financial proof',
  },
  Latvia: {
    amountEur: 8880,
    note: 'Show Money: OCMA €740/mo (€8,880/yr) bank balance proof',
  },
  Denmark: {
    amountEur: 11950,
    note: 'Show Money: SIRI DKK 7,426/mo (DKK 89,112/yr ≈ €11,950; often exempt if tuition paid upfront)',
  },
  Sweden: {
    amountEur: 11500,
    note: 'Show Money: Migrationsverket SEK 10,656/mo (SEK 127,872/yr ≈ €11,500)',
  },
  Australia: {
    amountEur: 18000,
    note: 'Show Money: AUD 29,710/yr (~€18,000) living capacity + 1st-yr tuition & travel',
  },
  Canada: {
    amountEur: 15500,
    note: 'Show Money: CAD 22,895/yr GIC / living proof (CAD 23,448/yr from Sept 2026) + 1st-year tuition',
  },
  USA: {
    amountEur: 19000,
    note: 'Show Money: I-20 liquid bank funds covering 1st year tuition + living',
  },
  Finland: {
    amountEur: 9600,
    note: 'Show Money: Migri €800/mo (€9,600/yr) liquid bank proof',
  },
  Poland: {
    amountEur: 7000,
    note: 'Show Money: Min. PLN 776/mo + PLN 2,500 return + housing (recommend ~€7,000+ bank balance)',
  },
  'New Zealand': {
    amountEur: 11000,
    note: 'Show Money: Immigration NZ NZD 20,000/yr (~€11,000) + 1st-yr tuition',
  },
  Norway: {
    amountEur: 13000,
    note: 'Show Money: UDI living proof ~NOK 151,690/yr (~€13,000/yr)',
  },
  Austria: {
    amountEur: 14500,
    note: 'Show Money: Bank balance ~€14,500/yr (age 24+; ~€8,500/yr if under 24)',
  },
  Switzerland: {
    amountEur: 22000,
    note: 'Show Money: Swiss bank proof CHF 21,000/yr (~€22,000/yr)',
  },
  Belgium: {
    amountEur: 10800,
    note: 'Show Money: Blocked account / sponsor proof (~€900–€1,000/mo)',
  },
  Hungary: {
    amountEur: 7000,
    note: 'Show Money: Bank balance proof (~€6,500–€7,500/yr) + tuition',
  },
  'Czech Republic': {
    amountEur: 6500,
    note: 'Show Money: Bank balance ~CZK 156,500+ (~€6,500/yr) + accommodation',
  },
  Lithuania: {
    amountEur: 7500,
    note: 'Show Money: Migration Dept proof ~€6,500–€7,500/yr + paid 1st-year tuition',
  },
  Estonia: {
    amountEur: 8000,
    note: 'Show Money: Police & Border Guard living proof (~€7,200–€8,000/yr) + tuition',
  },
  Cyprus: {
    amountEur: 7000,
    note: 'Show Money: Bank statement ~€7,000+ & paid tuition / accommodation proof',
  },
  Luxembourg: {
    amountEur: 12000,
    note: 'Show Money: Minimum ~80% social reference threshold (~€12,000/yr) proof of funds',
  },
  Singapore: {
    amountEur: 11000,
    note: 'Show Money: ICA Student Pass bank funds (~SGD 15,000 / €11,000+ + tuition)',
  },
  'United Arab Emirates': {
    amountEur: 9500,
    note: 'Show Money: University fee deposit & Emirates ID / health insurance sponsorship',
  },
  Japan: {
    amountEur: 12000,
    note: 'Show Money: COE financial sponsor proof (~JPY 2M / €12,000/yr) + bank certificate',
  },
  'South Korea': {
    amountEur: 13500,
    note: 'Show Money: D-2 visa bank balance certificate (~KRW 20M / €13,500/yr)',
  },
  Bulgaria: {
    amountEur: 6000,
    note: 'Show Money: Bank statement proof (~€5,500–€6,000/yr) + paid tuition & housing',
  },
  Georgia: {
    amountEur: 5500,
    note: 'Show Money: Sponsor/personal bank proof (~€5,000–€5,500/yr) for D3 study visa',
  },
  Albania: {
    amountEur: 5500,
    note: 'Show Money: Personal/sponsor bank balance (~€5,000–€5,500/yr) + accommodation proof',
  },
};

function findCountryGuideKey<T>(map: Record<string, T>, country?: string): string | undefined {
  if (!country) return undefined;
  const normalized = normalizeCountryName(country) || country.trim();
  return Object.keys(map).find((k) => k.toLowerCase() === normalized.toLowerCase());
}

export function hasBuiltInCountryGuide(country?: string): boolean {
  return Boolean(findCountryGuideKey(LIVING_COST_BY_COUNTRY, country));
}

export function getLivingCostGuide(country?: string): { amountEur: number; note: string } {
  if (!country) {
    return { amountEur: 10000, note: 'Typical European student budget' };
  }
  const match = findCountryGuideKey(LIVING_COST_BY_COUNTRY, country);
  return match
    ? LIVING_COST_BY_COUNTRY[match]
    : { amountEur: 10000, note: `Estimated living cost in ${country}` };
}

const CHECKLIST_BY_COUNTRY: Record<string, { deadlineWindow: string; docs: string[] }> = {
  Germany: {
    deadlineWindow: 'Jan 15 (Summer) • Jul 15 (Winter) — Apply 4–6 months early',
    docs: [
      'APS Certificate (Mandatory for Indian/Vietnamese/Chinese applicants)',
      'Blocked Account (Sperrkonto — €11,904/yr) financial proof',
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
      'Bank Statement (~€8,500/yr) / Sponsor Affidavit & Insurance',
      'Police Clearance Certificate (PCC) & Identità Malta Visa File',
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
  'United Kingdom': {
    deadlineWindow: 'Jan (UCAS UG) • Rolling until May/June (PG)',
    docs: [
      'CAS Letter from UK University',
      'Academic Transcripts & 12th / Degree Certificates',
      'IELTS / UKVI IELTS or Accepted MOI Waiver',
      '28-Day Uninterrupted Bank Statement (£1,171–£1,570/mo × 9 mo + Tuition)',
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
      'ISEE Parificato (≤ €28,340) / Income Docs for DSU Scholarship',
      'Financial Proof (~€10,180/yr) & Schengen Health Insurance',
    ],
  },
  Netherlands: {
    deadlineWindow: 'May 1 (Non-EU deadline for Sept intake)',
    docs: [
      'Nuffic / Credential Evaluation & Transcripts',
      'IELTS (6.0–6.5+) or TOEFL Score',
      'Motivation Letter & Detailed CV',
      'IND 2026 Living Proof Transfer (€13,569.24/yr)',
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
      'Bank Statement (€740/mo / €8,880/yr) & Residence Permit (OCMA)',
    ],
  },
  Sweden: {
    deadlineWindow: 'Oct – Jan 15 (Universityadmissions.se Autumn)',
    docs: [
      'Universityadmissions.se Application & Fee',
      'Official Academic Transcripts & Degree Certificate',
      'IELTS (6.5) / TOEFL / Accepted MOI',
      'Motivation Letter & CV',
      'Migrationsverket Bank Proof (SEK 10,656/mo · SEK 127,872/yr)',
    ],
  },
  Australia: {
    deadlineWindow: '3–5 months prior to Feb / Jul / Nov intakes',
    docs: [
      'Genuine Student (GS) Statement & SOP',
      'Academic Transcripts & Degree Certificate',
      'IELTS / PTE Academic Score Report',
      'CoE (Confirmation of Enrolment) & OSHC Health Cover',
      'Financial Capacity Proof (Tuition + AUD 29,710/yr living)',
    ],
  },
  Canada: {
    deadlineWindow: '4–6 months prior to Sept / Jan / May intakes',
    docs: [
      'Provincial Attestation Letter (PAL) & University LOA',
      'GIC / Living Proof (CAD 22,895–23,448/yr) + 1st Year Tuition',
      'Medical Exam (IME) & Police Clearance',
      'SOP / Study Plan & Financial Sponsor Docs',
      'IRCC Study Permit Biometrics',
    ],
  },
  USA: {
    deadlineWindow: 'Nov – Mar (Fall intake) • Aug – Oct (Spring)',
    docs: [
      'University I-20 Form & SEVIS I-901 Fee Receipt',
      'Academic Transcripts, SOP & 2–3 LORs',
      'IELTS / TOEFL / Duolingo (+ GRE/GMAT if required)',
      'Liquid Bank Funds / Loan Sanction covering Year 1 I-20',
      'DS-160 Confirmation & F-1 Visa Interview',
    ],
  },
  Poland: {
    deadlineWindow: 'May – Jul (October) • Oct – Dec (February)',
    docs: [
      'NAWA / Apostilled Academic Transcripts & Eligibility Recognition',
      'Official University Acceptance & Tuition Payment Confirmation',
      'IELTS (5.5–6.5) or Accepted MOI / Internal Assessment',
      'Liquid Financial Proof (Min. PLN 776/mo + Return 2,500 PLN + Housing)',
      'Accommodation Lease, Health Insurance & Type D National Visa',
    ],
  },
  Denmark: {
    deadlineWindow: 'Jan 15 (Autumn / Sept) • Sept 1 (Spring / Feb)',
    docs: [
      'Official University Admission & Tuition Payment Receipt',
      '10th, 12th & Bachelor Marksheets + Degree Certificate',
      'IELTS (6.5) / TOEFL Official Score',
      'SIRI ST1 Residence Permit Form & Living Funds (DKK 89,112/yr if applicable)',
      'Valid Passport & Biometrics Submission',
    ],
  },
  Finland: {
    deadlineWindow: 'January Joint Application (Autumn) • Aug–Sept (Spring)',
    docs: [
      'Studyinfo.fi Acceptance Letter & Tuition Receipt / Scholarship',
      'Academic Transcripts & Degree Certificate',
      'IELTS (6.0–6.5) / SAT / University Entrance Screening',
      'Migri Bank Account Proof (€800/mo · €9,600/yr liquid)',
      'Private Health Insurance & EnterFinland Biometrics',
    ],
  },
  'New Zealand': {
    deadlineWindow: '3–4 months prior to Feb / July intakes',
    docs: [
      'Unconditional Offer of Place & Tuition Payment Receipt',
      'Academic Transcripts & Qualification Certificates',
      'IELTS (6.0–6.5) / PTE Academic Score',
      'FTS / Liquid Living Funds Proof (NZD 20,000/yr + travel)',
      'INZ Medical Certificate, X-Ray & Police Clearance',
    ],
  },
  Norway: {
    deadlineWindow: 'Dec 1 (Non-EU deadline for August intake)',
    docs: [
      'Academic Transcripts, Course Descriptions & CV',
      'IELTS (6.5) / TOEFL Score',
      'Admission Offer & Tuition Deposit Transfer',
      'UDI Financial Guarantee Account (~NOK 151,690/yr)',
      'Housing Guarantee & Residence Permit Biometrics',
    ],
  },
  Austria: {
    deadlineWindow: 'Feb 5 (Winter) • Sept 5 (Summer) via university portal',
    docs: [
      'Legalized / Apostilled Academic Transcripts & Degree',
      'IELTS / TOEFL or German A2–B2 (if German track)',
      'Accommodation Contract & Travel Health Insurance',
      'Bank Statement (~€14,500/yr if ≥24; ~€8,500/yr if <24)',
      'Residence Permit – Student Filing & Visa D',
    ],
  },
  Switzerland: {
    deadlineWindow: 'Nov – Dec (Fall intake) — Early Swiss timelines',
    docs: [
      'University Acceptance Letter & Academic Transcripts',
      'IELTS (6.5–7.0) / TOEFL + GRE (for ETH/EPFL)',
      'Swiss-Recognized Bank Funds Proof (CHF 21,000/yr)',
      'SOP, CV & Declaration to Leave Upon Study Completion',
      'Cantonal Authorization & Embassy Type D Visa',
    ],
  },
  Singapore: {
    deadlineWindow: '2–4 months before Jan / Mar / May / Aug / Oct intakes',
    docs: [
      'University Offer Letter & ICA SOLAR In-Principle Approval (IPA)',
      'Academic Marksheets & Degree / Provisional Certificate',
      'IELTS / MOI Waiver (varies by institution)',
      'Bank Balance Statement (~SGD 15,000+) & Medical Report',
      'Student Pass Issuance Upon Arrival in Singapore',
    ],
  },
  'United Arab Emirates': {
    deadlineWindow: 'Rolling — 4–8 weeks before Sept / Jan / May intakes',
    docs: [
      'Valid Passport Copy & Digital Photograph',
      '10th, 12th / Bachelor Transcripts',
      'IELTS / MOI Waiver or Internal English Test',
      'Initial Tuition Deposit Receipt for Visa Sponsorship',
      'UAE Entry Permit, Medical Fitness Test & Emirates ID',
    ],
  },
  Bulgaria: {
    deadlineWindow: 'Jun – Aug (October) • Nov – Jan (February intake)',
    docs: [
      'MES Bulgaria Academic Recognition & University Admission Letter',
      'Apostilled 10th, 12th / Bachelor Transcripts & Birth Certificate',
      'IELTS (5.5–6.5) / Accepted MOI or University English Test',
      'Bank Statement (~€6,000+) & Police Clearance Certificate (PCC)',
      'Type D Long-Stay Visa Filing & Schengen Medical Insurance',
    ],
  },
  Georgia: {
    deadlineWindow: 'Jul – Sept (Autumn) • Dec – Feb (Spring intake)',
    docs: [
      'EQE Ministry of Education Order & University Offer Letter',
      'Apostilled Academic Marksheets & Passport Translation',
      'IELTS / MOI Letter or University Video Admissions Interview',
      '1st Year Tuition Receipt & Bank Statement (~€5,500/yr)',
      'Category D3 Immigration Visa & Local TRC Card Registration',
    ],
  },
  Albania: {
    deadlineWindow: 'Jul – Sept (October) • Dec – Jan (February intake)',
    docs: [
      'QSHA / University Acceptance Letter & Tuition Deposit Receipt',
      'Apostilled High School / Bachelor Diploma & Grade Transcripts',
      'IELTS / MOI Waiver & Health Insurance Coverage',
      'Bank Statement (~€5,500/yr) & Criminal Record Certificate (PCC)',
      'Type D Long-Stay Study Visa & Residence Permit Filing in Tirana',
    ],
  },
};

export function getCountryChecklist(country?: string): { deadlineWindow: string; docs: string[] } {
  if (country) {
    const match = findCountryGuideKey(CHECKLIST_BY_COUNTRY, country);
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
    detail: 'Eligible for Italian DSU need-based scholarship (tuition waiver + stipend for ISEE ≤ €28,340).',
  },
  Malta: {
    badge: '70% Tax Rebate',
    detail: 'Get Qualified Scheme offers up to 70% tax rebate on tuition after graduating & working in Malta.',
  },
  Ireland: {
    badge: 'GOI / Merit Aid',
    detail: 'Government of Ireland (GOI-IES) & university merit scholarships (€2,000–€5,000).',
  },
  'United Kingdom': {
    badge: 'GREAT / Bursary',
    detail: 'Eligible for GREAT Scholarships & automatic international merit bursaries (£2,000–£8,000).',
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
  Canada: {
    badge: 'Entrance Bursary',
    detail: 'Graduate entrance fellowships & university merit awards (CAD 2,000–CAD 10,000).',
  },
  Poland: {
    badge: 'NAWA / Merit Aid',
    detail: 'Low EU tuition (€2,000–€6,000/yr) plus Banach NAWA & university merit waivers.',
  },
  Finland: {
    badge: 'Finland Scholarship',
    detail: 'Early-bird tuition discounts (20–50%) & Finland Scholarship merit waivers.',
  },
  Denmark: {
    badge: 'Danish Gov Aid',
    detail: 'Danish Government Scholarships & full/partial tuition waivers for top STEM/Business applicants.',
  },
  'New Zealand': {
    badge: 'Manaaki / Merit Aid',
    detail: 'NZ Excellence Awards & university international postgraduate scholarships.',
  },
  Hungary: {
    badge: 'Stipendium Hungaricum',
    detail: 'Full Stipendium Hungaricum tuition + stipend scholarship pathway available.',
  },
  Bulgaria: {
    badge: 'EU Low Tuition',
    detail: 'Affordable EU public tuition (€3,000–€3,800/yr STEM; merit bursaries at private AUBG & VUM).',
  },
  Georgia: {
    badge: 'Merit & Low Tuition',
    detail: 'Public engineering/CS degrees from €3,000/yr plus merit fee discounts at Tbilisi universities.',
  },
  Albania: {
    badge: 'Low-Cost European Study',
    detail: 'Public university tuition starting ~€1,900–€2,400/yr plus Epoka & UNYT academic merit scholarships.',
  },
};

export function getScholarshipInfo(
  course: Course,
  sector?: 'Public' | 'Private'
): {
  hasScholarship: boolean;
  badge: string;
  detail: string;
} {
  if (course.tuition_fees_eur === 0 && sector !== 'Private') {
    return {
      hasScholarship: true,
      badge: '100% Tuition-Free',
      detail: 'Public / zero-tuition programme — only nominal semester contribution applies.',
    };
  }
  const country = course.university?.country;
  if (country) {
    const match = findCountryGuideKey(SCHOLARSHIP_BY_COUNTRY, country);
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

const GENERIC_LANDING_PATHS = new Set([
  '',
  '/',
  '/en',
  '/de',
  '/fr',
  '/nl',
  '/sv',
  '/it',
  '/es',
  '/pl',
  '/home',
  '/index.html',
  '/index.php',
  '/international',
  '/admissions',
  '/study',
  '/programmes',
  '/programs',
  '/courses',
  '/en/home',
  '/en/study',
  '/en/international',
  '/en/admissions',
]);

export function isGenericUniversityUrl(rawUrl?: string): {
  isGeneric: boolean;
  cleanHost: string;
  origin: string;
} {
  const raw = (rawUrl || '').trim();
  if (!raw || raw === '#' || !/^https?:\/\//i.test(raw)) {
    return { isGeneric: true, cleanHost: '', origin: '' };
  }
  try {
    const parsed = new URL(raw);
    const cleanHost = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const origin = `${parsed.protocol}//${parsed.host}`;
    if (
      cleanHost.includes('study-abroad.edu') ||
      cleanHost.includes('google.') ||
      cleanHost.includes('vertexaisearch.cloud.google.com') ||
      cleanHost === 'discoveruni.gov.uk' ||
      cleanHost === 'mcast.edu.mt'
    ) {
      return { isGeneric: true, cleanHost: '', origin: '' };
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    const hasQuery = Array.from(parsed.searchParams.keys()).length > 0;
    const isGenericPath = GENERIC_LANDING_PATHS.has(cleanPath) && !hasQuery;
    return { isGeneric: isGenericPath, cleanHost, origin };
  } catch {
    return { isGeneric: true, cleanHost: '', origin: '' };
  }
}

export function resolveCourseUrl(course: {
  program_name: string;
  course_url?: string | null;
  university?: { name?: string | null; country?: string | null } | null;
}): {
  url: string;
  isDirect: boolean;
  linkType: 'direct' | 'site_search' | 'web_search';
  universityUrl?: string;
  universityHost?: string;
} {
  const raw = (course.course_url || '').trim();
  const { isGeneric, cleanHost, origin } = isGenericUniversityUrl(raw);

  if (raw && !isGeneric && /^https?:\/\//i.test(raw)) {
    return {
      url: raw,
      isDirect: true,
      linkType: 'direct',
      universityUrl: origin || undefined,
      universityHost: cleanHost || undefined,
    };
  }

  if (cleanHost && /^https?:\/\//i.test(raw)) {
    const query = `site:${cleanHost} ${course.program_name}`.trim();
    return {
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      isDirect: false,
      linkType: 'site_search',
      universityUrl: raw,
      universityHost: cleanHost,
    };
  }

  const query = `${course.university?.name || ''} ${course.program_name} ${course.university?.country || ''} official course tuition`.trim();
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    isDirect: false,
    linkType: 'web_search',
  };
}

export function getEndToEndJourney(country?: string, isPostgrad = false): {
  admissionDocs: string[];
  visaDocs: string[];
  steps: { step: string; title: string; detail: string }[];
} {
  const normalized = (normalizeCountryName(country || '') || country || '').trim().toLowerCase();

  const admissionDocs = [
    'Valid Passport (min. 12–18 months validity)',
    isPostgrad
      ? '10th, 12th & All Semester Bachelor Marksheets + Degree Certificate'
      : '10th & 12th Marksheets + Passing Certificate',
    'IELTS / PTE / TOEFL Score Report (or MOI Letter if accepted)',
    'Statement of Purpose (SOP) & Updated Europass / Academic CV',
    isPostgrad ? '2 Letters of Recommendation (Academic / Employer)' : '1–2 Academic LORs (if requested)',
    normalized === 'germany'
      ? 'APS Certificate (Mandatory for India/Vietnam/China)'
      : normalized === 'latvia'
      ? 'AIC Academic Recognition Submission + Online University Interview'
      : normalized === 'poland'
      ? 'NAWA / Apostilled Academic Recognition Documents'
      : 'Application Form & University Application Fee (if applicable)',
  ];

  const visaDocs =
    normalized === 'germany'
      ? [
          'University Admission / Offer Letter',
          'Blocked Account (Sperrkonto — €11,904/yr) & Fee Receipt',
          'APS Certificate & Videx National Visa Form',
          'Public/Private German Health & Travel Insurance',
          'Biometrics & Embassy/VFS Visa Interview',
        ]
      : normalized === 'united kingdom' || normalized === 'uk'
      ? [
          'CAS (Confirmation of Acceptance for Studies) Letter',
          '28-Day Uninterrupted Bank Statement (£1,171–£1,570/mo × 9 mo + Tuition)',
          'IELTS / UKVI Score or University-Approved MOI',
          'TB Test Certificate & IHS Health Surcharge Payment',
          'UKVI Student Visa Biometrics',
        ]
      : normalized === 'latvia'
      ? [
          'Official Offer Letter & Tuition + Security Deposit Receipt',
          'OCMA Invitation Number from University',
          'Bank Balance Proof (€740/mo / €8,880/yr) & Sponsor Letter',
          'Police Clearance Certificate (PCC - Apostilled) & Health Insurance',
          'Embassy/VFS Interview & Residence Permit Card',
        ]
      : normalized === 'sweden'
      ? [
          'Universityadmissions.se Offer Letter & 1st Tuition Installment Receipt',
          'Migrationsverket Bank Balance Proof (SEK 10,656/mo · SEK 127,872/yr)',
          'Valid Passport & Comprehensive Health Insurance',
          'Residence Permit Online Submission (Migrationsverket)',
          'Biometrics & Residence Permit Card (UT-kort)',
        ]
      : normalized === 'netherlands'
      ? [
          'Unconditional Offer Letter & Nuffic Credential Check',
          'IND 2026 Living Escrow Transfer (€13,569.24/yr) + Tuition',
          'Antecedents Certificate & MVV Visa Forms',
          'TB Test Undertaking (if applicable for nationality)',
          'Embassy MVV Sticker & Municipal BSN Registration',
        ]
      : normalized === 'poland'
      ? [
          'Official Acceptance Letter & Tuition Payment Confirmation',
          'Financial Proof (Min. PLN 776/mo + Return 2,500 PLN + Housing)',
          'Apostilled Academic Certificates & Accommodation Lease',
          'Comprehensive Travel/Medical Insurance (min. €30,000 coverage)',
          'VFS / Embassy Type D National Visa Submission',
        ]
      : normalized === 'australia'
      ? [
          'CoE (Confirmation of Enrolment) & Genuine Student (GS) Statement',
          'OSHC (Overseas Student Health Cover)',
          'Financial Capacity Proof (Tuition + AUD 29,710/yr)',
          'Medical Examination & Biometrics (Subclass 500)',
          'IELTS / PTE Score & Academic Transcripts',
        ]
      : normalized === 'canada'
      ? [
          'Provincial Attestation Letter (PAL) & University LOA',
          'GIC / Living Funds (CAD 22,895–23,448/yr) + 1st Year Tuition Receipt',
          'Medical Exam (IME) & Police Clearance',
          'SOP / Study Plan & Financial Sponsor Docs',
          'IRCC Study Permit Biometrics',
        ]
      : [
          'Official University Offer / Admission Letter',
          'Show Money / Bank Balance / Education Loan Proof',
          'Tuition Deposit Receipt & Health/Travel Insurance',
          'Police Clearance Certificate (PCC) / Medical (if required)',
          'Embassy / VFS Visa Application & Biometrics',
        ];

  const steps = [
    { step: '1', title: 'Check Eligibility', detail: 'Verify 12th/Degree %, IELTS/MOI & budget' },
    { step: '2', title: 'Apply to University', detail: 'Upload transcripts, SOP, LOR & passport' },
    { step: '3', title: 'Offer & Deposit', detail: 'Receive Offer Letter & pay initial tuition deposit' },
    { step: '4', title: 'Show Money / Loan', detail: 'Arrange Blocked Account, GIC, or bank funds' },
    { step: '5', title: 'Visa & Biometrics', detail: 'Submit embassy visa file, insurance & biometrics' },
    { step: '6', title: 'Fly & Enroll', detail: 'Book accommodation, flight & complete registration' },
  ];

  return { admissionDocs, visaDocs, steps };
}
