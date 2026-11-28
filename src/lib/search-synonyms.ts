import { Course } from '@/types/database';

const TYPO_CORRECTIONS: Record<string, string> = {
  buisness: 'business',
  bussiness: 'business',
  busines: 'business',
  mangment: 'management',
  mangement: 'management',
  managment: 'management',
  computr: 'computer',
  compter: 'computer',
  enginnering: 'engineering',
  engeneering: 'engineering',
  enginering: 'engineering',
  engneering: 'engineering',
  artifical: 'artificial',
  intelligance: 'intelligence',
  scince: 'science',
  sceince: 'science',
  scence: 'science',
  logisitcs: 'logistics',
  logistcs: 'logistics',
  pharmcy: 'pharmacy',
  markting: 'marketing',
  finace: 'finance',
  hospitlity: 'hospitality',
  analitics: 'analytics',
  cybre: 'cyber',
  heath: 'health',
  helth: 'health',
  healt: 'health',
  pubic: 'public',
  publc: 'public',
  pubilc: 'public',
  gloabl: 'global',
  nursng: 'nursing',
  medcine: 'medicine',
  biotec: 'biotechnology',
  psycology: 'psychology',
  architecure: 'architecture',
  acounting: 'accounting',
  econmics: 'economics',
};

const SYNONYM_GROUPS: Record<string, string[]> = {
  mba: ['mba', 'business administration', 'master of business'],
  bba: ['bba', 'business administration', 'bachelor of business'],
  ai: ['ai', 'artificial intelligence', 'machine learning'],
  ml: ['machine learning', 'artificial intelligence', 'data science'],
  cs: ['computer science', 'informatics', 'computing', 'software engineering'],
  it: ['information technology', 'computing', 'software'],
  ds: ['data science', 'data analytics', 'big data'],
  bca: ['computer applications', 'computer science', 'informatics', 'information technology'],
  mca: ['computer applications', 'computer science', 'informatics', 'software'],
  cyber: ['cyber', 'cybersecurity', 'information security', 'network security'],
  mech: ['mechanical'],
  civil: ['civil'],
  eee: ['electrical', 'electronic'],
  ece: ['electronics', 'communication'],
  finance: ['finance', 'accounting', 'banking', 'fintech'],
  accounting: ['accounting', 'accountancy'],
  nursing: ['nursing', 'nurse', 'bsn', 'bscn', 'midwifery'],
  mbbs: ['mbbs', 'medicine', 'medical doctor', 'md'],
  physio: ['physiotherapy', 'physical therapy'],
  physiotherapy: ['physiotherapy', 'physical therapy'],
  pharma: ['pharmacy', 'pharmaceutical', 'pharmacology'],
  pharmacy: ['pharmacy', 'pharmaceutical', 'pharmacology'],
  psych: ['psychology', 'psychological'],
  psychology: ['psychology', 'psychological'],
  arch: ['architecture', 'architectural'],
  architecture: ['architecture', 'architectural'],
  llb: ['law', 'legal'],
  llm: ['law', 'legal'],
  uk: ['united kingdom', 'uk'],
  usa: ['usa', 'united states'],
  uae: ['united arab emirates', 'uae'],
  'public health': [
    'public health',
    'global public health',
    'global health',
    'mph',
    'epidemiology',
    'health promotion',
  ],
  'global health': [
    'global health',
    'global public health',
    'public health',
    'mph',
    'international health',
  ],
  mph: ['mph', 'public health', 'global public health', 'global health'],
  'health management': [
    'health management',
    'healthcare management',
    'health administration',
    'public health',
  ],
  'healthcare management': [
    'healthcare management',
    'health management',
    'health administration',
    'public health',
  ],
  'data analytics': ['data analytics', 'data science', 'business analytics', 'analytics'],
  'business analytics': ['business analytics', 'data analytics', 'data science'],
  'supply chain': ['supply chain', 'logistics', 'operations management'],
  'computer science': [
    'computer science',
    'informatics',
    'business informatics',
    'computing',
    'software engineering',
    'artificial intelligence',
    'computer engineering',
  ],
  informatics: ['informatics', 'computer science', 'business informatics', 'computing'],
  'business administration': [
    'business administration',
    'business management',
    'management',
    'international business',
    'business economics',
  ],
  'data science': [
    'data science',
    'data analytics',
    'business analytics',
    'statistics',
    'artificial intelligence',
  ],
  'mechanical engineering': [
    'mechanical engineering',
    'mechatronics',
    'industrial engineering',
  ],
  'electrical engineering': [
    'electrical engineering',
    'electronics',
    'electronic engineering',
    'mechatronics',
  ],
  medicine: ['medicine', 'human medicine', 'medical doctor', 'mbbs', 'md'],
};

