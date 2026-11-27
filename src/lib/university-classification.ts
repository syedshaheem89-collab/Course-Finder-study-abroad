import { normalizeCountryName } from '@/lib/countries';

export type UniversitySector = 'Public' | 'Private';
export type SectorFilter = 'all' | 'Public' | 'Private';

export interface PriorityUniversityRule {
  id: string;
  country: string;
  university_name: string;
  rank: number;
  sector_override?: 'Auto' | 'Public' | 'Private';
  note?: string;
}

export const SUBJECT_GROUPS: string[] = [
  'Computer Science & AI',
  'Data Science',
  'Engineering',
  'Business & Management',
  'Healthcare & Life Sciences',
];

const SUBJECT_KEYWORDS_MAP: Record<string, string[]> = {
  'Computer Science & AI': [
    'computer',
    'computing',
    'artificial intelligence',
    'machine learning',
    'software',
    'cyber',
    'cloud',
    'information technology',
    'web development',
    'informatics',
    'digital',
    'robotics',
  ],
  'Data Science': [
    'data science',
    'data analytics',
    'analytics',
    'big data',
    'business intelligence',
    'statistics',
    'quantitative',
    'machine learning',
    'artificial intelligence',
  ],
  Engineering: [
    'engineering',
    'mechanical',
    'electrical',
    'electronic',
    'civil',
    'mechatronics',
    'automotive',
    'aerospace',
    'renewable',
    'energy',
    'industrial',
    'logistics',
    'supply chain',
    'manufacturing',
    'chemical',
  ],
  'Business & Management': [
    'business',
    'management',
    'mba',
    'finance',
    'accounting',
    'marketing',
    'economics',
    'banking',
    'fintech',
    'entrepreneurship',
    'human resource',
    'commerce',
    'strategy',
    'international trade',
    'supply chain',
    'hospitality',
    'tourism',
  ],
  'Healthcare & Life Sciences': [
    'health',
    'nursing',
    'public health',
    'medicine',
    'medical',
    'pharmacy',
    'pharma',
    'biotechnology',
    'biotech',
    'biology',
    'biomedical',
    'clinical',
    'psychology',
    'life science',
    'nutrition',
    'physiotherapy',
  ],
};

export function getSubjectKeywords(subject: string): string[] {
  const clean = String(subject || '').trim();
  if (!clean) return [];
  const exactKey = Object.keys(SUBJECT_KEYWORDS_MAP).find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );
  if (exactKey) return SUBJECT_KEYWORDS_MAP[exactKey];
  return [clean.toLowerCase()];
}

export function matchesSubjectGroup(
  course: { category?: string | null; program_name?: string | null },
  subject: string
): boolean {
  const clean = String(subject || '').trim();
  if (!clean) return true;
  const cat = String(course.category || '').toLowerCase();
  if (cat === clean.toLowerCase()) return true;
  const title = String(course.program_name || '').toLowerCase();
  const hay = `${title} ${cat}`;
  const keywords = getSubjectKeywords(clean);
  return keywords.some((kw) => hay.includes(kw));
}

