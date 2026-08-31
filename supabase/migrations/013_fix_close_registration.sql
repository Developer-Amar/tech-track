-- ============================================================================
-- Migration: Fix close_registration function
-- ============================================================================
-- The previous migration introduced a dependency on gen_random_bytes(4)
-- which caused an error because pgcrypto might not be in the search path.
-- We revert to using the existing public.generate_readable_code() function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_registration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  abandoned_unit RECORD;
  cp RECORD;
BEGIN
  -- Guard: only run once
  IF NOT (SELECT registration_open FROM public.event_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Registration is already closed';
  END IF;

  -- 1. Disqualify teams with zero accepted members (excluding the leader)
  --    These are teams where nobody accepted the invite.
  FOR abandoned_unit IN
    SELECT u.id
    FROM public.units u
    WHERE u.locked = false
      AND (
        SELECT COUNT(*)
        FROM public.unit_members um
        WHERE um.unit_id = u.id AND um.status = 'accepted'
      ) <= 1  -- only the leader accepted (auto-accepted on creation)
  LOOP
    UPDATE public.units
    SET disqualified = true,
        disqualified_reason = 'No team members accepted. Contact admin for assistance.',
        disqualified_at = now(),
        locked = true,
        locked_at = now()
    WHERE id = abandoned_unit.id;
  END LOOP;

  -- 2. Expire all remaining pending invites
  UPDATE public.unit_members
  SET status = 'declined', responded_at = now()
  WHERE status = 'pending';

  -- 3. Lock all remaining unlocked units
  UPDATE public.units
  SET locked = true, locked_at = now()
  WHERE locked = false;

  -- 4. Flip the registration gate
  UPDATE public.event_settings
  SET registration_open = false
  WHERE id = 1;

  -- 5. Generate verification codes for each (unit × checkpoint) pair
  FOR cp IN SELECT id FROM public.checkpoints LOOP
    INSERT INTO public.unit_checkpoint_codes (unit_id, checkpoint_id, secret_code)
    SELECT u.id, cp.id, public.generate_readable_code()
    FROM public.units u
    WHERE u.disqualified = false
    ON CONFLICT (unit_id, checkpoint_id) DO NOTHING;
  END LOOP;
END;
$$;
