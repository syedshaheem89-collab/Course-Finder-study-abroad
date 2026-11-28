import { normalizeCountryName } from '@/lib/countries';
import { classifyUniversityType } from '@/lib/university-classification';

export interface ExpertCountryRule {
  country: string;
  nonEuFeeRule: string;
  defaultPublicBachelorLanguage?:
    | 'German'
    | 'Italian'
    | 'French'
    | 'Spanish'
    | 'Dutch'
    | 'Polish'
    | 'Japanese'
    | 'Korean';
  defaultPublicBachelorProficiency?: string;
  officialRegistryName: string;
  officialRegistryUrl: string;
  counselorTips: string;
}

export const EXPERT_COUNTRY_RULES: Record<string, ExpertCountryRule> = {
  Albania: {
    country: 'Albania',
    nonEuFeeRule: 'International / Foreign student annual tuition in ALL or EUR (~€1,500–€3,500/yr); English-medium private/medical faculties may bill €4,000–€8,000/yr.',
    officialRegistryName: 'Study in Albania / QSHA',
    officialRegistryUrl: 'https://www.qsha.gov.al',
    counselorTips: 'Verify English vs Albanian instruction explicitly; non-EU students get 9-month post-study stay-back under Article 51 of Law No. 79/2021.',
  },
  Australia: {
    country: 'Australia',
    nonEuFeeRule: 'ONLY International / Overseas Student tuition in AUD (NEVER Commonwealth Supported / CSP domestic fees); typical range A$28,000–A$55,000/yr.',
    officialRegistryName: 'CRICOS',
    officialRegistryUrl: 'https://cricos.education.gov.au',
    counselorTips: 'Only CRICOS-registered full-time courses qualify for Subclass 500 & 485 Post-Study Work visas (regional campuses add +1 yr).',
  },
  Austria: {
    country: 'Austria',
    nonEuFeeRule: 'Austrian public universities charge statutory Non-EU tuition of €726.72/semester (€1,453.44/yr) + ~€24.70/sem ÖH student union fee; private universities (e.g. MODUL, Webster) charge €10,000–€24,000/yr.',
    defaultPublicBachelorLanguage: 'German',
    defaultPublicBachelorProficiency: 'German B2',
    officialRegistryName: 'Studienwahl.at (OeAD)',
    officialRegistryUrl: 'https://www.studienwahl.at/en',
    counselorTips: 'Public Bachelor programmes in Austria are predominantly German-taught (B2/C1) even when the website navigation uses /en/; rare English-taught Bachelor exceptions (like JKU BA Artificial Intelligence) state English explicitly.',
  },
  Belgium: {
    country: 'Belgium',
    nonEuFeeRule: 'Non-EEA international tuition in EUR (Flanders €1,500–€7,500/yr; Wallonia €4,175/yr statutory assimilated/non-EU rate unless exempted).',
    officialRegistryName: 'Study in Flanders / Study in Belgium',
    officialRegistryUrl: 'https://www.studyinflanders.be',
    counselorTips: 'Check whether the campus is Flemish-community (KU Leuven, UGent, VUB) or French-community (UCLouvain, ULB) because non-EEA rates and language exemptions differ by region.',
  },
  Bulgaria: {
    country: 'Bulgaria',
    nonEuFeeRule: 'Non-EU international tuition in EUR (€3,000–€9,000/yr; Medicine/Dentistry in English typically €8,000–€9,500/yr).',
    officialRegistryName: 'Bulgarian Ministry of Education',
    officialRegistryUrl: 'https://www.mon.bg',
    counselorTips: 'Medical and Engineering English tracks require direct faculty confirmation of entry exams or biology/chemistry transcripts.',
  },
  Canada: {
    country: 'Canada',
    nonEuFeeRule: 'ONLY International student tuition in CAD (NEVER Domestic/Canadian Citizen rate); verify DLI status & PGWP eligibility (typically CA$18,000–CA$45,000/yr).',
    officialRegistryName: 'EduCanada (DLI List)',
    officialRegistryUrl: 'https://www.educanada.ca',
    counselorTips: 'For diplomas and colleges, verify field-of-study PGWP eligibility and provincial attestation letter (PAL) rules.',
  },
  Cyprus: {
    country: 'Cyprus',
    nonEuFeeRule: 'Non-EU international tuition in EUR (€3,500–€10,000/yr at private colleges/universities; public UCY/CUT non-EU undergraduate ~€6,834/yr).',
    officialRegistryName: 'Cyprus Agency of Quality Assurance (CYQAA)',
    officialRegistryUrl: 'https://www.dipae.ac.cy',
    counselorTips: 'Republic of Cyprus (EU) accreditation via CYQAA is essential; clarify whether tuition covers full academic year vs 60 ECTS.',
  },
  'Czech Republic': {
    country: 'Czech Republic',
    nonEuFeeRule: 'Free ONLY in Czech-taught public tracks; English-taught programmes charge international tuition in CZK or EUR (~€2,500–€14,000/yr).',
    officialRegistryName: 'Study in Czechia',
    officialRegistryUrl: 'https://www.studyin.cz',
    counselorTips: 'Always confirm nostrification (recognition of prior diploma) deadlines early, as public universities require it before enrolment.',
  },
  Denmark: {
    country: 'Denmark',
    nonEuFeeRule: 'ONLY Non-EU/EEA international tuition in EUR or DKK (EU/EEA free; Non-EU typically €8,000–€16,000/yr).',
    officialRegistryName: 'Study in Denmark',
    officialRegistryUrl: 'https://studyindenmark.dk',
    counselorTips: 'Bachelor degrees taught in English have limited quotas; confirm Mathematics/English upper-secondary hour minimums.',
  },
  Estonia: {
    country: 'Estonia',
    nonEuFeeRule: 'Non-EU international tuition in EUR (typically €3,000–€7,500/yr; tuition-waiver scholarships exist competitively).',
    officialRegistryName: 'Study in Estonia',
    officialRegistryUrl: 'https://www.studyinestonia.ee',
    counselorTips: 'Note the 9-month post-study stay-back permit and DreamApply centralized portal deadlines.',
  },
  Finland: {
    country: 'Finland',
    nonEuFeeRule: 'ONLY Non-EU/EEA tuition in EUR for English-taught degrees (EU/EEA & Finnish/Swedish tracks free; Non-EU typically €8,000–€18,000/yr).',
    officialRegistryName: 'Studyinfo.fi (Opintopolku)',
    officialRegistryUrl: 'https://studyinfo.fi',
    counselorTips: 'Separate joint application vs rolling admission windows apply in Jan/Mar; non-EU students have 2-year post-study residence permit.',
  },
  France: {
    country: 'France',
    nonEuFeeRule: 'Public differentiated Non-EU fees (€2,850/yr Bachelor, €3,879/yr Master; some universities grant partial exoneration to €175–€250/yr); Grandes Écoles/private charge €8,000–€25,000/yr.',
    defaultPublicBachelorLanguage: 'French',
    defaultPublicBachelorProficiency: 'French B2',
    officialRegistryName: 'Campus France',
    officialRegistryUrl: 'https://www.campusfrance.org',
    counselorTips: 'Check Études en France portal countries; most public Licences require French B2 unless explicitly listed in English.',
  },
  Georgia: {
    country: 'Georgia',
    nonEuFeeRule: 'International student tuition billed in USD ($3,000–$8,500/yr; Medicine MD tracks typically $4,500–$8,000/yr).',
    officialRegistryName: 'Study in Georgia (MES)',
    officialRegistryUrl: 'https://studyingeorgia.ge',
    counselorTips: 'For Medicine (MD), check NMC/WFME accreditation if the student plans licensing exams abroad; note Georgia has no automatic post-study job-seeker visa.',
  },
  Germany: {
    country: 'Germany',
    nonEuFeeRule: 'Public universities charge €0 tuition in 14 states (semester contribution ~€150–€350/sem), EXCEPT Baden-Württemberg (€1,500/sem = €3,000/yr Non-EU) & TUM Bavaria (€2,000–€6,000/sem); private universities charge €8,000–€20,000/yr.',
    defaultPublicBachelorLanguage: 'German',
    defaultPublicBachelorProficiency: 'German B2',
    officialRegistryName: 'DAAD International Programmes',
    officialRegistryUrl: 'https://www.daad.de/en',
    counselorTips: 'Public Bachelor programmes are overwhelmingly German-taught (DSH-2 / TestDaF 4 / B2-C1) unless listed in DAAD International Programmes; verify uni-assist & APS requirements.',
  },
  Hungary: {
    country: 'Hungary',
    nonEuFeeRule: 'Fee-paying Non-EU international tuition in EUR/USD (€3,500–€9,000/yr; Medicine ~€16,000/yr) unless admitted via Stipendium Hungaricum.',
    officialRegistryName: 'Study in Hungary',
    officialRegistryUrl: 'https://studyinhungary.hu',
    counselorTips: 'Differentiate self-financed international tuition from Stipendium Hungaricum scholarship tracks.',
  },
  Ireland: {
    country: 'Ireland',
    nonEuFeeRule: 'ONLY Non-EU International student tuition in EUR (typically €12,000–€28,000/yr; NEVER EU free-fees rate).',
    officialRegistryName: 'Education in Ireland (HEA)',
    officialRegistryUrl: 'https://www.educationinireland.com',
    counselorTips: 'NFQ Level 7/8 UG offers 1-year Stamp 1G stay-back; Level 9 Masters/PGDip qualifies for 2-year Stamp 1G post-study work.',
  },
  Italy: {
    country: 'Italy',
    nonEuFeeRule: 'Public regional/ISEE-based tuition (€156–€3,500/yr depending on ISEE Parificato / DSU); private schools (Bocconi, Cattolica, Politecnico private tracks) €8,000–€18,000/yr.',
    defaultPublicBachelorLanguage: 'Italian',
    defaultPublicBachelorProficiency: 'Italian B2',
    officialRegistryName: 'Universitaly',
    officialRegistryUrl: 'https://www.universitaly.it',
    counselorTips: 'Standard public Laurea Triennale courses are taught in Italian (B2) unless explicitly listed as English-taught or IMAT Medicine; verify CIMEA & Universitaly pre-enrolment.',
  },
  Japan: {
    country: 'Japan',
    nonEuFeeRule: 'National/public universities ~¥535,800/yr (~€3,300/yr) + admission fee ¥282,000; private universities ¥900,000–¥1,800,000/yr (~€5,500–€11,000/yr).',
    defaultPublicBachelorLanguage: 'Japanese',
    defaultPublicBachelorProficiency: 'Japanese N2',
    officialRegistryName: 'JASSO Study in Japan',
    officialRegistryUrl: 'https://www.studyinjapan.go.jp',
    counselorTips: 'Verify G30 / English-taught track availability explicitly; otherwise JLPT N2/N1 is mandatory.',
  },
  Latvia: {
    country: 'Latvia',
    nonEuFeeRule: 'Non-EU/EEA international tuition in EUR (€2,500–€6,500/yr general; Medicine ~€12,000/yr).',
    officialRegistryName: 'Study in Latvia (VIAA)',
    officialRegistryUrl: 'https://www.studyinlatvia.lv',
    counselorTips: 'AIC academic credential verification and embassy interview are standard for Non-EU applicants; many Bachelor/Master programmes accept MOI or IELTS 5.5–6.0.',
  },
  Lithuania: {
    country: 'Lithuania',
    nonEuFeeRule: 'Non-EU/EEA international tuition in EUR (typically €2,800–€7,500/yr; Health/Medicine ~€10,000–€13,000/yr).',
    officialRegistryName: 'Study in LT',
    officialRegistryUrl: 'https://studyin.lt',
    counselorTips: 'SKVC credential recognition is required before final offer; Non-EU graduates get a 12-month temporary residence extension for job search.',
  },
  Luxembourg: {
    country: 'Luxembourg',
    nonEuFeeRule: 'Public University of Luxembourg charges modest per-semester enrolment fees (€400–€800/yr typical, except specialized Masters €4,000–€5,200/sem).',
    officialRegistryName: 'Uni.lu / Guichet.lu',
    officialRegistryUrl: 'https://www.uni.lu',
    counselorTips: 'Many Bachelor programmes at Uni.lu are multilingual (French/German/English B2), whereas select Masters are English-only.',
  },
  Malta: {
    country: 'Malta',
    nonEuFeeRule: 'Non-EU/EEA international tuition in EUR (UM public €8,500–€14,000/yr; MCAST/MQF Level 5-6 Diplomas €5,500–€7,500/yr; NEVER EU €0 fee).',
    officialRegistryName: 'MFHEA / University of Malta / MCAST',
    officialRegistryUrl: 'https://mfhea.mt',
    counselorTips: 'Match MQF Level cleanly (Level 5 Undergraduate Diploma / HND, Level 6 Bachelor, Level 7 Master / PGDip); English is an official language so MOI/IELTS pathways apply cleanly.',
  },
  Netherlands: {
    country: 'Netherlands',
    nonEuFeeRule: 'ONLY Institutional Non-EU/EEA tuition in EUR (NEVER Statutory €2,530 EU rate); Bachelor €9,500–€18,000/yr, Master €14,000–€25,000/yr.',
    officialRegistryName: 'Study in NL (Nuffic)',
    officialRegistryUrl: 'https://www.studyinnl.org',
    counselorTips: 'Check WO (research university) vs HBO (applied sciences) and numerus fixus Jan 15 deadlines.',
  },
  'New Zealand': {
    country: 'New Zealand',
    nonEuFeeRule: 'ONLY International student tuition in NZD (typically NZ$32,000–NZ$48,000/yr; PhD students pay domestic fees).',
    officialRegistryName: 'Study with New Zealand (ENZ)',
    officialRegistryUrl: 'https://www.studywithnewzealand.govt.nz',
    counselorTips: 'Verify NZQA Level 7/8/9 status because post-study work visa duration (up to 3 years for Bachelor/Master) depends on qualification level.',
  },
  Norway: {
    country: 'Norway',
    nonEuFeeRule: 'Non-EU/EEA students NOW PAY full tuition since 2023 (typically NOK 100,000–250,000/yr ≈ €8,500–€22,000/yr at public universities); NEVER report €0 for Non-EU.',
    officialRegistryName: 'Study in Norway',
    officialRegistryUrl: 'https://studyinnorway.no',
    counselorTips: 'Critical 2023+ policy change: Non-EU tuition is mandatory even at NTNU, UiO, and UiB; confirm exact NOK institutional rate.',
  },
  Poland: {
    country: 'Poland',
    nonEuFeeRule: 'Non-EU international tuition in EUR/PLN for English-taught degrees (typically €2,000–€6,000/yr; Medicine ~€11,000–€15,000/yr).',
    officialRegistryName: 'Study in Poland / NAWA',
    officialRegistryUrl: 'https://study.gov.pl',
    counselorTips: 'Ensure university holds Polish Accreditation Committee (PKA) status and confirm whether PLN fee translates reliably to EUR.',
  },
  Portugal: {
    country: 'Portugal',
    nonEuFeeRule: 'International Student Statute (Estudante Internacional) tuition in EUR (€3,000–€7,500/yr at public universities like Lisbon/Porto; private €5,000–€12,000/yr).',
    officialRegistryName: 'Study & Research in Portugal (DGES)',
    officialRegistryUrl: 'https://www.study-research.pt',
    counselorTips: 'Always pick Estudante Internacional fee band rather than EU national fee (~€697/yr).',
  },
  Singapore: {
    country: 'Singapore',
    nonEuFeeRule: 'International Non-Subsidised / Non-MOE Grant tuition in SGD (typically S$30,000–S$58,000/yr unless Tuition Grant bond is explicitly chosen).',
    officialRegistryName: 'SkillsFuture / CPE EduTrust',
    officialRegistryUrl: 'https://www.tpgateway.gov.sg',
    counselorTips: 'Check whether private institutes carry valid 4-year EduTrust certification and distinguish subsidized vs full international fees.',
  },
  'South Korea': {
    country: 'South Korea',
    nonEuFeeRule: 'International student tuition in KRW or USD (public national ₩4M–₩6M/yr ≈ €2,700–€4,200; private ₩8M–₩12M/yr ≈ €5,500–€8,500; scholarships often reduce 30–50%).',
    defaultPublicBachelorLanguage: 'Korean',
    defaultPublicBachelorProficiency: 'TOPIK 3',
    officialRegistryName: 'Study in Korea (NIIED)',
    officialRegistryUrl: 'https://www.studyinkorea.go.kr',
    counselorTips: 'Check whether track is GSIS / UIC / English-track vs Korean-track (TOPIK 3–4 required).',
  },
  Spain: {
    country: 'Spain',
    nonEuFeeRule: 'Public universities charge €1,000–€4,500/yr (per-credit EU/non-EU regional rates vary by Madrid/Catalonia); private universities charge €8,000–€22,000/yr.',
    defaultPublicBachelorLanguage: 'Spanish',
    defaultPublicBachelorProficiency: 'Spanish B2',
    officialRegistryName: 'SEPIE Study in Spain',
    officialRegistryUrl: 'https://www.sepie.es',
    counselorTips: 'Verify Madrid/Catalonia non-EU credit multiplier (often higher than resident fee); public Bachelor degrees usually require Spanish B2 + UNEDassis.',
  },
  Sweden: {
    country: 'Sweden',
    nonEuFeeRule: 'ONLY Non-EU/EEA international tuition in SEK (EU/EEA free; Non-EU SEK 90,000–160,000/yr ≈ €8,000–€14,500/yr).',
    officialRegistryName: 'Universityadmissions.se',
    officialRegistryUrl: 'https://www.universityadmissions.se',
    counselorTips: 'Applications run centrally on Universityadmissions.se (round 1 closes mid-January for Autumn); always extract SEK Non-EU fee.',
  },
  Switzerland: {
    country: 'Switzerland',
    nonEuFeeRule: 'Cantonal public universities/ETH charge modest CHF 1,460–CHF 4,500/yr (ETH Zurich CHF 1,460–4,380/yr with international adjustment); private hospitality/business schools charge CHF 20,000–CHF 45,000/yr.',
    defaultPublicBachelorLanguage: 'German',
    defaultPublicBachelorProficiency: 'German C1',
    officialRegistryName: 'studyinswitzerland+ (swissuniversities)',
    officialRegistryUrl: 'https://www.studyinswitzerland.plus',
    counselorTips: 'ETH/EPFL/UZH public Bachelors almost universally require German or French C1; English is primarily at Master level.',
  },
  'United Arab Emirates': {
    country: 'United Arab Emirates',
    nonEuFeeRule: 'International tuition in AED (AED 40,000–AED 95,000/yr ≈ €10,000–€24,000/yr); verify UAE CAA vs KHDA branch accreditation.',
    officialRegistryName: 'Study in UAE (MOE / KHDA)',
    officialRegistryUrl: 'https://www.moe.gov.ae',
    counselorTips: 'Confirm whether UAE federal CAA accreditation (required for UAE government employment) or Dubai KHDA branch campus licence applies.',
  },
  'United Kingdom': {
    country: 'United Kingdom',
    nonEuFeeRule: 'ONLY International / Overseas tuition fee in GBP (typically £15,000–£38,000/yr; NEVER Home/UK £9,535/yr fee).',
    officialRegistryName: 'UCAS / Discover Uni',
    officialRegistryUrl: 'https://www.ucas.com',
    counselorTips: 'Distinguish standard 3-year UG (or 4-year Scotland) and 1-year taught Master vs placement-year tracks; check UKVI Student Route sponsorship.',
  },
  USA: {
    country: 'USA',
    nonEuFeeRule: 'ONLY International / Non-Resident / Out-of-State tuition in USD (typically $22,000–$65,000/yr; NEVER In-State resident fee).',
    officialRegistryName: 'EducationUSA',
    officialRegistryUrl: 'https://educationusa.state.gov',
    counselorTips: 'Verify SEVP certification (F-1 I-20) and STEM OPT (36-month) CIP code eligibility for tech/science/quantitative majors.',
  },
};

