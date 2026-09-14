-- ============================================================================
-- Migration 019: Fix Critical Constraints and Triggers
-- ============================================================================

-- 1. Fix round_progress status constraint to include riddle_done & checkpoint_done
ALTER TABLE public.round_progress DROP CONSTRAINT IF EXISTS round_progress_status_check;
ALTER TABLE public.round_progress ADD CONSTRAINT round_progress_status_check
  CHECK (status IN ('pending', 'riddle_done', 'checkpoint_done', 'passed', 'skipped'));

-- 2. Fix unit_members status constraint to include requested
ALTER TABLE public.unit_members DROP CONSTRAINT IF EXISTS unit_members_status_check;
ALTER TABLE public.unit_members ADD CONSTRAINT unit_members_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'requested'));

-- 3. Update validate_invite_response trigger to allow responding to 'requested' status
CREATE OR REPLACE FUNCTION public.validate_invite_response()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('pending', 'requested') THEN
    RAISE EXCEPTION 'This invitation/request has already been responded to';
  END IF;
  IF NEW.status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;
  RETURN NEW;
END;
$$;
