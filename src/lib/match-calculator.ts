import { EligibilityRules } from '@/types/database';

export interface ScoreInput {
  twelfth_percent?: number;
  degree_percent?: number;
  ielts_score?: number;
  work_experience_months?: number;
}

/**
 * Calculates academic and language eligibility match score (0 - 100%)
 */
export function calculateMatchScore(rules: EligibilityRules | undefined, student: ScoreInput): number {
  if (!rules) return 85; // Fallback neutral baseline

  let totalWeight = 0;
  let earnedScore = 0;

  // 1. Degree Percentage (Weight: 40%)
  if (student.degree_percent !== undefined && student.degree_percent > 0) {
    totalWeight += 40;
    if (student.degree_percent >= rules.min_degree_percent) {
      earnedScore += 40;
    } else {
      const diff = rules.min_degree_percent - student.degree_percent;
      if (diff <= 5) earnedScore += 25;
      else if (diff <= 10) earnedScore += 10;
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

  // 3. English Language IELTS (Weight: 25%)
  if (student.ielts_score !== undefined && student.ielts_score > 0) {
    totalWeight += 25;
    if (student.ielts_score >= rules.min_ielts) {
      earnedScore += 25;
    } else {
      const diff = rules.min_ielts - student.ielts_score;
      if (diff <= 0.5) earnedScore += 15;
      else if (diff <= 1.0) earnedScore += 5;
    }
  }

  // 4. Work Experience (Weight: 15%)
  totalWeight += 15;
  const userExp = student.work_experience_months || 0;
  if (userExp >= rules.work_experience_months) {
    earnedScore += 15;
  } else {
    earnedScore += 5;
  }

  if (totalWeight === 0) return 92; // Default when no student criteria are entered yet
  return Math.min(100, Math.round((earnedScore / totalWeight) * 100));
}
