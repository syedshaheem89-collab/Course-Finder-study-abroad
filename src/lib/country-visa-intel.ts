import { normalizeCountryName } from '@/lib/countries';

export interface CountryVisaIntel {
  stayBackYears: number;
  bachelorStayBackYears?: number;
  phdStayBackYears?: number;
  diplomaStayBackYears?: number;
  stemStayBackYears?: number;
  avgSalaryEur: number;
  visaSummary: string;
}

const COUNTRY_INTEL_MAP: Record<string, CountryVisaIntel> = {
  Germany: {
    stayBackYears: 1.5,
    bachelorStayBackYears: 1.5,
    phdStayBackYears: 1.5,
    avgSalaryEur: 54000,
    visaSummary:
      '18-month post-study job-seeker residence permit across Bachelor, Master, and PhD degrees; public universities largely tuition-free.',
  },
  'United Kingdom': {
    stayBackYears: 1.5,
    bachelorStayBackYears: 1.5,
    phdStayBackYears: 3.0,
    avgSalaryEur: 39000,
    visaSummary:
      'Graduate Route: 18 months for standard Bachelor/Master applications from 1 Jan 2027 (2 years if applying on/before 31 Dec 2026 or from select high-compliance universities; 3 years for PhD).',
  },
  Ireland: {
    stayBackYears: 2.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 2.0,
    avgSalaryEur: 45000,
    visaSummary:
      'Stamp 1G Third Level Graduate Scheme: 24 months for Master/PhD (NFQ 9–10) and 12 months for Honours Bachelor (NFQ 8).',
  },
  Latvia: {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.33,
    phdStayBackYears: 0.75,
    avgSalaryEur: 25000,
    visaSummary:
      'Master/PhD: up to 9-month OCMA job-seeking extension (+4 mo graduation buffer); Bachelor: 4-month post-completion permit.',
  },
  Denmark: {
    stayBackYears: 3.0,
    bachelorStayBackYears: 3.0,
    phdStayBackYears: 3.0,
    avgSalaryEur: 55000,
    visaSummary:
      'Up to 3-year job-seeking residence permit (SIRI) after completing state-approved Danish higher education.',
  },
  Sweden: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.5,
    avgSalaryEur: 43000,
    visaSummary:
      '12-month residence permit for Bachelor/Master graduates to look for work or start a business (12–18 months for PhD); non-extendable.',
  },
  Netherlands: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 48000,
    visaSummary:
      '12-month Orientation Year (Zoekjaar) residence permit available within 3 years of graduating.',
  },
  France: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 42000,
    visaSummary:
      '12-month RECE/APS post-study job-search permit for Master/Licence Pro graduates (renewable up to 2 years for Indian Master graduates under France–India bilateral agreement).',
  },
  Malta: {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.75,
    phdStayBackYears: 0.75,
    avgSalaryEur: 28000,
    visaSummary:
      '9-month graduate job-search extension (Identità Malta) plus Get Qualified up to 70% tuition tax credit.',
  },
  Australia: {
    stayBackYears: 2.0,
    bachelorStayBackYears: 2.0,
    phdStayBackYears: 3.0,
    diplomaStayBackYears: 1.5,
    avgSalaryEur: 52000,
    visaSummary:
      'Subclass 485 Temporary Graduate visa: 2 years for Bachelor & Coursework Master (3 years Research Master/PhD; 18 months Vocational; +1–2 yrs regional bonus; age cap ≤35).',
  },
  Canada: {
    stayBackYears: 3.0,
    bachelorStayBackYears: 3.0,
    phdStayBackYears: 3.0,
    diplomaStayBackYears: 1.0,
    avgSalaryEur: 49000,
    visaSummary:
      'Post-Graduation Work Permit (PGWP): up to 3 years for Master/PhD & 2+ yr degrees (duration matches study length for shorter diplomas; eligible field-of-study rules apply to college diplomas).',
  },
  Finland: {
    stayBackYears: 2.0,
    bachelorStayBackYears: 2.0,
    phdStayBackYears: 2.0,
    avgSalaryEur: 43000,
    visaSummary:
      '2-year residence permit to look for work or start a business after graduating in Finland.',
  },
  Italy: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 35000,
    visaSummary:
      '12-month post-graduation job-seeking residence permit + regional DSU scholarships.',
  },
  Spain: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 2.0,
    avgSalaryEur: 34000,
    visaSummary:
      '12–24 month graduate residence authorization to seek qualified employment or launch a business.',
  },
  Poland: {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.75,
    phdStayBackYears: 0.75,
    avgSalaryEur: 27000,
    visaSummary:
      '9-month non-renewable graduate job-seeking residence permit; full-time Polish university graduates are exempt from needing a work permit.',
  },
  USA: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 3.0,
    stemStayBackYears: 3.0,
    avgSalaryEur: 76000,
    visaSummary:
      '12-month standard OPT post-study work authorization, extending to 36 months (3 years) for STEM-designated degrees.',
  },
  'New Zealand': {
    stayBackYears: 3.0,
    bachelorStayBackYears: 3.0,
    phdStayBackYears: 3.0,
    diplomaStayBackYears: 1.0,
    avgSalaryEur: 46000,
    visaSummary:
      'Up to 3-year Post Study Work Visa for eligible Bachelor (Level 7+), Master, and PhD graduates.',
  },
  Norway: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 56000,
    visaSummary:
      '12-month job-seeker residence permit (UDI) for international graduates in Norway.',
  },
  Austria: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 49000,
    visaSummary:
      '12-month job-seeker residence permit extension leading to the Red-White-Red Card.',
  },
  Switzerland: {
    stayBackYears: 0.5,
    bachelorStayBackYears: 0.5,
    phdStayBackYears: 0.5,
    avgSalaryEur: 86000,
    visaSummary:
      '6-month job-seeker permit to find high-skill employment of scientific or economic interest.',
  },
  Hungary: {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.75,
    phdStayBackYears: 0.75,
    avgSalaryEur: 25000,
    visaSummary:
      '9-month job-seeking / startup residence permit after graduating from a Hungarian university.',
  },
  'Czech Republic': {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.75,
    phdStayBackYears: 0.75,
    avgSalaryEur: 29000,
    visaSummary:
      '9-month graduate job-seeking residence permit with free labor market access for Czech degree holders.',
  },
  Belgium: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 47000,
    visaSummary:
      '12-month Search Year (Orientation Year) residence permit after completing Belgian higher education.',
  },
  Lithuania: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 27000,
    visaSummary:
      '12-month temporary residence permit for job seeking or self-employment.',
  },
  Estonia: {
    stayBackYears: 0.75,
    bachelorStayBackYears: 0.75,
    phdStayBackYears: 0.75,
    avgSalaryEur: 30000,
    visaSummary:
      '9-month post-graduation stay period to seek employment or register a company in Estonia.',
  },
  Portugal: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 28000,
    visaSummary:
      '12-month job-seeking / post-study transition pathway into renewable work residence permit.',
  },
  Cyprus: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 26000,
    visaSummary:
      'Up to 12-month post-study job-search window for eligible non-EU graduates.',
  },
  Luxembourg: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 58000,
    visaSummary:
      '12-month residence permit for Master/PhD graduates to find employment or start a business.',
  },
  Singapore: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 52000,
    visaSummary:
      'Up to 1-year Long-Term Visit Pass (LTVP) for eligible graduates from recognized institutions seeking employment.',
  },
  'United Arab Emirates': {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 2.0,
    avgSalaryEur: 43000,
    visaSummary:
      'Tax-free career hub with job-exploration visas and 5–10 yr Golden Visa pathways for top graduates.',
  },
  Japan: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 1.0,
    avgSalaryEur: 36000,
    visaSummary:
      'Up to 1-year Designated Activities job-hunting visa (6 months, renewable once) after graduation.',
  },
  'South Korea': {
    stayBackYears: 1.0,
    bachelorStayBackYears: 1.0,
    phdStayBackYears: 2.0,
    avgSalaryEur: 34000,
    visaSummary:
      'D-10 job-seeker visa (6-month increments up to 1–2 years) to transition into E-7 skilled employment.',
  },
};