export function sanitizePriorityRules(input: unknown): PriorityUniversityRule[] {
  if (!Array.isArray(input)) return [];
  const deduped = new Map<string, PriorityUniversityRule>();

  for (let i = 0; i < input.length && deduped.size < 300; i++) {
    const raw = input[i] as Record<string, any> | null;
    if (!raw || typeof raw !== 'object') continue;

    const uniName = String(raw.university_name || raw.universityName || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    if (uniName.length < 2) continue;

    const rawCountry = String(raw.country || '').trim();
    const country = normalizeCountryName(rawCountry) || rawCountry.slice(0, 80);
    if (!country) continue;

    const rawRank = Number(raw.rank);
    const rank = Number.isFinite(rawRank) ? Math.min(999, Math.max(1, Math.round(rawRank))) : 1;

    const rawOverride = String(raw.sector_override || raw.sectorOverride || 'Auto').trim();
    const sectorOverride: 'Auto' | 'Public' | 'Private' =
      rawOverride === 'Public' || rawOverride === 'Private' ? rawOverride : 'Auto';

    const note = String(raw.note || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const id =
      String(raw.id || '').trim().slice(0, 80) ||
      `prio-${country.toLowerCase().replace(/[^a-z0-9]/g, '')}-${uniName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 24)}`;

    const key = `${country.toLowerCase()}::${uniName.toLowerCase()}`;
    deduped.set(key, {
      id,
      country,
      university_name: uniName,
      rank,
      sector_override: sectorOverride,
      note: note || undefined,
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const cmp = a.country.localeCompare(b.country);
    return cmp !== 0 ? cmp : a.rank - b.rank;
  });
}

export function getPriorityUniversityMatch(
  uniName: string,
  country: string | undefined,
  priorityRules: PriorityUniversityRule[]
): { isPriority: boolean; rank: number; rule?: PriorityUniversityRule } {
  const cleanUni = String(uniName || '').trim().toLowerCase();
  if (!cleanUni || !Array.isArray(priorityRules) || priorityRules.length === 0) {
    return { isPriority: false, rank: 9999 };
  }

  const normalizedCourseCountry = country ? (normalizeCountryName(country) || country).toLowerCase() : '';

  let bestExact: PriorityUniversityRule | undefined;
  let bestPartial: PriorityUniversityRule | undefined;

  for (const rule of priorityRules) {
    const ruleUni = rule.university_name.trim().toLowerCase();
    if (!ruleUni) continue;

    if (normalizedCourseCountry && rule.country) {
      const ruleCountry = (normalizeCountryName(rule.country) || rule.country).toLowerCase();
      if (ruleCountry !== normalizedCourseCountry) continue;
    }

    if (cleanUni === ruleUni) {
      if (!bestExact || rule.rank < bestExact.rank) bestExact = rule;
      continue;
    }

    if (cleanUni.length >= 5 && ruleUni.length >= 5) {
      if (cleanUni.includes(ruleUni) || ruleUni.includes(cleanUni)) {
        if (!bestPartial || rule.rank < bestPartial.rank) bestPartial = rule;
      }
    }
  }

  const matched = bestExact || bestPartial;
  if (!matched) {
    return { isPriority: false, rank: 9999 };
  }
  return {
    isPriority: true,
    rank: matched.rank,
    rule: matched,
  };
}

type PatternRule = string | RegExp;

const PRIVATE_PATTERNS_BY_COUNTRY: Record<string, PatternRule[]> = {
  Germany: [
    /\bsrh\b/,
    'iu international',
    /\biubh\b/,
    'gisma',
    /\bbsbi\b/,
    'berlin school of business',
    'university of europe',
    'dresden international university',
    'frankfurt school of finance',
    /\bwhu\b/,
    /\besmt\b/,
    /\bescp\b/,
    'kühne logistics',
    'kuehne logistics',
    /\bhhl\b/,
    'ebs universität',
    'ebs university',
    'hertie school',
    'bucerius',
    'zeppelin university',
    'witten/herdecke',
    'fresenius',
    'international school of management',
    '(ism)',
    /\bism\b/,
    'accadis',
    'bbw hochschule',
    /\bhdbw\b/,
    'bavarian university of business',
    'wedel',
    'friedensau',
    'sdi münchen',
    'liebenzell',
    'psychoanalytic university',
    'merz akademie',
    'ifs internationale',
    'macromedia',
    'cbs international',
    /\bfom\b/,
    'munich business school',
    'constructor university',
    'jacobs university',
    'steinbeis',
    /\bpfh\b/,
    'eu business school',
    'schiller',
    'tomorrow university',
    'berlin international',
    'karlshochschule',
    'mediadesign',
    'code university',
    'xu exponential',
    'bard college',
    'touro',
    'victoria international',
  ],
  'United Kingdom': [
    /\blimited\b/,
    /\bltd\b/,
    /\bplc\b/,
    'global banking school',
    /\bgbs\b/,
    /\bbpp\b/,
    'university of law',
    /\bulaw\b/,
    'arden university',
    'hult',
    "regent's university",
    'regents university',
    'richmond american',
    /\bescp\b/,
    'le cordon bleu',
    'inchbald',
    'northeastern university london',
    'qa higher education',
    'oxford international',
    'kaplan',
    'navitas',
    'study group',
    'charitable trust',
    'learning trust',
    'theatre works',
    'theatre arts',
    'aviation training',
    'dancebox',
    'chicken shed',
    'circus arts',
    'boomsatsuma',
    /\blamda\b/,
    'laine theatre',
    'artsed',
    'performance preparation',
    'asu london',
    /\blsbf\b/,
    'london school of business and finance',
    /\bbimm\b/,
  ],
  Latvia: [
    'turiba',
    /\btsi\b/,
    'transport and telecommunication',
    /\beka\b/,
    'riseba',
    'global university',
    /\bisma\b/,
    'baltic international academy',
  ],
  Malta: [
    /\bgbs\b/,
    /\beci\b/,
    'global college malta',
    'ascencia',
    'american university of malta',
    'domain academy',
    'st martin',
    'central mediterranean',
    'learnkey',
    'idea college',
    'london school of commerce',
    'architecture',
  ],
  Poland: [
    'kozminski',
    'vistula',
    'wsb merito',
    'lazarski',
    'collegium civitas',
    /\bswps\b/,
    /\bpjatk\b/,
    'polish-japanese',
    'vizja',
    'vincent pol',
    /\bwsei\b/,
  ],
  Ireland: [
    'dublin business school',
    /\bdbs\b/,
    'griffith college',
    'independent college',
    'dorset college',
    'american college dublin',
    'cct college',
    'ibat',
    'national college of ireland',
    /\bnci\b/,
  ],
  Canada: [
    'university canada west',
    /\bucw\b/,
    'yorkville',
    'niagara university',
    /\bnyit\b/,
    'trinity western',
    'quest university',
    'crandall',
    'alexander college',
    'coquitlam college',
    'la salle',
    'trebas',
  ],
  France: [
    'edhec',
    'skema',
    'emlyon',
    'essec',
    'hec paris',
    'neoma',
    'kedge',
    'audencia',
    'epita',
    'epitech',
    'ieseg',
    'rennes school of business',
    'grenoble ecole',
    'montpellier business school',
    'isc paris',
    /\bpsb\b/,
    'inseec',
    /\bescp\b/,
  ],
  Spain: [
    'ie university',
    'esade',
    'iese',
    /\bucam\b/,
    'eu business school',
    /\besic\b/,
    'nebrija',
    'universidad europea',
    'camilo jose cela',
    'gbsb',
    'geneva business school',
  ],
  USA: [
    'northeastern',
    'new york university',
    /\bnyu\b/,
    /\busc\b/,
    'stanford',
    /\bmit\b/,
    'harvard',
    'columbia university',
    'cornell',
    'duke university',
    'boston university',
    'stevens institute',
    'pace university',
    'clark university',
    'drexel',
    'illinois institute',
    'rochester institute',
    'depaul',
    'hult',
    'webster',
    'monroe college',
    'campbellsville',
    'cumberlands',
    'trine university',
  ],
  Australia: [
    'kaplan business school',
    'torrens university',
    'bond university',
    'notre dame',
    'avondale',
    'alphacrucis',
  ],
  'United Arab Emirates': [
    'hult',
    'sp jain',
    'murdoch university dubai',
    'middlesex university dubai',
    'heriot-watt university dubai',
    'amity university dubai',
    'birla institute',
    'bits pilani dubai',
  ],
  Singapore: [
    'james cook university',
    'kaplan',
    'psb academy',
    'sim global',
    'curtin singapore',
    'amity global',
  ],
  Switzerland: [
    'les roches',
    'glion',
    'geneva business school',
    'eu business school',
    'bhms',
    'caesar ritz',
    'césar ritz',
  ],
  Netherlands: ['nyenrode', 'wittenborg', 'tio business school'],
  Sweden: ['chalmers', 'jIBS', 'jonkoping international'],
  Norway: ['bi norwegian'],
  Italy: ['bocconi', 'luiss', 'cattolica', 'domus academy', 'naba', 'ied ', 'marangoni'],
  Bulgaria: [
    'american university in bulgaria',
    /\baubg\b/,
    'varna university of management',
    /\bvum\b/,
    'new bulgarian university',
  ],
  Georgia: [
    'university of georgia',
    'caucasus university',
    'alte university',
    'free university of tbilisi',
    'international black sea university',
    /\bseu\b/,
    'georgian national university',
    'new vision',
    'east european university',
    'david tvildiani',
    'bau international',
    'grigol robakidze',
    'sulkhan-saba',
    'georgian american university',
    /\bgau\b/,
    'petre shotadze',
    'tbilisi medical academy',
    'european university',
    'british teaching university',
    'alterbridge',
    'tbilisi open university',
    'geomedi',
    'ken walker',
  ],
  Albania: [
    'epoka university',
    'university of new york tirana',
    /\bunyt\b/,
    'western balkan',
    'canadian institute of technology',
    'marubi',
    'polisi',
    'polis',
    'european university of tirana',
    /\buet\b/,
    'barleti',
    'beder',
    'bedër',
    'mediterranean university of albania',
    'luarasi',
    'albanian university',
    'tirana business university',
    /\btbu\b/,
    'metropolitan tirana',
    'wisdom',
  ],
  Austria: [
    'modul university',
    'webster vienna',
    'sigmund freud',
    'central european university',
    /\bceu\b/,
    'paracelsus',
    'karl landsteiner',
    'danube private',
    'lauder business school',
    'new design university',
  ],
  Cyprus: [
    'university of nicosia',
    /\bunic\b/,
    'european university cyprus',
    'frederick university',
    'neapolis university',
    'uclan cyprus',
    'american university of cyprus',
    'philips university',
  ],
};

const GLOBAL_PRIVATE_PATTERNS: PatternRule[] = [
  /\bprivate\b/,
  /\blimited\b/,
  /\bltd\b/,
  /\bplc\b/,
  /\bsrh\b/,
  'gisma',
  /\bbsbi\b/,
  'hult',
  'le cordon bleu',
  'global banking school',
  'iu international',
  'berlin school of business',
  'university of europe',
];

function matchesAnyPattern(haystack: string, patterns: PatternRule[]): boolean {
  for (const p of patterns) {
    if (typeof p === 'string') {
      if (haystack.includes(p.toLowerCase())) return true;
    } else if (p.test(haystack)) {
      return true;
    }
  }
  return false;
}

export function matchesPrivateUniversityPattern(uniName: string, country?: string): boolean {
  const cleanName = String(uniName || '').toLowerCase();
  if (!cleanName) return false;
  const normalizedCountry = country ? normalizeCountryName(country) || country : '';
  if (normalizedCountry && PRIVATE_PATTERNS_BY_COUNTRY[normalizedCountry]) {
    if (matchesAnyPattern(cleanName, PRIVATE_PATTERNS_BY_COUNTRY[normalizedCountry])) {
      return true;
    }
  }
  return matchesAnyPattern(cleanName, GLOBAL_PRIVATE_PATTERNS);
}

export function classifyUniversityType(
  uniName: string,
  country?: string,
  rawExcelData?: Record<string, any>,
  priorityRules: PriorityUniversityRule[] = []
): UniversitySector {
  // 1. Admin Override (highest precedence)
  const prio = getPriorityUniversityMatch(uniName, country, priorityRules);
  if (prio.rule?.sector_override === 'Public' || prio.rule?.sector_override === 'Private') {
    return prio.rule.sector_override;
  }

  // 2. Raw Excel Data Inspection
  if (rawExcelData && typeof rawExcelData === 'object') {
    for (const [k, v] of Object.entries(rawExcelData)) {
      if (/type|sector|funding|ownership|public|private|institution/i.test(k)) {
        const val = String(v || '').toLowerCase();
        if (val.includes('private')) return 'Private';
        if (val.includes('public') || val.includes('state')) return 'Public';
      }
    }
  }

  // 3. Curated Country & Global Patterns
  const cleanName = String(uniName || '').toLowerCase();
  if (!cleanName) return 'Public';

  const normalizedCountry = country ? normalizeCountryName(country) || country : '';
  if (normalizedCountry && PRIVATE_PATTERNS_BY_COUNTRY[normalizedCountry]) {
    if (matchesAnyPattern(cleanName, PRIVATE_PATTERNS_BY_COUNTRY[normalizedCountry])) {
      return 'Private';
    }
  }

  if (matchesAnyPattern(cleanName, GLOBAL_PRIVATE_PATTERNS)) {
    return 'Private';
  }

  return 'Public';
}
