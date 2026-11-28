import { Course } from '@/types/database';

export const COURSE_TYPES = [
  'Undergraduate',
  'Masters',
  'UG Diploma',
  'PG Diploma',
  'Certificate',
  'PG Certificate',
] as const;

export type CourseTypeOption = (typeof COURSE_TYPES)[number];

/**
 * Normalizes raw degree_level / program_name from Supabase or Excel into
 * the 6 standard Course Type categories.
 */
export function normalizeCourseType(course: Course): CourseTypeOption {
  const level = (course.degree_level || '').toLowerCase();
  const title = (course.program_name || '').toLowerCase();
  const hay = `${level} ${title}`;
  const isTitleDegree =
    /\b(?:bachelor|bachelors|bsc|b\.sc|ba|beng|b\.eng|bba|llb|mbbs|master|masters|msc|m\.sc|mba|meng|m\.eng|llm|mph|phd|doctorate)\b/.test(
      title
    );

  if (/\b(?:pg|postgraduate|post[\s-]?graduate)\s+certificate\b|\bpgcert\b/.test(hay)) {
    return 'PG Certificate';
  }
  if (
    /\b(?:pg|postgraduate|post[\s-]?graduate)\s+diploma\b|\bpgdip\b|\bmqf\s*(?:level\s*)?7\s+diploma\b/.test(
      hay
    )
  ) {
    return 'PG Diploma';
  }
  if (
    /\b(?:ug|undergraduate|higher\s+national|advanced|foundation|extended)\s+diploma\b|\bhnd\b|\bhnc\b|\bmqf\s*(?:level\s*)?[45]\b/.test(
      hay
    ) ||
    (!isTitleDegree && /\bdiploma\b/.test(hay))
  ) {
    return 'UG Diploma';
  }
  if (
    /\b(?:certificate|certhe|mqf\s+award)\b/.test(hay) &&
    !/\bdual\s+award\b/.test(hay) &&
    !isTitleDegree
  ) {
    return 'Certificate';
  }
  if (
    /\b(?:master|masters|postgraduate|msc|m\.sc|mba|meng|m\.eng|llm|mph)\b/.test(hay) ||
    /\bma\b/.test(level) ||
    /^ma\b/.test(title)
  ) {
    return 'Masters';
  }
  return 'Undergraduate';
}

/**
 * Converts a PTE Academic score (10-90) to approximate IELTS equivalent.
 */
export function pteToIelts(pte: number): number {
  if (!pte || pte <= 0) return 0;
  if (pte >= 79) return 8.0;
  if (pte >= 73) return 7.5;
  if (pte >= 65) return 7.0;
  if (pte >= 58) return 6.5;
  if (pte >= 50) return 6.0;
  if (pte >= 43) return 5.5;
  return 5.0;
}
