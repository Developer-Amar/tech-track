-- ============================================================================
-- Tech Trek 2.0 — Unified Master Schema
-- ============================================================================
-- Single-file master setup for new Supabase project.
-- Contains:
--   1. Clean Tables & Team-Only (2-4 members) constraints
--   2. Enums, Roles & Pass Codes
--   3. Functions, Triggers & Auto-disqualification logic
--   4. Fixed Non-Recursive RLS Policies
--   5. Security Definer Views (Correct dependency order)
--   6. Indexes & Constraints
-- ============================================================================

-- ── Enable required extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. Users table ──────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  mobile_number text,
  roll_no text,
  branch text,
  semester int,
  pass_code text,
  avatar_url text,
  role text NOT NULL DEFAULT 'participant'
    CHECK (role IN ('participant', 'checkpoint_staff', 'admin', 'super_admin')),
  profile_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Units (Team only) ────────────────────────────────────────────────────
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type text NOT NULL DEFAULT 'team' CHECK (unit_type IN ('team')),
  name text,
  leader_id uuid NOT NULL REFERENCES public.users(id),
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  disqualified boolean NOT NULL DEFAULT false,
  disqualified_reason text,
  disqualified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Unit Members ─────────────────────────────────────────────────────────
CREATE TABLE public.unit_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'requested')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (unit_id, user_id)
);

-- ── 4. Checkpoints & Event Architecture ─────────────────────────────────────
CREATE TABLE public.checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text NOT NULL,
  round_number int NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.riddles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL UNIQUE REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checkpoint_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  UNIQUE (user_id, checkpoint_id)
);

CREATE TABLE public.unit_checkpoint_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  secret_code text NOT NULL,
  UNIQUE (unit_id, checkpoint_id)
);

CREATE TABLE public.coding_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL UNIQUE REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  sample_input text,
  sample_output text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.coding_questions(id) ON DELETE CASCADE,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_visible boolean NOT NULL DEFAULT false
);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  checkpoint_id uuid NOT NULL REFERENCES public.checkpoints(id),
  code text NOT NULL,
  language text NOT NULL CHECK (language IN ('c', 'cpp', 'python', 'java')),
  passed boolean NOT NULL DEFAULT false,
  attempt_number int NOT NULL,
  tab_switches integer DEFAULT 0,
  flagged boolean DEFAULT false,
  ai_score int DEFAULT 0,
  ai_flagged boolean DEFAULT false,
  ai_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.round_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  checkpoint_id uuid NOT NULL REFERENCES public.checkpoints(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'riddle_done', 'checkpoint_done', 'passed', 'skipped')),
  points int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  UNIQUE (unit_id, checkpoint_id)
);

CREATE TABLE public.proctoring_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  round_number int NOT NULL DEFAULT 1,
  tab_switches int NOT NULL DEFAULT 0,
  tab_switch_limit int NOT NULL DEFAULT 3,
  locked_out boolean NOT NULL DEFAULT false,
  ai_flags_count int NOT NULL DEFAULT 0,
  flagged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proctoring_state_unit_round_unique UNIQUE (unit_id, round_number)
);

CREATE TABLE public.unit_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  round_number int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  session_token text NOT NULL,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_device_sessions_unit_round_unique UNIQUE (unit_id, round_number)
);

CREATE TABLE public.proctoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  checkpoint_id uuid REFERENCES public.checkpoints(id),
  round_number int DEFAULT 1,
  event_type text NOT NULL,
  severity text DEFAULT 'low',
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  message text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.users(id),
  action_type text NOT NULL,
  action_detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_open boolean NOT NULL DEFAULT true,
  event_live boolean NOT NULL DEFAULT false,
  total_rounds int NOT NULL DEFAULT 10,
  current_round_phase int NOT NULL DEFAULT 1,
  round_1_stopped boolean NOT NULL DEFAULT false,
  round_2_active boolean NOT NULL DEFAULT false,
  round_2_stopped boolean NOT NULL DEFAULT false,
  round_1_questions int NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default event settings
INSERT INTO public.event_settings (id, registration_open, event_live, total_rounds, current_round_phase, round_1_questions)
VALUES (1, true, false, 10, 1, 10)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.blocked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  reason text,
  blocked_by uuid REFERENCES public.users(id),
  blocked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.heartbeat_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL DEFAULT 'keepalive',
  status text NOT NULL DEFAULT 'alive',
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Round 2 (LeetCode Tournament) Tables ──────────────────────────────────
CREATE TABLE public.round_qualifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  qualified_by uuid REFERENCES public.users(id),
  is_back_entry boolean NOT NULL DEFAULT false,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);

CREATE TABLE public.round_2_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  sample_input text,
  sample_output text,
  points int NOT NULL DEFAULT 100,
  order_index int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.round_2_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id) ON DELETE CASCADE,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_visible boolean NOT NULL DEFAULT false
);

