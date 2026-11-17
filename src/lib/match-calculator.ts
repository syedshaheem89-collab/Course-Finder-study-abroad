import { EligibilityRules } from '@/types/database';

export interface ScoreInput {
  twelfth_percent?: number;
  degree_percent?: number;
  ielts_score?: number;
  has_moi?: boolean; // Medium of Instruction certificate from college
  english_policy?: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT';
  work_experience_months?: number;
}

/**
 * Calculates academic and language eligibility match score (0 - 100%)
 * Correctly accounts for Malta/country rules, MOI acceptance, and IELTS waivers.
 */
export function calculateMatchScore(rules: EligibilityRules | undefined, student: ScoreInput): number {
  if (!rules) return 85;

  let totalWeight = 0;
  let earnedScore = 0;

  // 1. Degree Percentage (Weight: 45%)
  if (student.degree_percent !== undefined && student.degree_percent > 0) {
    totalWeight += 45;
    if (student.degree_percent >= rules.min_degree_percent) {
      earnedScore += 45;
    } else {
      const diff = rules.min_degree_percent - student.degree_percent;
      if (diff <= 5) earnedScore += 30;
      else if (diff <= 10) earnedScore += 15;
    }
  }

  // 2. 12th Percentage (Weight: 20%)
  if (student.twelfth_percent !== undefined && student.twelfth_percent > 0) {
    totalWeight += 20;
    if (student.twelfth_percent >= rules.min_12th_percent) {
      earnedScore += 20;
    } else {
      const diff = rules.min_12th_percent - student.twelfth_percent;
      if (diff <= 5) earnedScore += 12;
      else if (diff <= 10) earnedScore += 5;
    }
  }

  // 3. English Language Evaluation (Weight: 35%)
  // Checks if English is Waived, MOI Accepted, or No Requirement!
  totalWeight += 35;
  const engType = rules.english_requirement_type || 'MOI_ACCEPTED';

  if (engType === 'WAIVED' || engType === 'NO_REQUIREMENT') {
    // English is completely waived or not required -> Automatic 100% on language!
    earnedScore += 35;
  } else if (engType === 'MOI_ACCEPTED' && student.has_moi) {
    // Student has Medium of Instruction letter -> Full marks!
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

  if (totalWeight === 0) return 90;
  return Math.min(100, Math.round((earnedScore / totalWeight) * 100));
}
