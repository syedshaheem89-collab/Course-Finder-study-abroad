import { isGenericUniversityUrl } from '@/lib/student-guides';

export interface SearchRankableCourse {
  program_name?: string | null;
  category?: string | null;
  tuition_fees_eur?: number | null;
  course_url?: string | null;
  is_ai_discovered?: boolean;
  is_priority_university?: boolean;
  isPriority?: boolean;
  priority_rank?: number | null;
  priorityRank?: number | null;
  matchScore?: number;
  university?: {
    name?: string | null;
    country?: string | null;
  } | null;
  verified_meta?: {
    feeVerified?: boolean;
    originalTuitionAmount?: number | null;
    matchedProgramName?: string | null;
  } | null;
  raw_excel_data?: Record<string, any> | null;
}

const STOP_WORDS = new Set([
  'in',
  'of',
  'and',
  'the',
  'for',
  'with',
  'to',
  'on',
  'at',
  'by',
  'from',
  'msc',
  'bsc',
  'ma',
  'ba',
  'mba',
  'phd',
  'degree',
  'master',
  'bachelor',
  'diploma',
]);

export function tokenizeSearchQuery(query?: string | null): string[] {
  const raw = String(query || '').toLowerCase().trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    )
  );
}

export function hasVerifiedCourseFee(course: SearchRankableCourse): boolean {
  return Boolean(
    course.verified_meta?.feeVerified ||
      (course.verified_meta?.originalTuitionAmount !== null &&
        course.verified_meta?.originalTuitionAmount !== undefined) ||
      course.raw_excel_data?.['Verified Fee Quote']
  );
}

export function hasDirectOfficialCourseUrl(course: SearchRankableCourse): boolean {
  const url = String(course.course_url || '').trim();
  if (!url) return false;
  if (url.includes('google.com/search')) return false;
  return !isGenericUniversityUrl(url).isGeneric;
}

/**
 * Search-engine style relevance + data-quality ranking across all 35 countries:
 * - Exact / all-token title match + verified fee + direct official link ranks highest.
 * - Priority Partner boost only applies in full when the university actually matches the searched course
 *   (and does NOT use a generic/Google-search placeholder), so Priority #2 or a verified course
 *   naturally leads if Priority #1 lacks the programme or verified details.
 */
export function computeCourseSearchRankScore(
  course: SearchRankableCourse,
  query?: string | null
): number {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const tokens = tokenizeSearchQuery(cleanQuery);

  const titlePrimary = String(
    course.verified_meta?.matchedProgramName || course.program_name || ''
  )
    .toLowerCase()
    .trim();
  const titleOriginal = String(course.program_name || '').toLowerCase().trim();
  const category = String(course.category || '').toLowerCase();
  const uniName = String(course.university?.name || '').toLowerCase();

  // 1. Title & Query Relevance (0..45)
  let relevance = 20;
  if (cleanQuery) {
    if (titlePrimary.includes(cleanQuery) || titleOriginal.includes(cleanQuery)) {
      relevance = 45;
    } else if (tokens.length > 0) {
      const hay = `${titlePrimary} ${titleOriginal}`;
      const matchedCount = tokens.filter((t) => hay.includes(t)).length;
      if (matchedCount === tokens.length) {
        relevance = 38;
      } else if (matchedCount > 0) {
        relevance = 20 + Math.round((matchedCount / tokens.length) * 10);
      } else if (
        tokens.some((t) => category.includes(t) || uniName.includes(t)) ||
        category.includes(cleanQuery) ||
        uniName.includes(cleanQuery)
      ) {
        relevance = 6;
      } else {
        relevance = 0;
      }
    } else {
      relevance = 12;
    }
  }

  // 2. Data Quality & Direct Link Score (-12..+47)
  let quality = 0;
  const feeVerified = hasVerifiedCourseFee(course);
  const directUrl = hasDirectOfficialCourseUrl(course);

  if (feeVerified) quality += 28;
  if (directUrl) quality += 14;
  else quality -= 12;

  if (!course.is_ai_discovered) quality += 5;

  // 3. Smart Priority Partner Boost (0..36)
  const isPriority = Boolean(course.is_priority_university || course.isPriority);
  const rawRank = course.priorityRank ?? course.priority_rank ?? 9999;
  const effectiveRank = typeof rawRank === 'number' && rawRank > 0 ? rawRank : 9999;

  let priorityBoost = 0;
  if (isPriority && effectiveRank < 9999) {
    const topicAligned = !cleanQuery || relevance >= 20;
    const isGooglePlaceholder = String(course.course_url || '').includes('google.com/search');
    if (topicAligned && !isGooglePlaceholder) {
      priorityBoost = Math.max(16, 40 - effectiveRank * 4);
    } else if (topicAligned) {
      priorityBoost = 4;
    }
  }

  // 4. Student Qualification Match Bonus (0..15)
  const matchBonus =
    typeof course.matchScore === 'number' && Number.isFinite(course.matchScore)
      ? Math.round((Math.min(100, Math.max(0, course.matchScore)) / 100) * 15)
      : 0;

  return relevance + quality + priorityBoost + matchBonus;
}

export function sortCoursesBySearchEngineRank<T extends SearchRankableCourse>(
  courses: T[],
  query?: string | null
): T[] {
  const cleanQuery = String(query || '').trim();
  const scored = courses.map((course, idx) => ({
    course,
    idx,
    rankScore: computeCourseSearchRankScore(course, cleanQuery),
    feeVerified: hasVerifiedCourseFee(course) ? 1 : 0,
    isPriority: course.is_priority_university || course.isPriority ? 1 : 0,
    priorityRank:
      typeof (course.priorityRank ?? course.priority_rank) === 'number'
        ? (course.priorityRank ?? course.priority_rank)!
        : 9999,
  }));

  scored.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.feeVerified !== a.feeVerified) return b.feeVerified - a.feeVerified;
    if (b.isPriority !== a.isPriority) return b.isPriority - a.isPriority;
    if (a.isPriority && b.isPriority && a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return a.idx - b.idx;
  });

  return scored.map((s) => s.course);
}