export function getExpertCountryRule(country?: string | null): ExpertCountryRule | null {
  const raw = String(country || '').trim();
  if (!raw) return null;
  const norm = normalizeCountryName(raw) || raw;
  if (EXPERT_COUNTRY_RULES[norm]) return EXPERT_COUNTRY_RULES[norm];
  const lower = norm.toLowerCase();
  for (const [k, v] of Object.entries(EXPERT_COUNTRY_RULES)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

const AUSTRIA_PRIVATE_RE =
  /\b(?:modul|webster|central european|ceu|sigmund freud|lauder|new design|danube private|seeburg|paracelsus|anton bruckner)\b/i;

const GERMANY_FEE_EXCEPTION_RE =
  /\b(?:heidelberg|kit\b|karlsruhe|freiburg|stuttgart|t[uü]bingen|mannheim|ulm|konstanz|hohenheim|esslingen|reutlingen|furtwangen|pforzheim|heilbronn|technical university of munich|tu munich|\btum\b|technische universit[aä]t m[uü]nchen)\b/i;

export function getStatutoryPublicTuition(
  country?: string | null,
  universityName?: string | null,
  sector?: string | null
): { tuitionEur: number; originalAmount: number; currency: string; quote: string } | null {
  const ruleCountry = normalizeCountryName(String(country || '').trim()) || String(country || '').trim();
  const uni = String(universityName || '').trim();
  if (!ruleCountry || !uni) return null;

  const resolvedSector = sector || classifyUniversityType(uni, ruleCountry);
  if (resolvedSector !== 'Public') return null;

  if (ruleCountry === 'Austria') {
    if (AUSTRIA_PRIVATE_RE.test(uni)) return null;
    return {
      tuitionEur: 1454,
      originalAmount: 1454,
      currency: 'EUR',
      quote: 'Statutory Austrian public university Non-EU tuition (€726.72/semester × 2 + ~€24.70/sem ÖH fee).',
    };
  }

  if (ruleCountry === 'Germany') {
    if (GERMANY_FEE_EXCEPTION_RE.test(uni)) return null;
    return {
      tuitionEur: 0,
      originalAmount: 0,
      currency: 'EUR',
      quote: 'Statutory German public university tuition (€0 Non-EU tuition outside Baden-Württemberg/TUM; semester contribution ~€150–€350/sem).',
    };
  }

  return null;
}

export function buildExpertCounselorPromptDirectives(params: {
  country: string;
  degreeLevel?: string;
  universityName?: string;
  teachingLanguageHint?: string | null;
  proficiencyHint?: string | null;
}): string {
  const rule = getExpertCountryRule(params.country);
  if (!rule) return '';

  const degLower = String(params.degreeLevel || '').toLowerCase();
  const isBachelor = /\b(?:bachelor|bsc|ba|beng|bba|llb|undergraduate|ug|diploma)\b/.test(degLower);
  const langLines: string[] = [];

  if (isBachelor && rule.defaultPublicBachelorLanguage) {
    langLines.push(
      `LANGUAGE DEFAULT CHECK: Public ${params.country} Bachelor programmes are typically taught in ${rule.defaultPublicBachelorLanguage} (${rule.defaultPublicBachelorProficiency || 'B2'}) UNLESS the official course page explicitly says English is the Language of Instruction. Do NOT treat an /en/ website translation URL alone as proof of English instruction.`
    );
  }

  if (
    params.teachingLanguageHint &&
    params.teachingLanguageHint.toLowerCase() !== 'english'
  ) {
    langLines.push(
      `LANGUAGE CONSISTENCY RULE: This programme's expected teaching language is ${params.teachingLanguageHint}${params.proficiencyHint ? ` (${params.proficiencyHint})` : ''}. NEVER claim it is taught or offered in English unless the official university page explicitly confirms English-only instruction.`
    );
  }

  return [
    `20-YEAR STUDY ABROAD COUNSELOR RULES (${rule.country.toUpperCase()}):`,
    `- Non-EU / International Fee Law: ${rule.nonEuFeeRule}`,
    `- Counselor Audit Note: ${rule.counselorTips}`,
    `- Official National Reference: ${rule.officialRegistryName} (${rule.officialRegistryUrl})`,
    ...langLines.map((l) => `- ${l}`),
  ].join('\n');
}
