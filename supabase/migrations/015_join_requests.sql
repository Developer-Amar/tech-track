-- ============================================================
-- Migration 015: Join Request System
-- Extends unit_members to support member-initiated join requests
-- ============================================================

-- 1. Extend status check constraint to include 'requested'
ALTER TABLE public.unit_members DROP CONSTRAINT IF EXISTS unit_members_status_check;
ALTER TABLE public.unit_members ADD CONSTRAINT unit_members_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'requested'));

-- 2. Update the validate_invite_response trigger to handle 'requested' status
CREATE OR REPLACE FUNCTION public.validate_invite_response()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Allow transitions from 'pending' (leader invite) or 'requested' (member request)
  IF OLD.status NOT IN ('pending', 'requested') THEN
    RAISE EXCEPTION 'This invitation/request has already been responded to';
  END IF;
  RETURN NEW;
END;
$$;
