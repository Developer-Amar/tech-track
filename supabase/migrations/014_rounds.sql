-- ============================================================
-- Migration 014: Round-Based Tournament System
-- Adds Round 2 (LeetCode) tables and round management fields
-- ============================================================

-- 1. Add round management columns to event_settings
ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS current_round_phase int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_1_stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_2_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_2_stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_1_questions int NOT NULL DEFAULT 10;

-- Update total_rounds from 3 to 10 for existing rows
UPDATE public.event_settings SET total_rounds = 10, round_1_questions = 10 WHERE id = 1;

-- 2. Table: round_qualifiers — tracks which teams qualify for Round 2
CREATE TABLE IF NOT EXISTS public.round_qualifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  qualified_by uuid REFERENCES public.users(id),
  is_back_entry boolean NOT NULL DEFAULT false,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);

-- 3. Table: round_2_problems — standalone LeetCode-style questions
CREATE TABLE IF NOT EXISTS public.round_2_problems (
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

-- 4. Table: round_2_test_cases
CREATE TABLE IF NOT EXISTS public.round_2_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id) ON DELETE CASCADE,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_visible boolean NOT NULL DEFAULT false
);

-- 5. Table: round_2_submissions
CREATE TABLE IF NOT EXISTS public.round_2_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id),
  code text NOT NULL,
  language text NOT NULL CHECK (language IN ('c', 'cpp', 'python', 'java')),
  passed boolean NOT NULL DEFAULT false,
  attempt_number int NOT NULL,
  tab_switches int DEFAULT 0,
  flagged boolean DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Table: round_2_progress
CREATE TABLE IF NOT EXISTS public.round_2_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  problem_id uuid NOT NULL REFERENCES public.round_2_problems(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'skipped')),
  points int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  UNIQUE (unit_id, problem_id)
);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════

ALTER TABLE public.round_qualifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_2_progress ENABLE ROW LEVEL SECURITY;

-- round_qualifiers: all authenticated can read
CREATE POLICY "Authenticated read round_qualifiers"
  ON public.round_qualifiers FOR SELECT TO authenticated USING (true);

-- round_2_problems: all authenticated can read
CREATE POLICY "Authenticated read round_2_problems"
  ON public.round_2_problems FOR SELECT TO authenticated USING (true);

-- round_2_test_cases: participants see only visible, admins see all
CREATE POLICY "Authenticated read visible r2 test cases"
  ON public.round_2_test_cases FOR SELECT TO authenticated
  USING (is_visible = true OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')));

-- round_2_submissions: unit members read own, admins read all
CREATE POLICY "Unit members read own r2 submissions"
  ON public.round_2_submissions FOR SELECT TO authenticated
  USING (
    unit_id IN (SELECT unit_id FROM public.unit_members WHERE user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Unit members insert r2 submissions"
  ON public.round_2_submissions FOR INSERT TO authenticated
  WITH CHECK (
    unit_id IN (SELECT unit_id FROM public.unit_members WHERE user_id = auth.uid())
  );

-- round_2_progress: unit members read own, admins read all
CREATE POLICY "Authenticated read r2 progress"
  ON public.round_2_progress FOR SELECT TO authenticated
  USING (
    unit_id IN (SELECT unit_id FROM public.unit_members WHERE user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

-- ════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════

-- Round 2 leaderboard view
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

-- Add set_updated_at trigger to round_2_problems
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_round_2_problems_updated_at
  BEFORE UPDATE ON public.round_2_problems
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
