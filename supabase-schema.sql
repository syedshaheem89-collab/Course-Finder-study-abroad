-- ============================================================================
-- Supabase Schema for Study Abroad Course Finder & AI Recommender
-- Run this script in the Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. UNIVERSITIES TABLE
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  global_ranking INTEGER NOT NULL DEFAULT 999,
  campus_locations TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COURSES TABLE
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  degree_level TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  tuition_fees_eur NUMERIC(10, 2) NOT NULL,
  intake_months TEXT[] NOT NULL DEFAULT '{}',
  course_url TEXT NOT NULL,
  stay_back_visa_years NUMERIC(3, 1) NOT NULL DEFAULT 1.5,
  average_graduate_salary NUMERIC(10, 2) NOT NULL DEFAULT 45000,
  category TEXT DEFAULT 'Computer Science & AI',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ELIGIBILITY RULES TABLE
CREATE TABLE IF NOT EXISTS eligibility_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  min_12th_percent NUMERIC(5, 2) NOT NULL DEFAULT 60.0,
  min_degree_percent NUMERIC(5, 2) NOT NULL DEFAULT 60.0,
  min_ielts NUMERIC(3, 1) NOT NULL DEFAULT 6.5,
  min_toefl INTEGER NOT NULL DEFAULT 85,
  interview_required BOOLEAN NOT NULL DEFAULT FALSE,
  work_experience_months INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INQUIRIES & AI PROFILE MATCHES TABLE
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  background_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_suggested_courses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast search queries
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON universities(global_ranking);
CREATE INDEX IF NOT EXISTS idx_courses_uni ON courses(university_id);
CREATE INDEX IF NOT EXISTS idx_courses_tuition ON courses(tuition_fees_eur);
CREATE INDEX IF NOT EXISTS idx_courses_degree ON courses(degree_level);
CREATE INDEX IF NOT EXISTS idx_eligibility_course ON eligibility_rules(course_id);

-- Enable Row Level Security (RLS)
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Public read policies for search
CREATE POLICY "Public universities can be viewed by all" ON universities FOR SELECT USING (true);
CREATE POLICY "Public courses can be viewed by all" ON courses FOR SELECT USING (true);
CREATE POLICY "Public eligibility rules can be viewed by all" ON eligibility_rules FOR SELECT USING (true);
CREATE POLICY "Public inquiries insert allowed" ON inquiries FOR INSERT WITH CHECK (true);

-- Admin read/write policies (Service Role or authenticated admins)
CREATE POLICY "Admins have full access to universities" ON universities FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins have full access to courses" ON courses FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins have full access to eligibility_rules" ON eligibility_rules FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can view inquiries" ON inquiries FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- SEED DATA (Top European & Global Universities for instant demo)
-- ============================================================================

INSERT INTO universities (id, name, country, global_ranking, campus_locations) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Technical University of Munich (TUM)', 'Germany', 37, ARRAY['Munich', 'Garching', 'Heilbronn']),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Trinity College Dublin', 'Ireland', 81, ARRAY['Dublin']),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Delft University of Technology (TU Delft)', 'Netherlands', 47, ARRAY['Delft']),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'KTH Royal Institute of Technology', 'Sweden', 73, ARRAY['Stockholm']),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'University of Melbourne', 'Australia', 14, ARRAY['Parkville', 'Southbank'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO courses (id, university_id, program_name, degree_level, duration_months, tuition_fees_eur, intake_months, course_url, stay_back_visa_years, average_graduate_salary, category) VALUES
  ('c1d2e3f4-0001-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'M.Sc. Data Engineering and Analytics', 'Master', 24, 0, ARRAY['October'], 'https://www.tum.de', 1.5, 68000, 'Data Science'),
  ('c1d2e3f4-0002-0000-0000-000000000002', 'a1b2c3d4-0001-0000-0000-000000000001', 'M.Sc. Informatics / Computer Science', 'Master', 24, 0, ARRAY['October', 'April'], 'https://www.tum.de', 1.5, 72000, 'Computer Science & AI'),
  ('c1d2e3f4-0003-0000-0000-000000000003', 'a1b2c3d4-0002-0000-0000-000000000002', 'M.Sc. Computer Science (Future Networked Systems)', 'Master', 12, 26000, ARRAY['September'], 'https://www.tcd.ie', 2.0, 62000, 'Computer Science & AI'),
  ('c1d2e3f4-0004-0000-0000-000000000004', 'a1b2c3d4-0002-0000-0000-000000000002', 'M.Sc. International Management', 'Master', 12, 22500, ARRAY['September'], 'https://www.tcd.ie', 2.0, 56000, 'Business & Management'),
  ('c1d2e3f4-0005-0000-0000-000000000005', 'a1b2c3d4-0003-0000-0000-000000000003', 'M.Sc. Artificial Intelligence Technology', 'Master', 24, 21500, ARRAY['September'], 'https://www.tudelft.nl', 1.0, 64000, 'Computer Science & AI'),
  ('c1d2e3f4-0006-0000-0000-000000000006', 'a1b2c3d4-0004-0000-0000-000000000004', 'M.Sc. Software Engineering of Distributed Systems', 'Master', 24, 15000, ARRAY['August'], 'https://www.kth.se', 1.0, 59000, 'Engineering'),
  ('c1d2e3f4-0007-0000-0000-000000000007', 'a1b2c3d4-0005-0000-0000-000000000005', 'Master of Information Technology', 'Master', 24, 32000, ARRAY['February', 'July'], 'https://www.unimelb.edu.au', 3.0, 75000, 'Computer Science & AI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO eligibility_rules (id, course_id, min_12th_percent, min_degree_percent, min_ielts, min_toefl, interview_required, work_experience_months) VALUES
  ('e1f2g3h4-0001-0000-0000-000000000001', 'c1d2e3f4-0001-0000-0000-000000000001', 75.0, 75.0, 6.5, 88, false, 0),
  ('e1f2g3h4-0002-0000-0000-000000000002', 'c1d2e3f4-0002-0000-0000-000000000002', 75.0, 78.0, 6.5, 90, false, 0),
  ('e1f2g3h4-0003-0000-0000-000000000003', 'c1d2e3f4-0003-0000-0000-000000000003', 70.0, 68.0, 6.5, 90, true, 0),
  ('e1f2g3h4-0004-0000-0000-000000000004', 'c1d2e3f4-0004-0000-0000-000000000004', 65.0, 62.0, 6.5, 90, true, 12),
  ('e1f2g3h4-0005-0000-0000-000000000005', 'c1d2e3f4-0005-0000-0000-000000000005', 75.0, 75.0, 7.0, 100, false, 0),
  ('e1f2g3h4-0006-0000-0000-000000000006', 'c1d2e3f4-0006-0000-0000-000000000006', 70.0, 70.0, 6.5, 90, false, 0),
  ('e1f2g3h4-0007-0000-0000-000000000007', 'c1d2e3f4-0007-0000-0000-000000000007', 70.0, 70.0, 6.5, 79, false, 0)
ON CONFLICT (id) DO NOTHING;
