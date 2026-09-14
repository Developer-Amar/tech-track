-- ============================================================================
-- Migration 020: Proctoring State & AI Proctoring Infrastructure
-- ============================================================================

-- 1. Create proctoring_state table
CREATE TABLE IF NOT EXISTS public.proctoring_state (
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

-- 2. Add rich telemetry columns to proctoring_events
ALTER TABLE public.proctoring_events 
  ADD COLUMN IF NOT EXISTS round_number int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Create persistent unit_device_sessions table for serverless-safe single-device locking
CREATE TABLE IF NOT EXISTS public.unit_device_sessions (
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

-- 4. Add AI code analysis columns to submissions and round_2_submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_score int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reason text;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'round_2_submissions') THEN
    ALTER TABLE public.round_2_submissions
      ADD COLUMN IF NOT EXISTS ai_score int DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_flagged boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS ai_reason text;
  END IF;
END $$;

-- 5. Row Level Security configuration
ALTER TABLE public.proctoring_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team members and staff can view proctoring state" ON public.proctoring_state;
CREATE POLICY "Team members and staff can view proctoring state"
  ON public.proctoring_state FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.unit_members
      WHERE unit_members.unit_id = proctoring_state.unit_id
        AND unit_members.user_id = auth.uid()
        AND unit_members.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'checkpoint_staff')
    )
  );

ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and admins can view proctoring events" ON public.proctoring_events;
CREATE POLICY "Staff and admins can view proctoring events"
  ON public.proctoring_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'checkpoint_staff')
    )
  );

ALTER TABLE public.unit_device_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team members and staff can view device sessions" ON public.unit_device_sessions;
CREATE POLICY "Team members and staff can view device sessions"
  ON public.unit_device_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.unit_members
      WHERE unit_members.unit_id = unit_device_sessions.unit_id
        AND unit_members.user_id = auth.uid()
        AND unit_members.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'checkpoint_staff')
    )
  );

-- 6. Add to Realtime Publication
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.proctoring_state, 
      public.proctoring_events,
      public.unit_device_sessions; 
  END IF; 
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
