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
  created_at?: string;
}

export interface Course {
  id: string;
  university_id: string;
  program_name: string;
  degree_level: 'Bachelor' | 'Master' | 'PhD' | 'Diploma' | string;
  category?: 'Computer Science & AI' | 'Engineering' | 'Business & Management' | 'Data Science' | 'Biotechnology' | string;
  duration_months: number;
  tuition_fees_eur: number;
  intake_months: string[];
  course_url: string;
  stay_back_visa_years: number;
  average_graduate_salary: number; // in EUR per year
  university?: University;
  eligibility_rules?: EligibilityRules;
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
  english_test_type?: 'IELTS' | 'PTE' | 'TOEFL';
  english_score?: number;
  work_experience_months?: number;
  career_goal?: 'High ROI Job' | 'Permanent Settlement (PR)' | 'Research / Academia';
  course_category?: string;
  intake?: string;
}

export interface Inquiry {
  id: string;
  student_name: string;
  email: string;
  phone: string;
  background_profile: StudentProfile;
  ai_suggested_courses: {
    recommended_courses: {
      course_id: string;
      program_name: string;
      university_name: string;
      country: string;
      fit_score: number;
      roi_ratio: number;
      settlement_probability_percent: number;
      rationale: string;
    }[];
    generated_at: string;
  };
  created_at?: string;
}