function findCountryIntelKey(country?: string): string | undefined {
  if (!country) return undefined;
  const normalized = normalizeCountryName(country) || country.trim();
  return Object.keys(COUNTRY_INTEL_MAP).find(
    (k) => k.toLowerCase() === normalized.toLowerCase()
  );
}

export function hasOfficialCountryVisaIntel(country?: string): boolean {
  return Boolean(findCountryIntelKey(country));
}

export function isStemProgram(programName?: string, category?: string): boolean {
  const hay = `${programName || ''} ${category || ''}`.toLowerCase();
  if (!hay.trim()) return false;
  return /\b(computer|software|ai|artificial intelligence|machine learning|data science|data analytics|analytics|cyber|engineering|robotics|biotech|biotechnology|biology|pharma|math|statistics|physics|chemistry|stem|technology|informatics|cloud|quantitative)\b/i.test(
    hay
  );
}

export function getCountryVisaIntel(
  country?: string,
  degreeLevel?: string,
  programName?: string,
  category?: string
): CountryVisaIntel {
  const key = findCountryIntelKey(country);
  const base = key
    ? COUNTRY_INTEL_MAP[key]
    : {
        stayBackYears: 1.0,
        avgSalaryEur: 36000,
        visaSummary: country
          ? `Post-study work permit rules apply in ${country}.`
          : 'Standard post-study work options available.',
      };

  const lvl = (degreeLevel || '').toLowerCase();
  const isPhd = lvl.includes('phd') || lvl.includes('doctor');
  const isDiploma =
    lvl.includes('diploma') || lvl.includes('certificate') || lvl.includes('vocational');
  const isUg =
    !isDiploma &&
    (lvl.includes('bachelor') || lvl.includes('undergraduate') || lvl === 'ug');

  let resolvedStay = base.stayBackYears;

  if (isPhd && base.phdStayBackYears !== undefined) {
    resolvedStay = base.phdStayBackYears;
  } else if (isDiploma && base.diplomaStayBackYears !== undefined) {
    resolvedStay = base.diplomaStayBackYears;
  } else if (isUg && base.bachelorStayBackYears !== undefined) {
    resolvedStay = base.bachelorStayBackYears;
  }

  if (
    base.stemStayBackYears !== undefined &&
    !isPhd &&
    !isDiploma &&
    isStemProgram(programName, category)
  ) {
    resolvedStay = base.stemStayBackYears;
  }

  return { ...base, stayBackYears: resolvedStay };
}

export function resolveOfficialStayBackYears(
  country?: string,
  degreeLevel?: string,
  programName?: string,
  fallbackYears?: number,
  category?: string
): number {
  if (hasOfficialCountryVisaIntel(country)) {
    return getCountryVisaIntel(country, degreeLevel, programName, category).stayBackYears;
  }
  const num = Number(fallbackYears);
  return Number.isFinite(num) && num > 0 ? num : 1.0;
}

export function formatStayBack(years?: number): string {
  if (!years || years <= 0) return 'N/A';
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} Months`;
  }
  if (Math.abs(years - 1.5) < 0.02) {
    return '18 Months';
  }
  if (Math.abs(years - 1) < 0.02) {
    return '1 Year';
  }
  return `${Number(years.toFixed(1))} Years`;
}
