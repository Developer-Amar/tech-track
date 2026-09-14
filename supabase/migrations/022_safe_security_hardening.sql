-- ============================================================================
-- Migration 022: Safe Security Hardening (Non-Recursive RLS, Role Elevation Guard, Database Invariants)
-- ============================================================================
-- Remediates:
--   TT-01: User Role Elevation via self-update on users table
--   TT-03: Arbitrary execution of close_registration()
--   TT-04: Riddle, checkpoint, and challenge content leakage before event
--   TT-08: Supabase Realtime publication overexposure of sensitive tables
--   TT-09: Missing Database-Level Invariant: One Team Per User
--   TT-13: Test Case & Submission Data Leakage
--   TT-16: Missing Unique Constraint on users.pass_code
--
-- GUARANTEE:
--   Zero subqueries on public.users within RLS policies to eliminate
--   any possibility of PostgreSQL infinite recursion.
-- ============================================================================

BEGIN;

-- ── 1. User Role & Pass Code Elevation Guard (TT-01) ──────────────────────
CREATE OR REPLACE FUNCTION public.protect_user_critical_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow postgres superuser, background workers, and service_role to update any column
  IF current_user <> 'postgres' AND (current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Changing user role is not permitted';
    END IF;
    IF NEW.pass_code IS DISTINCT FROM OLD.pass_code THEN
      RAISE EXCEPTION 'Changing pass_code is not permitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_user_critical_columns ON public.users;
CREATE TRIGGER trg_protect_user_critical_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_critical_columns();

-- ── 2. Pass Code Uniqueness Invariant (TT-16) ──────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pass_code_unique 
  ON public.users (pass_code) 
  WHERE pass_code IS NOT NULL;

-- ── 3. Restrict close_registration() Execution (TT-03) ─────────────────────
REVOKE EXECUTE ON FUNCTION public.close_registration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_registration() TO service_role;

-- ── 4. Invariant: One Accepted Team Per User (TT-09) ───────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_members_one_accepted 
  ON public.unit_members (user_id) 
  WHERE status = 'accepted';

-- ── 5. Safe Non-Recursive Users Table RLS Policies ─────────────────────────
-- Revoke anon access while allowing authenticated Chitkara users to read profiles
-- WITHOUT ANY SUBQUERIES ON public.users TO GUARANTEE NO RECURSION
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_all" ON public.users;
DROP POLICY IF EXISTS "users_read_authenticated" ON public.users;
CREATE POLICY "users_read_authenticated" 
  ON public.users FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" 
  ON public.users FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" 
  ON public.users FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

-- ── 6. Revoke Client Access to Riddles, Test Cases & Submissions (TT-04, TT-13)
-- All operations on these tables are executed server-side via createAdminClient() (service_role)
DROP POLICY IF EXISTS "checkpoints_read_all" ON public.checkpoints;
DROP POLICY IF EXISTS "riddles_read_all" ON public.riddles;
DROP POLICY IF EXISTS "coding_questions_read_all" ON public.coding_questions;
DROP POLICY IF EXISTS "test_cases_read_visible" ON public.test_cases;
DROP POLICY IF EXISTS "Authenticated read visible r2 test cases" ON public.round_2_test_cases;
DROP POLICY IF EXISTS "submissions_read_all" ON public.submissions;
DROP POLICY IF EXISTS "unit reads own submissions" ON public.submissions;
DROP POLICY IF EXISTS "unit inserts own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Unit members read own r2 submissions" ON public.round_2_submissions;
DROP POLICY IF EXISTS "Unit members insert r2 submissions" ON public.round_2_submissions;
DROP POLICY IF EXISTS "unit reads own current code" ON public.unit_checkpoint_codes;

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_checkpoint_codes ENABLE ROW LEVEL SECURITY;

-- ── 7. Prune Realtime Publication Overexposure (TT-08) ────────────────────
DO $$ 
DECLARE
  tbl text;
  sensitive_tables text[] := ARRAY[
    'users', 
    'submissions', 
    'round_2_submissions', 
    'audit_log', 
    'proctoring_events', 
    'unit_checkpoint_codes', 
    'heartbeat_log',
    'checkpoints'
  ];
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    FOREACH tbl IN ARRAY sensitive_tables LOOP
      IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF; 
END $$;

COMMIT;
