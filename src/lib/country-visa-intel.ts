export interface CountryVisaIntel {
  stayBackYears: number;
  bachelorStayBackYears?: number;
  avgSalaryEur: number;
  visaSummary: string;
}

const COUNTRY_INTEL_MAP: Record<string, CountryVisaIntel> = {
  Germany: {
    stayBackYears: 1.5,
    bachelorStayBackYears: 1.5,
    avgSalaryEur: 52000,
    visaSummary: '18-month post-study job-seeker residence permit; public universities largely tuition-free.',
  },
  'United Kingdom': {
    stayBackYears: 2.0,
    bachelorStayBackYears: 2.0,
    avgSalaryEur: 38000,
    visaSummary: '2-year Graduate Route post-study work visa (3 years for PhD).',
  },
  UK: {
    stayBackYears: 2.0,
    bachelorStayBackYears: 2.0,
    avgSalaryEur: 38000,
    visaSummary: '2-year Graduate Route post-study work visa (3 years for PhD).',
  },
  Ireland: {
    stayBackYears: 2.0,
    bachelorStayBackYears: 1.0,
    avgSalaryEur: 44000,
    visaSummary: 'Stamp 1G stay-back: 2 years for Masters/PhD, 1 year for Bachelor graduates.',
  },
  Latvia: {
    stayBackYears: 1.0,
    bachelorStayBackYears: 0.33,
    avgSalaryEur: 24000,
    visaSummary: 'Master/PhD: up to 9-month extension (~13 mo total); Bachelor: 4-month post-completion permit.',
  },
  Denmark: {
    stayBackYears: 3.0,
    avgSalaryEur: 54000,
    visaSummary: 'Up to 3-year job-seeking residence permit after completing Danish higher education.',
  },
  Sweden: {
    stayBackYears: 1.0,
    avgSalaryEur: 42000,
    visaSummary: '12-month residence permit to look for work or start a business.',
  },
  Netherlands: {
    stayBackYears: 1.0,
    avgSalaryEur: 46000,
    visaSummary: '1-year Orientation Year (Zoekjaar) permit for graduates.',
  },
  France: {
    stayBackYears: 2.0,
    avgSalaryEur: 40000,
    visaSummary: 'Up to 2-year APS / RECE job-seeker permit for Master graduates.',
  },
  Malta: {
    stayBackYears: 1.0,
    avgSalaryEur: 28000,
    visaSummary: '9–12 month post-study work search extension & Get Qualified up to 70% tax rebate.',
  },
  Australia: {
    stayBackYears: 2.0,
    avgSalaryEur: 50000,
    visaSummary: 'Subclass 485 Temporary Graduate visa (2–3 years; extra 1–2 years in regional areas).',
  },
  Canada: {
    stayBackYears: 3.0,
    avgSalaryEur: 48000,
    visaSummary: 'Post-Graduation Work Permit (PGWP) up to 3 years.',
  },
  Finland: {
    stayBackYears: 2.0,
    avgSalaryEur: 42000,
    visaSummary: '2-year residence permit to look for work or start a business.',
  },
  Italy: {
    stayBackYears: 1.0,
    avgSalaryEur: 34000,
    visaSummary: '12-month post-graduation job-seeking permit + DSU regional scholarships.',
  },
  Spain: {
    stayBackYears: 1.0,
    avgSalaryEur: 32000,
    visaSummary: '12-month job-search / entrepreneurship residence permit.',
  },
};

export function getCountryVisaIntel(country?: string, degreeLevel?: string): CountryVisaIntel {
  const base = !country
    ? { stayBackYears: 1.5, avgSalaryEur: 38000, visaSummary: 'Standard post-study work options available.' }
    : (() => {
        const key = Object.keys(COUNTRY_INTEL_MAP).find(
          (k) => k.toLowerCase() === country.trim().toLowerCase()
        );
        return key
          ? COUNTRY_INTEL_MAP[key]
          : { stayBackYears: 1.5, avgSalaryEur: 36000, visaSummary: `Post-study work permit rules apply in ${country}.` };
      })();

  const lvl = (degreeLevel || '').toLowerCase();
  const isUg =
    lvl.includes('bachelor') ||
    lvl.includes('undergraduate') ||
    lvl.includes('ug diploma') ||
    lvl.includes('certificate');

  if (isUg && base.bachelorStayBackYears !== undefined) {
    return { ...base, stayBackYears: base.bachelorStayBackYears };
  }
  return base;
}

export function formatStayBack(years?: number): string {
  if (!years || years <= 0) return 'N/A';
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} Months`;
  }
  return years === 1 ? '1 Year' : `${years} Years`;
}
