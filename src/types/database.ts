export interface University {
  id: string;
  name: string;
  country: string;
  global_ranking: number;
  campus_locations: string[];
  created_at?: string;
}

export interface EligibilityRules {
  id: string;
  course_id: string;
  min_12th_percent: number;
  min_degree_percent: number;
  min_ielts: number;
  min_toefl: number;
  interview_required: boolean;
  work_experience_months: number;
  english_requirement_type?: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT';
  created_at?: string;
}

// Institutional / National Level Rule Override
export interface InstitutionalRule {
  id: string;
  scope: 'COUNTRY' | 'UNIVERSITY';
  target_name: string; // e.g. "Malta" or "Technical University of Munich"
  default_min_degree_percent: number;
  default_min_12th_percent: number;
  just_pass_accepted?: boolean;
  min_age?: number;
  max_age?: number;
  max_gap_years?: number;
  english_policy: 'IELTS_TOEFL' | 'MOI_ACCEPTED' | 'WAIVED' | 'NO_REQUIREMENT';
  default_min_ielts: number;
  notes?: string;
  created_at?: string;
}

export interface Course {
  id: string;
  university_id: string;
  program_name: string;
  degree_level: 'Bachelor' | 'Master' | 'PhD' | 'Diploma' | 'Postgraduate' | 'PG Diploma' | 'UG Diploma' | string;
  category?: 'Computer Science & AI' | 'Engineering' | 'Business & Management' | 'Data Science' | 'Biotechnology' | string;
  duration_months: number;
  tuition_fees_eur: number;
  intake_months: string[];
  course_url: string;
  stay_back_visa_years: number;
  average_graduate_salary: number;
  university?: University;
  eligibility_rules?: EligibilityRules;
  raw_excel_data?: Record<string, any>;
  created_at?: string;
}

export interface StudentProfile {
  name?: string;
  email?: string;
  phone?: string;
  budget_eur?: number;
  target_countries?: string[];
  twelfth_percent?: number;
  degree_percent?: number;
  english_test_type?: 'IELTS' | 'PTE' | 'TOEFL' | 'MOI' | 'NONE';
  has_moi?: boolean;
  english_score?: number;
  work_experience_months?: number;
  career_goal?: 'High ROI Job' | 'Permanent Settlement (PR)' | 'Research / Academia';
  course_category?: string;
  intake?: string;
}