const STUDY_VOCABULARY_BASE: string[] = [
  'business',
  'management',
  'administration',
  'computer',
  'computing',
  'science',
  'sciences',
  'engineering',
  'mechanical',
  'electrical',
  'electronic',
  'electronics',
  'civil',
  'chemical',
  'aerospace',
  'automotive',
  'industrial',
  'manufacturing',
  'mechatronics',
  'robotics',
  'renewable',
  'energy',
  'environmental',
  'architecture',
  'architectural',
  'construction',
  'artificial',
  'intelligence',
  'machine',
  'learning',
  'data',
  'analytics',
  'statistics',
  'quantitative',
  'informatics',
  'software',
  'technology',
  'information',
  'cyber',
  'cybersecurity',
  'security',
  'network',
  'cloud',
  'digital',
  'development',
  'finance',
  'financial',
  'accounting',
  'accountancy',
  'banking',
  'fintech',
  'marketing',
  'economics',
  'commerce',
  'entrepreneurship',
  'strategy',
  'strategic',
  'international',
  'global',
  'trade',
  'logistics',
  'supply',
  'chain',
  'operations',
  'hospitality',
  'tourism',
  'aviation',
  'project',
  'human',
  'resource',
  'resources',
  'health',
  'healthcare',
  'public',
  'epidemiology',
  'promotion',
  'nursing',
  'midwifery',
  'medicine',
  'medical',
  'pharmacy',
  'pharmaceutical',
  'pharmacology',
  'biotechnology',
  'biology',
  'biological',
  'biomedical',
  'clinical',
  'psychology',
  'psychological',
  'nutrition',
  'physiotherapy',
  'therapy',
  'radiography',
  'diagnostic',
  'dentistry',
  'veterinary',
  'master',
  'bachelor',
  'diploma',
  'certificate',
  'honours',
  'legal',
  'criminology',
  'sociology',
  'education',
  'teaching',
  'media',
  'journalism',
  'communication',
  'design',
  'fashion',
  'united',
  'kingdom',
  'germany',
  'ireland',
  'canada',
  'australia',
  'poland',
  'malta',
  'latvia',
  'georgia',
  'albania',
  'bulgaria',
  'france',
  'spain',
  'italy',
  'netherlands',
  'sweden',
  'finland',
  'denmark',
  'norway',
  'switzerland',
  'austria',
  'hungary',
  'singapore',
  'japan',
  'korea',
  'emirates',
  'dubai',
];

const STUDY_VOCAB_SET: Set<string> = new Set([
  ...STUDY_VOCABULARY_BASE,
  ...Object.values(TYPO_CORRECTIONS),
  ...Object.values(SYNONYM_GROUPS)
    .flat()
    .flatMap((phrase) => phrase.split(/\s+/))
    .filter((w) => w.length >= 4),
]);

const STUDY_VOCAB_LIST: string[] = Array.from(STUDY_VOCAB_SET);

/**
 * Optimal string alignment (restricted Damerau-Levenshtein) distance:
 * counts single-char insert, delete, substitute, and adjacent transposition as 1 edit.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

function sameStartOrTransposedStart(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a[0] === b[0]) return true;
  return a.length >= 2 && b.length >= 2 && a[0] === b[1] && a[1] === b[0];
}

/**
 * Universally fixes any spelling mistake (missing/extra/swapped letters)
 * against the academic vocabulary while preserving short acronyms & exact valid words.
 */
