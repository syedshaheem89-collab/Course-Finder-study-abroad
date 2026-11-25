-- ============================================================================
-- Supabase Row-Level Security Hardening & Audit Schema
-- Run this script once in the Supabase SQL Editor (Project -> SQL Editor)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Drop overly broad authenticated policies from initial setup
DROP POLICY IF EXISTS "Admins have full access to universities" ON universities;
DROP POLICY IF EXISTS "Admins have full access to courses" ON courses;
DROP POLICY IF EXISTS "Admins have full access to eligibility_rules" ON eligibility_rules;
DROP POLICY IF EXISTS "Admins can view inquiries" ON inquiries;

-- Re-ensure RLS is enabled on all tables
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Public read-only catalogue policies (no public writes allowed)
DROP POLICY IF EXISTS "Public universities can be viewed by all" ON universities;
DROP POLICY IF EXISTS "Public courses can be viewed by all" ON courses;
DROP POLICY IF EXISTS "Public eligibility rules can be viewed by all" ON eligibility_rules;
DROP POLICY IF EXISTS "Public inquiries insert allowed" ON inquiries;

CREATE POLICY "Public universities can be viewed by all"
  ON universities FOR SELECT USING (true);

CREATE POLICY "Public courses can be viewed by all"
  ON courses FOR SELECT USING (true);

CREATE POLICY "Public eligibility rules can be viewed by all"
  ON eligibility_rules FOR SELECT USING (true);

-- Public enquiry submission (INSERT only — zero public SELECT/UPDATE/DELETE)
CREATE POLICY "Public inquiries insert allowed"
  ON inquiries FOR INSERT WITH CHECK (true);

-- Strict Admin-only policies using server-controlled app_metadata (never user_metadata)
CREATE POLICY "Verified active admins manage universities"
  ON universities FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  );

CREATE POLICY "Verified active admins manage courses"
  ON courses FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  );

CREATE POLICY "Verified active admins manage eligibility_rules"
  ON eligibility_rules FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  );

CREATE POLICY "Verified active admins manage inquiries"
  ON inquiries FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  );

-- 2. Institutional Rules table (country & university cutoffs)
CREATE TABLE IF NOT EXISTS institutional_rules (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'COUNTRY',
  target_name TEXT NOT NULL UNIQUE,
  default_min_degree_percent NUMERIC(5, 2) NOT NULL DEFAULT 50,
  default_min_12th_percent NUMERIC(5, 2) NOT NULL DEFAULT 50,
  just_pass_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 40,
  max_gap_years INTEGER NOT NULL DEFAULT 5,
  english_policy TEXT NOT NULL DEFAULT 'MOI_ACCEPTED',
  default_min_ielts NUMERIC(3, 1) NOT NULL DEFAULT 5.5,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE institutional_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public institutional rules read" ON institutional_rules;
DROP POLICY IF EXISTS "Verified active admins manage institutional_rules" ON institutional_rules;

CREATE POLICY "Public institutional rules read"
  ON institutional_rules FOR SELECT USING (true);

CREATE POLICY "Verified active admins manage institutional_rules"
  ON institutional_rules FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    AND (auth.jwt() -> 'app_metadata' ->> 'status') = 'active'
  );

-- 3. Security Audit Logs table (Service Role write/read ONLY — zero public/anon access)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  actor_email TEXT,
  actor_id TEXT,
  ip TEXT,
  user_agent TEXT,
  path TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_created_at
  ON security_audit_logs(created_at DESC);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
-- Intentionally NO anon or authenticated policies on security_audit_logs (service_role only).