CREATE TABLE public.round_2_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id),
  code text NOT NULL,
  language text NOT NULL CHECK (language IN ('c', 'cpp', 'python', 'java')),
  passed boolean NOT NULL DEFAULT false,
  attempt_number int NOT NULL,
  tab_switches int DEFAULT 0,
  flagged boolean DEFAULT false,
  ai_score int DEFAULT 0,
  ai_flagged boolean DEFAULT false,
  ai_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.round_2_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'skipped')),
  points int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  UNIQUE (unit_id, problem_id)
);

-- ── 5. Helper Functions & Triggers ──────────────────────────────────────────

-- New sign-up → profile row, with the domain check as a hard backstop.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email !~* '@chitkara\.edu\.in$' THEN
    RAISE EXCEPTION 'Only chitkara.edu.in accounts are permitted';
  END IF;

  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'amar4594.ece25@chitkara.edu.in' THEN 'super_admin' ELSE 'participant' END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Auto-generate 8-character unique alphanumeric pass code
CREATE OR REPLACE FUNCTION public.generate_pass_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger: assign pass code on user insert
CREATE OR REPLACE FUNCTION public.set_user_pass_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pass_code IS NULL THEN
    LOOP
      NEW.pass_code := public.generate_pass_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE pass_code = NEW.pass_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_pass_code ON public.users;
CREATE TRIGGER trg_set_user_pass_code
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_pass_code();

-- Prevent unauthorized role elevation and pass_code modification (TT-01)
CREATE OR REPLACE FUNCTION public.protect_user_critical_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_protect_user_critical_columns ON public.users;
CREATE TRIGGER trg_protect_user_critical_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_critical_columns();

-- Invite responses are one-shot — accept or decline, once, no take-backs.
CREATE OR REPLACE FUNCTION public.validate_invite_response()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status NOT IN ('pending', 'requested') THEN
    RAISE EXCEPTION 'This invitation/request has already been responded to';
  END IF;
  IF NEW.status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invite_response ON public.unit_members;
CREATE TRIGGER enforce_invite_response
  BEFORE UPDATE ON public.unit_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_response();

-- Once a unit is locked, its roster is frozen.
CREATE OR REPLACE FUNCTION public.prevent_locked_unit_member_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT locked FROM public.units WHERE id = COALESCE(NEW.unit_id, OLD.unit_id)) THEN
    RAISE EXCEPTION 'This unit is locked and its roster cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_unit_lock_on_members ON public.unit_members;
CREATE TRIGGER enforce_unit_lock_on_members
  BEFORE INSERT OR UPDATE OR DELETE ON public.unit_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_unit_member_changes();

-- updated_at housekeeping
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Close registration & disqualify unfilled teams
CREATE OR REPLACE FUNCTION public.close_registration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  abandoned_unit RECORD;
BEGIN
  IF NOT (SELECT registration_open FROM public.event_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Registration is already closed';
  END IF;

  -- Disqualify teams with zero accepted invitees (only leader accepted)
  FOR abandoned_unit IN
    SELECT u.id
    FROM public.units u
    WHERE u.locked = false
      AND (
        SELECT COUNT(*)
        FROM public.unit_members um
        WHERE um.unit_id = u.id AND um.status = 'accepted'
      ) <= 1
  LOOP
    UPDATE public.units
    SET disqualified = true,
        disqualified_reason = 'No team members accepted. Contact admin for assistance.',
        disqualified_at = now(),
        locked = true,
        locked_at = now()
    WHERE id = abandoned_unit.id;
  END LOOP;

  -- Expire pending invites
  UPDATE public.unit_members
  SET status = 'declined', responded_at = now()
  WHERE status = 'pending'
    AND unit_id IN (SELECT id FROM public.units WHERE locked = false);

  -- Lock all remaining units
  UPDATE public.units
  SET locked = true, locked_at = now()
  WHERE locked = false;

  -- Close registration gate
  UPDATE public.event_settings
  SET registration_open = false
  WHERE id = 1;

  -- Generate unique checkpoint verification codes
  INSERT INTO public.unit_checkpoint_codes (unit_id, checkpoint_id, secret_code)
  SELECT u.id, c.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  FROM public.units u
  CROSS JOIN public.checkpoints c
  WHERE u.disqualified = false
  ON CONFLICT (unit_id, checkpoint_id) DO NOTHING;
END;
$$;

-- Restrict close_registration() to service_role only (TT-03)
REVOKE EXECUTE ON FUNCTION public.close_registration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_registration() TO service_role;

-- ── 6. Row Level Security (RLS) ─────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_checkpoint_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat_log ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin/super_admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role IN ('admin', 'super_admin')
  );
$$;

-- Users policies: Non-recursive, authenticated-only profile reads (TT-01 safe)
CREATE POLICY "users_read_authenticated" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Event settings read policy
CREATE POLICY "event_settings_read_all" ON public.event_settings FOR SELECT USING (true);

