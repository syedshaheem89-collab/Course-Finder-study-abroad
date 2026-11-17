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

  if (level.includes('pg certificate') || title.includes('pg certificate') || title.includes('postgraduate certificate') || title.includes('post graduate certificate')) {
    return 'PG Certificate';
  }
  if (level.includes('certificate') || title.includes('certificate') || title.includes('award')) {
    return 'Certificate';
  }
  if (level.includes('pg diploma') || title.includes('pg diploma') || title.includes('postgraduate diploma') || title.includes('post graduate diploma')) {
    return 'PG Diploma';
  }
  if (level.includes('ug diploma') || title.includes('ug diploma') || title.includes('undergraduate diploma')) {
    return 'UG Diploma';
  }
  if (
    level.includes('master') ||
    level.includes('postgraduate') ||
    level.includes('mba') ||
    title.includes('master') ||
    title.includes('msc') ||
    title.includes('m.sc') ||
    title.includes('mba')
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
