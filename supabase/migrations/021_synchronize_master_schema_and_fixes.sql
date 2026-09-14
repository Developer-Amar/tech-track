-- ============================================================================
-- Migration 021: Fix Missing Columns, Dead Announcements, and Realtime Publications
-- ============================================================================
-- 1. Fix submissions table: Add tab_switches and flagged columns
-- 2. Fix announcements table: Add author_id, content, priority (migrating from message/created_by)
-- 3. Add announcements and round_2_progress to supabase_realtime publication
-- ============================================================================

BEGIN;

-- ── 1. Fix submissions table ───────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS tab_switches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

-- ── 2. Fix announcements table ─────────────────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';

-- Drop existing check constraint if any and re-add to avoid conflicts
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_priority_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_priority_check
  CHECK (priority IN ('normal', 'urgent'));

-- Migrate data from legacy columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'message'
  ) THEN
    UPDATE public.announcements SET content = message WHERE content IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'created_by'
  ) THEN
    UPDATE public.announcements SET author_id = created_by WHERE author_id IS NULL;
  END IF;
END $$;

-- Ensure RLS on announcements allows authenticated reads
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read announcements" ON public.announcements;
CREATE POLICY "Authenticated users can read announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

-- ── 3. Add missing tables to supabase_realtime publication ─────────────────
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.round_2_progress;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF; 
END $$;

COMMIT;
