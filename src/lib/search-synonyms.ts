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
  artifical: 'artificial',
  intelligance: 'intelligence',
  scince: 'science',
  sceince: 'science',
  logisitcs: 'logistics',
  logistcs: 'logistics',
  pharmcy: 'pharmacy',
  markting: 'marketing',
  finace: 'finance',
  hospitlity: 'hospitality',
  analitics: 'analytics',
  cybre: 'cyber',
};

const SYNONYM_GROUPS: Record<string, string[]> = {
  mba: ['mba', 'business administration', 'master of business'],
  bba: ['bba', 'business administration', 'bachelor of business'],
  ai: ['ai', 'artificial intelligence', 'machine learning'],
  ml: ['machine learning', 'artificial intelligence', 'data science'],
  cs: ['computer science', 'computing', 'software engineering'],
  it: ['information technology', 'computing', 'software'],
  ds: ['data science', 'data analytics', 'big data'],
  bca: ['computer applications', 'computer science', 'information technology'],
  mca: ['computer applications', 'computer science', 'software'],
  cyber: ['cyber', 'cybersecurity', 'information security', 'network security'],
  mech: ['mechanical'],
  civil: ['civil'],
  eee: ['electrical', 'electronic'],
  ece: ['electronics', 'communication'],
  finance: ['finance', 'accounting', 'banking', 'fintech'],
  nursing: ['nursing', 'health care', 'healthcare', 'public health'],
  mbbs: ['medicine', 'medical', 'health'],
  llb: ['law', 'legal'],
  llm: ['law', 'legal'],
};

/**
 * Normalizes typos and expands student abbreviations/synonyms into
 * search terms for both server-side SQL and client-side filtering.
 */
export function expandSearchTerms(rawQuery: string): string[] {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/).map((w) => TYPO_CORRECTIONS[w] || w);
  const correctedQuery = words.join(' ');

  const terms = new Set<string>([correctedQuery]);

  // Expand full query if it's a known abbreviation/synonym
  if (SYNONYM_GROUPS[correctedQuery]) {
    SYNONYM_GROUPS[correctedQuery].forEach((t) => terms.add(t));
  }

  // Also expand individual words if multi-word query contains an abbreviation
  for (const w of words) {
    if (SYNONYM_GROUPS[w]) {
      SYNONYM_GROUPS[w].forEach((t) => terms.add(t));
    }
  }

  return Array.from(terms).filter(Boolean);
}

export function matchesSmartSearch(course: Course, rawQuery: string): boolean {
  const terms = expandSearchTerms(rawQuery);
  if (terms.length === 0) return true;

  const haystack = `${course.program_name || ''} ${course.category || ''} ${course.university?.name || ''} ${course.university?.country || ''}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}
