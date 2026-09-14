-- ============================================================================
-- Migration: Fix gen_random_bytes dependency in close_registration()
-- ============================================================================
-- The pgcrypto extension may not be enabled on all Supabase instances.
-- Replace gen_random_bytes(4) with substr(md5(random()::text), 1, 8)
-- which produces equivalent 8-char hex codes without any extension dependency.
-- Also ensure pgcrypto is enabled as a safety net for any other usage.
-- ============================================================================

-- Ensure pgcrypto is available (belt-and-suspenders)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Replace close_registration() with extension-free random code generation
CREATE OR REPLACE FUNCTION public.close_registration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  abandoned_unit RECORD;
BEGIN
  -- Guard: only run once
  IF NOT (SELECT registration_open FROM public.event_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Registration is already closed';
  END IF;

  -- 1. Disqualify teams with zero accepted members (excluding the leader)
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

  -- 2. Expire all remaining pending invites for unlocked units
  UPDATE public.unit_members
  SET status = 'declined', responded_at = now()
  WHERE status = 'pending'
    AND unit_id IN (SELECT id FROM public.units WHERE locked = false);

  -- 3. Lock all remaining unlocked units
  UPDATE public.units
  SET locked = true, locked_at = now()
  WHERE locked = false;

  -- 4. Flip the registration gate
  UPDATE public.event_settings
  SET registration_open = false
  WHERE id = 1;

  -- 5. Generate verification codes for each (unit × checkpoint) pair
  INSERT INTO public.unit_checkpoint_codes (unit_id, checkpoint_id, secret_code)
  SELECT u.id, c.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  FROM public.units u
  CROSS JOIN public.checkpoints c
  WHERE u.disqualified = false
  ON CONFLICT (unit_id, checkpoint_id) DO NOTHING;
END;
$$;
