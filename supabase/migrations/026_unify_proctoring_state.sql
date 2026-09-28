-- ============================================================================
-- Migration 026: Unify proctoring_state table schema and constraints
-- ============================================================================

-- Ensure round_number column exists across all database instances
ALTER TABLE public.proctoring_state 
  ADD COLUMN IF NOT EXISTS round_number int NOT NULL DEFAULT 1;

-- Ensure ai_flags_count column exists
ALTER TABLE public.proctoring_state 
  ADD COLUMN IF NOT EXISTS ai_flags_count int NOT NULL DEFAULT 0;

-- Ensure updated_at column exists
ALTER TABLE public.proctoring_state 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure unique constraint on (unit_id, round_number) exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'proctoring_state_unit_round_unique'
  ) THEN
    ALTER TABLE public.proctoring_state 
      ADD CONSTRAINT proctoring_state_unit_round_unique UNIQUE (unit_id, round_number);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;
