-- ============================================================================
-- Migration 025: Riddle Dynamic Alternative Answers & 3 Sub-Hints System
-- ============================================================================
-- 1. Adds alternate_answers text[] to public.riddles for flexible matching
--    (e.g., ["Library", "Library gate", "Entrance of library", "Main library gate"])
-- 2. Adds hints text[] to public.riddles for up to 3 progressive sub-hints
--    (e.g., ["Campus Zone", "Landmark Clue", "Direct Guidance"])
-- ============================================================================

BEGIN;

-- ── 1. Add alternate_answers and hints to public.riddles ─────────────────────
ALTER TABLE public.riddles 
ADD COLUMN IF NOT EXISTS alternate_answers text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hints text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.riddles.alternate_answers IS 'Array of accepted alternative answer strings (case-insensitive & trimmed)';
COMMENT ON COLUMN public.riddles.hints IS 'Array of up to 3 sub-hints to guide participants to the checkpoint';

COMMIT;