export function fuzzyCorrectWord(rawWord: string): string {
  const w = String(rawWord || '').trim().toLowerCase();
  if (!w) return '';
  if (TYPO_CORRECTIONS[w]) return TYPO_CORRECTIONS[w];
  if (w.length < 4 || STUDY_VOCAB_SET.has(w) || Boolean(SYNONYM_GROUPS[w])) {
    return w;
  }

  const maxDist = w.length >= 7 ? 2 : 1;
  let bestWord = w;
  let bestDist = maxDist + 1;
  let bestLenDiff = 999;

  for (const cand of STUDY_VOCAB_LIST) {
    const lenDiff = Math.abs(cand.length - w.length);
    if (lenDiff > maxDist) continue;
    if (!sameStartOrTransposedStart(w, cand)) continue;

    const dist = damerauLevenshtein(w, cand);
    if (dist <= maxDist) {
      if (
        dist < bestDist ||
        (dist === bestDist && cand[0] === w[0] && bestWord[0] !== w[0]) ||
        (dist === bestDist && cand[0] === bestWord[0] && lenDiff < bestLenDiff)
      ) {
        bestDist = dist;
        bestWord = cand;
        bestLenDiff = lenDiff;
      }
    }
  }

  return bestWord;
}

export function correctSearchTypos(rawQuery: string): string {
  return String(rawQuery || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => fuzzyCorrectWord(w))
    .join(' ');
}

export function getPhraseSynonyms(rawQuery: string): string[] {
  const corrected = correctSearchTypos(rawQuery);
  return corrected && SYNONYM_GROUPS[corrected] ? SYNONYM_GROUPS[corrected] : [];
}

/**
 * Normalizes typos (explicit + fuzzy) and expands student abbreviations/synonyms into
 * search terms for both server-side SQL and client-side filtering.
 */
export function expandSearchTerms(rawQuery: string): string[] {
  const correctedQuery = correctSearchTypos(rawQuery);
  if (!correctedQuery) return [];

  const words = correctedQuery.split(/\s+/).filter(Boolean);
  const terms = new Set<string>([correctedQuery]);

  if (SYNONYM_GROUPS[correctedQuery]) {
    SYNONYM_GROUPS[correctedQuery].forEach((t) => terms.add(t));
  }

  for (const w of words) {
    if (SYNONYM_GROUPS[w]) {
      SYNONYM_GROUPS[w].forEach((t) => terms.add(t));
    }
  }

  return Array.from(terms).filter(Boolean);
}

function termMatchesHaystack(haystack: string, term: string, haystackWords?: string[]): boolean {
  const clean = term.trim().toLowerCase();
  if (!clean) return false;
  if (clean.length <= 3) {
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
  }
  if (haystack.includes(clean)) return true;

  // Universal fuzzy token match for single-word typos (including university/rare course names)
  if (!clean.includes(' ') && clean.length >= 4) {
    const words =
      haystackWords ||
      haystack.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const maxDist = clean.length >= 7 ? 2 : 1;
    for (const hw of words) {
      if (Math.abs(hw.length - clean.length) > maxDist) continue;
      if (!sameStartOrTransposedStart(clean, hw)) continue;
      if (damerauLevenshtein(clean, hw) <= maxDist) {
        return true;
      }
    }
  }

  return false;
}

export function matchesSmartSearch(course: Course, rawQuery: string): boolean {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return true;

  const haystack = `${course.program_name || ''} ${course.category || ''} ${course.degree_level || ''} ${course.university?.name || ''} ${course.university?.country || ''}`.toLowerCase();
  const haystackWords = haystack.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

  const correctedQuery = correctSearchTypos(cleaned);
  const words = correctedQuery.split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return expandSearchTerms(correctedQuery).some((term) =>
      termMatchesHaystack(haystack, term, haystackWords)
    );
  }

  if (termMatchesHaystack(haystack, correctedQuery, haystackWords)) return true;
  if (
    SYNONYM_GROUPS[correctedQuery]?.some((term) =>
      termMatchesHaystack(haystack, term, haystackWords)
    )
  ) {
    return true;
  }

  const meaningful = words.filter((w) => w.length >= 2 || Boolean(SYNONYM_GROUPS[w]));
  return (
    meaningful.length > 0 &&
    meaningful.every((w) => {
      const alts = SYNONYM_GROUPS[w] ? [w, ...SYNONYM_GROUPS[w]] : [w];
      return alts.some((t) => termMatchesHaystack(haystack, t, haystackWords));
    })
  );
}
