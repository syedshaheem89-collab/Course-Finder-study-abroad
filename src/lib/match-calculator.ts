import { EligibilityRules } from '@/types/database';
import { CourseTypeOption } from './course-utils';

export interface ScoreInput {
  twelfth_percent?: number;
  degree_percent?: number;
  ielts_score?: number;
  has_moi?: boolean;
  english_policy?: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT';
  work_experience_months?: number;
}

export function isPostgradType(courseType?: CourseTypeOption | string): boolean {
  return (
    courseType === 'Masters' ||
    courseType === 'PG Diploma' ||
    courseType === 'PG Certificate'
  );
}

/**
 * Strict academic eligibility check:
 * - Masters / PG Diploma / PG Certificate: checks Bachelor/Degree % ONLY (ignores +2/12th)
 * - Undergraduate / UG Diploma / Certificate: checks +2/12th % ONLY (ignores Bachelor)
 */
export function isAcademicallyEligible(
  rules: EligibilityRules | undefined,
  student: ScoreInput,
  courseType?: CourseTypeOption | string
): boolean {
  if (!rules) return true;
  if (isPostgradType(courseType)) {
    if (student.degree_percent === undefined) return true;
    return student.degree_percent >= rules.min_degree_percent;
  } else {
    if (student.twelfth_percent === undefined) return true;
    return student.twelfth_percent >= rules.min_12th_percent;
  }
}

/**
 * Calculates academic and language eligibility match score (0 - 100%):
 * - For Undergraduate / UG Diploma / Certificate: +2 (12th) score matters (65%) + Language (35%)
 * - For Masters / PG Diploma / PG Certificate: Degree score matters (65%) + Language (35%)
 */
export function calculateMatchScore(
  rules: EligibilityRules | undefined,
  student: ScoreInput,
  courseType?: CourseTypeOption | string
): number {
  if (!rules) return 85;

  let totalWeight = 0;
  let earnedScore = 0;
  const postgrad = isPostgradType(courseType);

  if (postgrad) {
    // Masters / PG Diploma / PG Certificate -> Degree % matters, NOT 12th %
    if (student.degree_percent !== undefined && student.degree_percent > 0) {
      totalWeight += 65;
      if (student.degree_percent >= rules.min_degree_percent) {
        earnedScore += 65;
      } else {
        const diff = rules.min_degree_percent - student.degree_percent;
        if (diff <= 5) earnedScore += 35;
        else if (diff <= 10) earnedScore += 15;
      }
    }
  } else {
    // Undergraduate / UG Diploma / Certificate -> 12th % matters, NOT Degree %
    if (student.twelfth_percent !== undefined && student.twelfth_percent > 0) {
      totalWeight += 65;
      if (student.twelfth_percent >= rules.min_12th_percent) {
        earnedScore += 65;
      } else {
        const diff = rules.min_12th_percent - student.twelfth_percent;
        if (diff <= 5) earnedScore += 35;
        else if (diff <= 10) earnedScore += 15;
      }
    }
  }

  // English Language Evaluation (Weight: 35%) — only evaluate when user/profile supplies IELTS/PTE or MOI
  const hasEnglishInput =
    (student.ielts_score !== undefined && student.ielts_score > 0) || Boolean(student.has_moi);

  if (hasEnglishInput) {
    totalWeight += 35;
    const engType = rules.english_requirement_type || 'MOI_ACCEPTED';

    if (engType === 'WAIVED' || engType === 'NO_REQUIREMENT') {
      earnedScore += 35;
    } else if (engType === 'MOI_ACCEPTED' && student.has_moi) {
      earnedScore += 35;
    } else if (student.ielts_score !== undefined && student.ielts_score > 0) {
      if (student.ielts_score >= rules.min_ielts) {
        earnedScore += 35;
      } else {
        const diff = rules.min_ielts - student.ielts_score;
        if (diff <= 0.5) earnedScore += 20;
        else if (diff <= 1.0) earnedScore += 10;
      }
    } else if (student.has_moi) {
      earnedScore += 30;
    }
  }

  if (totalWeight === 0) return 90;
  return Math.min(100, Math.round((earnedScore / totalWeight) * 100));
}