-- Announcements read policy
CREATE POLICY "announcements_read_all" ON public.announcements FOR SELECT USING (true);

-- Units & members policies
CREATE POLICY "units_read_all" ON public.units FOR SELECT USING (true);
CREATE POLICY "unit_members_read_all" ON public.unit_members FOR SELECT USING (true);
CREATE POLICY "unit_members_update_own" ON public.unit_members FOR UPDATE USING (auth.uid() = user_id);

-- Note: checkpoints, riddles, coding_questions, test_cases, unit_checkpoint_codes,
-- submissions, and audit_log have RLS enabled with NO client access policies (TT-04, TT-13).
-- All access is performed server-side via createAdminClient() using service_role.

-- Round progress read policy (required for leaderboard and live sync)
CREATE POLICY "round_progress_read_all" ON public.round_progress FOR SELECT USING (true);

-- ── 7. Views (Ordered correctly to respect dependency chain) ─────────────────
DROP VIEW IF EXISTS public.admin_unit_overview;
DROP VIEW IF EXISTS public.leaderboard_view;

CREATE VIEW public.leaderboard_view WITH (security_invoker = true) AS
SELECT
  u.id,
  u.name,
  u.unit_type,
  COALESCE(SUM(rp.points), 0) AS total_points,
  COUNT(rp.id) FILTER (WHERE rp.status = 'passed') AS rounds_completed,
  MAX(rp.completed_at) AS last_completed_at,
  u.disqualified
FROM public.units u
LEFT JOIN public.round_progress rp ON rp.unit_id = u.id
GROUP BY u.id, u.name, u.unit_type, u.disqualified;

CREATE VIEW public.admin_unit_overview WITH (security_invoker = true) AS
SELECT
  u.id,
  u.name,
  u.unit_type,
  u.locked,
  u.disqualified,
  COALESCE(lb.total_points, 0) AS total_points,
  COUNT(um.id) FILTER (WHERE um.status = 'accepted') AS member_count,
  (SELECT usr.name FROM public.users usr WHERE usr.id = u.leader_id) AS leader_name
FROM public.units u
LEFT JOIN public.unit_members um ON um.unit_id = u.id
LEFT JOIN public.leaderboard_view lb ON lb.id = u.id
GROUP BY u.id, u.name, u.unit_type, u.locked, u.disqualified, lb.total_points;

CREATE OR REPLACE VIEW public.round_2_leaderboard_view
WITH (security_invoker = true) AS
SELECT
  u.id AS unit_id,
  u.name AS unit_name,
  u.disqualified,
  COALESCE(SUM(r2p.points) FILTER (WHERE r2p.status = 'passed'), 0) AS total_points,
  COUNT(r2p.id) FILTER (WHERE r2p.status = 'passed') AS problems_solved,
  MAX(r2p.completed_at) AS last_completed_at
FROM public.units u
INNER JOIN public.round_qualifiers rq ON rq.unit_id = u.id
LEFT JOIN public.round_2_progress r2p ON r2p.unit_id = u.id
WHERE u.locked = true
GROUP BY u.id, u.name, u.disqualified
ORDER BY total_points DESC, problems_solved DESC, last_completed_at ASC NULLS LAST;

-- ── 8. Performance Indexes & Invariants ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pass_code_unique ON public.users(pass_code) WHERE pass_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unit_members_user_id ON public.unit_members(user_id);
CREATE INDEX IF NOT EXISTS idx_unit_members_unit_id ON public.unit_members(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_members_status ON public.unit_members(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_members_one_accepted ON public.unit_members(user_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_units_locked ON public.units(locked);
CREATE INDEX IF NOT EXISTS idx_units_leader_id ON public.units(leader_id);
CREATE INDEX IF NOT EXISTS idx_submissions_unit_id ON public.submissions(unit_id);
CREATE INDEX IF NOT EXISTS idx_submissions_checkpoint_id ON public.submissions(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_round_progress_unit_id ON public.round_progress(unit_id);
CREATE INDEX IF NOT EXISTS idx_round_2_progress_unit_id ON public.round_2_progress(unit_id);
CREATE INDEX IF NOT EXISTS idx_round_2_submissions_unit_id ON public.round_2_submissions(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_checkpoint_codes_unit_cp ON public.unit_checkpoint_codes(unit_id, checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- ── 9. Backfill existing auth.users into public.users ───────────────────────
INSERT INTO public.users (id, email, name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  CASE WHEN email = 'amar4594.ece25@chitkara.edu.in' THEN 'super_admin' ELSE 'participant' END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 10. Realtime setup ───────────────────────────────────────────────────────
BEGIN;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    CREATE PUBLICATION supabase_realtime; 
  END IF; 
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.units, 
  public.unit_members, 
  public.event_settings, 
  public.round_progress,
  public.announcements,
  public.round_2_progress,
  public.proctoring_state,
  public.unit_device_sessions;

COMMIT;
